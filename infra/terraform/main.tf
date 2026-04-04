# ============================================================
# MindSafe Platform — AWS Infrastructure (Terraform)
# ============================================================
# Provisions: VPC, ECS Fargate, RDS PostgreSQL, ElastiCache
#             Redis, ALB, ECR repos, CloudWatch, Secrets Manager
# ============================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "mindsafe-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "mindsafe-tf-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "MindSafe"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# ======================== DATA ========================

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  name   = "mindsafe-${var.environment}"
  azs    = slice(data.aws_availability_zones.available.names, 0, 2)
  region = var.aws_region

  # Container images (ECR)
  ecr_base = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"

  services = {
    frontend          = { port = 3000, cpu = 512,  memory = 1024, desired = 2 }
    api_gateway       = { port = 5000, cpu = 512,  memory = 1024, desired = 2 }
    chatbot           = { port = 8004, cpu = 1024, memory = 2048, desired = 2 }
    emotion_detection = { port = 8001, cpu = 2048, memory = 4096, desired = 1 }
    mood_analytics    = { port = 8002, cpu = 512,  memory = 1024, desired = 1 }
    crisis_detection  = { port = 8003, cpu = 512,  memory = 1024, desired = 1 }
    queue_worker      = { port = 0,    cpu = 256,  memory = 512,  desired = 1 }
  }
}

# ======================== VPC ========================

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name}-vpc"
  cidr = var.vpc_cidr

  azs              = local.azs
  public_subnets   = [for i, az in local.azs : cidrsubnet(var.vpc_cidr, 8, i)]
  private_subnets  = [for i, az in local.azs : cidrsubnet(var.vpc_cidr, 8, i + 10)]
  database_subnets = [for i, az in local.azs : cidrsubnet(var.vpc_cidr, 8, i + 20)]

  enable_nat_gateway   = true
  single_nat_gateway   = var.environment != "prod"
  enable_dns_hostnames = true
  enable_dns_support   = true

  create_database_subnet_group = true
}

# ======================== SECURITY GROUPS ========================

resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP (redirect to HTTPS)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "ecs_tasks" {
  name_prefix = "${local.name}-ecs-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 0
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
    description     = "From ALB"
  }

  # Allow internal service-to-service
  ingress {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    self      = true
    description = "Service mesh"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "rds" {
  name_prefix = "${local.name}-rds-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "PostgreSQL from ECS"
  }

  lifecycle { create_before_destroy = true }
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name}-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs_tasks.id]
    description     = "Redis from ECS"
  }

  lifecycle { create_before_destroy = true }
}

# ======================== RDS POSTGRESQL ========================

resource "aws_db_instance" "postgres" {
  identifier = "${local.name}-db"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true
  storage_type          = "gp3"

  db_name  = "mindsafe_db"
  username = "mindsafe_admin"
  password = random_password.db_password.result

  db_subnet_group_name   = module.vpc.database_subnet_group_name
  vpc_security_group_ids = [aws_security_group.rds.id]

  multi_az            = var.environment == "prod"
  publicly_accessible = false
  skip_final_snapshot = var.environment != "prod"

  backup_retention_period = var.environment == "prod" ? 30 : 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn

  deletion_protection = var.environment == "prod"

  tags = { Name = "${local.name}-postgres" }
}

resource "random_password" "db_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}|:?"
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${local.name}-rds-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ======================== ELASTICACHE REDIS ========================

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${local.name}-redis"
  description          = "MindSafe Redis cluster"

  engine               = "redis"
  engine_version       = "7.0"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1

  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth.result

  automatic_failover_enabled = var.environment == "prod"

  tags = { Name = "${local.name}-redis" }
}

resource "random_password" "redis_auth" {
  length  = 64
  special = false
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name}-redis"
  subnet_ids = module.vpc.private_subnets
}

# ======================== AMAZON MQ (RabbitMQ) ========================

resource "aws_mq_broker" "rabbitmq" {
  broker_name = "${local.name}-rabbitmq"

  engine_type    = "RabbitMQ"
  engine_version = "3.12"
  host_instance_type = var.mq_instance_type
  deployment_mode    = var.environment == "prod" ? "CLUSTER_MULTI_AZ" : "SINGLE_INSTANCE"

  publicly_accessible = false
  subnet_ids          = var.environment == "prod" ? module.vpc.private_subnets : [module.vpc.private_subnets[0]]
  security_groups     = [aws_security_group.ecs_tasks.id]

  user {
    username = "mindsafe_mq"
    password = random_password.mq_password.result
  }

  encryption_options {
    use_aws_owned_key = false
    kms_key_id        = aws_kms_key.main.arn
  }

  tags = { Name = "${local.name}-rabbitmq" }
}

resource "random_password" "mq_password" {
  length  = 32
  special = false
}

# ======================== KMS ========================

resource "aws_kms_key" "main" {
  description         = "MindSafe encryption key"
  enable_key_rotation = true

  tags = { Name = "${local.name}-kms" }
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.name}"
  target_key_id = aws_kms_key.main.key_id
}

# ======================== SECRETS MANAGER ========================

resource "aws_secretsmanager_secret" "app_secrets" {
  name       = "${local.name}/app-secrets"
  kms_key_id = aws_kms_key.main.arn
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_SECRET                     = random_password.jwt_secret.result
    JWT_REFRESH_SECRET             = random_password.jwt_refresh_secret.result
    JWT_EMAIL_VERIFICATION_SECRET  = random_password.jwt_email_secret.result
    DATA_ENCRYPTION_KEY            = random_password.data_encryption_key.result
    DATA_HMAC_KEY                  = random_password.data_hmac_key.result
    DATABASE_URL                   = "postgresql://mindsafe_admin:${random_password.db_password.result}@${aws_db_instance.postgres.endpoint}/mindsafe_db"
    REDIS_URL                      = "rediss://:${random_password.redis_auth.result}@${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379/0"
    RABBITMQ_URL                   = "amqps://mindsafe_mq:${random_password.mq_password.result}@${aws_mq_broker.rabbitmq.instances[0].endpoints[0]}"
    RESEND_API_KEY                 = var.resend_api_key
    GOOGLE_CLIENT_ID               = var.google_client_id
    GOOGLE_CLIENT_SECRET           = var.google_client_secret
  })
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

resource "random_password" "jwt_refresh_secret" {
  length  = 64
  special = false
}

resource "random_password" "jwt_email_secret" {
  length  = 64
  special = false
}

resource "random_password" "data_encryption_key" {
  length  = 64
  special = false
}

resource "random_password" "data_hmac_key" {
  length  = 64
  special = false
}

# ======================== ECR REPOSITORIES ========================

resource "aws_ecr_repository" "services" {
  for_each = local.services

  name                 = "mindsafe/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = var.environment != "prod"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = aws_kms_key.main.arn
  }
}

resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each   = aws_ecr_repository.services
  repository = each.value.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ======================== ECS CLUSTER ========================

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  configuration {
    execute_command_configuration {
      kms_key_id = aws_kms_key.main.arn
      logging    = "OVERRIDE"

      log_configuration {
        cloud_watch_encryption_enabled = true
        cloud_watch_log_group_name     = aws_cloudwatch_log_group.ecs.name
      }
    }
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 1
    capacity_provider = "FARGATE"
  }

  default_capacity_provider_strategy {
    weight            = 3
    capacity_provider = "FARGATE_SPOT"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.main.arn
}

# ======================== ECS TASK EXECUTION ROLE ========================

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name}-ecs-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.app_secrets.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.main.arn]
      }
    ]
  })
}

# ======================== ECS TASK ROLE ========================

resource "aws_iam_role" "ecs_task" {
  name = "${local.name}-ecs-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

# ======================== ALB ========================

resource "aws_lb" "main" {
  name               = local.name
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.vpc.public_subnets

  enable_deletion_protection = var.environment == "prod"

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${local.name}-alb-logs"
  force_destroy = var.environment != "prod"
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-old-logs"
    status = "Enabled"
    expiration { days = 90 }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "aws:kms"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# HTTPS listener (requires ACM certificate)
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

# HTTP → HTTPS redirect
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ======================== TARGET GROUPS ========================

resource "aws_lb_target_group" "frontend" {
  name        = "${local.name}-frontend"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
}

# ALB routing: /api/* → API Gateway, everything else → Frontend
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern { values = ["/api/*", "/health", "/socket.io/*"] }
  }
}

# ======================== ECS SERVICES (Frontend + API) ========================

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${local.name}-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = local.services.frontend.cpu
  memory                   = local.services.frontend.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "frontend"
    image = "${local.ecr_base}/mindsafe/frontend:latest"
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV",             value = "production" },
      { name = "NEXT_PUBLIC_API_URL",  value = "https://${var.domain_name}" },
      { name = "NEXT_PUBLIC_WS_URL",   value = "wss://${var.domain_name}" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "frontend"
      }
    }
  }])
}

resource "aws_ecs_service" "frontend" {
  name            = "frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = local.services.frontend.desired
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

resource "aws_ecs_task_definition" "api_gateway" {
  family                   = "${local.name}-api-gateway"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = local.services.api_gateway.cpu
  memory                   = local.services.api_gateway.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name  = "api-gateway"
    image = "${local.ecr_base}/mindsafe/api_gateway:latest"
    portMappings = [{ containerPort = 5000, protocol = "tcp" }]
    environment = [
      { name = "NODE_ENV",               value = "production" },
      { name = "PORT",                   value = "5000" },
      { name = "USE_POSTGRES",           value = "true" },
      { name = "CORS_ORIGINS",           value = "https://${var.domain_name}" },
      { name = "EMOTION_DETECTION_URL",  value = "http://emotion-detection.${local.name}.local:8001" },
      { name = "MOOD_ANALYTICS_URL",     value = "http://mood-analytics.${local.name}.local:8002" },
      { name = "CRISIS_DETECTION_URL",   value = "http://crisis-detection.${local.name}.local:8003" },
      { name = "CHATBOT_SERVICE_URL",    value = "http://chatbot.${local.name}.local:8004" },
      { name = "GOOGLE_CALLBACK_URL",    value = "https://${var.domain_name}/api/auth/google/callback" },
    ]
    secrets = [
      { name = "JWT_SECRET",                    valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_SECRET::" },
      { name = "JWT_REFRESH_SECRET",             valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_REFRESH_SECRET::" },
      { name = "JWT_EMAIL_VERIFICATION_SECRET",  valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:JWT_EMAIL_VERIFICATION_SECRET::" },
      { name = "DATA_ENCRYPTION_KEY",            valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATA_ENCRYPTION_KEY::" },
      { name = "DATA_HMAC_KEY",                  valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATA_HMAC_KEY::" },
      { name = "DATABASE_URL",                   valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:DATABASE_URL::" },
      { name = "REDIS_URL",                      valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:REDIS_URL::" },
      { name = "RABBITMQ_URL",                   valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RABBITMQ_URL::" },
      { name = "RESEND_API_KEY",                 valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:RESEND_API_KEY::" },
      { name = "GOOGLE_CLIENT_ID",               valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GOOGLE_CLIENT_ID::" },
      { name = "GOOGLE_CLIENT_SECRET",           valueFrom = "${aws_secretsmanager_secret.app_secrets.arn}:GOOGLE_CLIENT_SECRET::" },
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

resource "aws_ecs_service" "api_gateway" {
  name            = "api-gateway"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api_gateway.arn
  desired_count   = local.services.api_gateway.desired
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.ecs_tasks.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api-gateway"
    container_port   = 5000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.api_gateway.arn
  }
}

# ======================== SERVICE DISCOVERY (CloudMap) ========================

resource "aws_service_discovery_private_dns_namespace" "main" {
  name = "${local.name}.local"
  vpc  = module.vpc.vpc_id
}

resource "aws_service_discovery_service" "api_gateway" {
  name = "api-gateway"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    dns_records { ttl = 10; type = "A" }
    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config { failure_threshold = 1 }
}

# ======================== AUTO SCALING ========================

resource "aws_appautoscaling_target" "api" {
  max_capacity       = 10
  min_capacity       = local.services.api_gateway.desired
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api_gateway.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${local.name}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

resource "aws_appautoscaling_target" "frontend" {
  max_capacity       = 6
  min_capacity       = local.services.frontend.desired
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "frontend_requests" {
  name               = "${local.name}-frontend-requests"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label         = "${aws_lb.main.arn_suffix}/${aws_lb_target_group.frontend.arn_suffix}"
    }
    target_value       = 1000
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
