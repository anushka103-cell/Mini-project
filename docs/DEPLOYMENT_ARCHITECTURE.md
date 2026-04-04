# MindSafe — Cloud Deployment Architecture

## High-Level Overview

```
                     ┌─────────────┐
                     │   Route 53  │
                     │  (DNS)      │
                     └──────┬──────┘
                            │
                     ┌──────▼──────┐
                     │    ACM      │
                     │ (TLS cert)  │
                     └──────┬──────┘
                            │
              ┌─────────────▼─────────────┐
              │   Application Load        │
              │   Balancer (ALB)          │
              │   HTTPS :443              │
              └─────┬──────────────┬──────┘
                    │ /*           │ /api/* , /socket.io/*
            ┌───────▼───────┐ ┌───▼────────────┐
            │  Frontend     │ │  API Gateway    │
            │  (Next.js)    │ │  (Express)      │
            │  ECS Fargate  │ │  ECS Fargate    │
            │  ×2 (auto)    │ │  ×2 (auto)      │
            └───────────────┘ └───┬──┬──┬──┬────┘
                                  │  │  │  │
          ┌───────────────────────┘  │  │  └────────────────────┐
          │                          │  │                        │
  ┌───────▼────────┐  ┌─────────────▼──▼──────────┐  ┌─────────▼──────────┐
  │  Chatbot       │  │  Emotion    │  Crisis      │  │  Mood Analytics    │
  │  (FastAPI)     │  │  Detection  │  Detection   │  │  (FastAPI)         │
  │  :8004         │  │  :8001      │  :8003       │  │  :8002             │
  │  ECS ×2        │  │  ECS ×1     │  ECS ×1      │  │  ECS ×1            │
  └────────────────┘  └─────────────┴──────────────┘  └─────────▲──────────┘
                                                                │
      ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
      │  RDS         │   │ ElastiCache  │   │  Amazon MQ   │   │
      │  PostgreSQL  │◄──│  Redis       │   │  RabbitMQ    │   │
      │  Multi-AZ    │   │  (cache +    │   │  (async jobs)│   │
      │  Encrypted   │   │   sessions)  │   │              │   │
      └──────────────┘   └──────────────┘   └──────┬───────┘   │
                                                   │           │
                                            ┌──────▼───────────┘
                                            │  Queue Worker
                                            │  (email, analytics)
                                            │  ECS ×1
                                            └──────────────────┘

      ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
      │  Secrets     │   │  KMS         │   │  CloudWatch  │
      │  Manager     │   │  (encryption)│   │  (logs +     │
      │  (env vars)  │   │              │   │   metrics)   │
      └──────────────┘   └──────────────┘   └──────────────┘
```

---

## AWS Services Used

| Component              | AWS Service                     | Configuration                             |
| ---------------------- | ------------------------------- | ----------------------------------------- |
| **Compute**            | ECS Fargate                     | 7 services, auto-scaling 1→10             |
| **Load Balancer**      | ALB                             | HTTPS termination, path-based routing     |
| **Database**           | RDS PostgreSQL 15               | Multi-AZ, encrypted, 20–100 GB auto-scale |
| **Cache**              | ElastiCache Redis 7             | Transit + at-rest encryption              |
| **Message Queue**      | Amazon MQ (RabbitMQ 3.12)       | Cluster mode in prod                      |
| **Secrets**            | Secrets Manager + KMS           | Auto-rotated, KMS-encrypted               |
| **Container Registry** | ECR                             | Immutable tags, scan-on-push              |
| **Monitoring**         | CloudWatch + Container Insights | 30-day log retention                      |
| **DNS**                | Route 53                        | CNAME to ALB                              |
| **TLS**                | ACM                             | Free managed certificates                 |
| **State**              | S3 + DynamoDB                   | Terraform remote state with locking       |

---

## Service Inventory

| Service           | Language   | Port | Replicas | CPU       | Memory | Auto-Scale         |
| ----------------- | ---------- | ---- | -------- | --------- | ------ | ------------------ |
| Frontend          | Next.js 16 | 3000 | 2        | 0.5 vCPU  | 1 GB   | 2→6 (ALB requests) |
| API Gateway       | Express 5  | 5000 | 2        | 0.5 vCPU  | 1 GB   | 2→10 (CPU 70%)     |
| Chatbot           | FastAPI    | 8004 | 2        | 1 vCPU    | 2 GB   | manual             |
| Emotion Detection | FastAPI    | 8001 | 1        | 2 vCPU    | 4 GB   | manual             |
| Mood Analytics    | FastAPI    | 8002 | 1        | 0.5 vCPU  | 1 GB   | manual             |
| Crisis Detection  | FastAPI    | 8003 | 1        | 0.5 vCPU  | 1 GB   | manual             |
| Queue Worker      | Python     | —    | 1        | 0.25 vCPU | 512 MB | manual             |

---

## Networking

```
VPC 10.0.0.0/16
├── Public Subnets  (10.0.0.0/24, 10.0.1.0/24)  ← ALB, NAT Gateway
├── Private Subnets (10.0.10.0/24, 10.0.11.0/24) ← ECS tasks
└── DB Subnets      (10.0.20.0/24, 10.0.21.0/24) ← RDS, ElastiCache
```

- ALB lives in public subnets, accepts 80/443
- All containers run in private subnets (no public IPs)
- Database & cache isolated in DB subnet group
- NAT Gateway for outbound internet (pip packages, HuggingFace models)
- Service discovery via AWS Cloud Map (`*.mindsafe-prod.local`)

---

## Security Design

### Secrets Management

- All secrets stored in **AWS Secrets Manager**, encrypted with a dedicated **KMS key** (auto-rotation enabled)
- ECS tasks pull secrets at launch via `valueFrom` references — secrets never touch disk or env files
- Terraform generates 64-character random passwords for JWT, encryption keys, and database credentials

### Encryption

- **At rest**: RDS (AES-256), ElastiCache (AES-256), Amazon MQ (KMS), S3 (SSE-KMS), CloudWatch logs (KMS)
- **In transit**: TLS 1.2/1.3 everywhere — ALB→client (ACM cert), Redis `rediss://`, MQ `amqps://`
- **Application-level**: PostgreSQL `pgcrypto` for field-level encryption (names, phone numbers, chat messages)

### Network Security

| Security Group | Inbound | From          |
| -------------- | ------- | ------------- |
| ALB            | 80, 443 | 0.0.0.0/0     |
| ECS Tasks      | 0-65535 | ALB SG + self |
| RDS            | 5432    | ECS SG only   |
| Redis          | 6379    | ECS SG only   |

### Application Security

- JWT HS512 signing with 64-char secrets, 15-minute access tokens
- bcrypt (12 rounds) password hashing
- Row-Level Security (RLS) policies in PostgreSQL
- Rate limiting: 30 req/s API, 5 req/s auth endpoints
- CORS restricted to production domain
- Security headers: HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options

---

## CI/CD Pipeline

```
┌──────┐    ┌──────┐    ┌────────┐    ┌─────────┐    ┌────────────┐
│ Push │───►│ Lint │───►│Security│───►│  Build  │───►│  Deploy    │
│      │    │ Test │    │ Scan   │    │  7 imgs │    │  ECS       │
└──────┘    └──────┘    └────────┘    └─────────┘    └────────────┘
  main        ↓            ↓             ↓               ↓
  branch    Node+Py     Trivy +      ECR push       Canary API
            tests      OWASP dep     immutable       then all
                       check         tags            services
```

### Pipeline Stages (GitHub Actions)

1. **Test** — Install deps, lint, build frontend, run Python + smoke tests against PostgreSQL + Redis service containers
2. **Security** — Trivy filesystem scan (CRITICAL+HIGH fail the build), OWASP dependency check
3. **Build** — Parallel matrix build of all 7 Docker images → push to ECR with commit SHA tags
4. **Deploy Staging** — `staging` branch → force new ECS deployment, wait for stability
5. **Deploy Production** — `main` branch → run DB migrations → canary deploy API first → health check → deploy remaining services → post-deploy smoke test
6. **Rollback** — Manual `workflow_dispatch` trigger rolls all services back one task definition revision

### Environments

| Branch    | Target               | Approval                            |
| --------- | -------------------- | ----------------------------------- |
| PR → main | Test + Security only | Auto                                |
| staging   | Staging cluster      | Auto                                |
| main      | Production cluster   | GitHub Environment protection rules |

---

## Cost Estimation (ap-south-1)

| Resource                   | Monthly Estimate |
| -------------------------- | ---------------- |
| ECS Fargate (all tasks)    | ~$150            |
| RDS db.t3.medium Multi-AZ  | ~$70             |
| ElastiCache cache.t3.small | ~$25             |
| Amazon MQ mq.t3.micro      | ~$20             |
| ALB                        | ~$25             |
| NAT Gateway                | ~$35             |
| CloudWatch + ECR           | ~$15             |
| **Total**                  | **~$340/month**  |

_Scale-to-zero not available on Fargate. For cost optimization, use FARGATE_SPOT (3:1 ratio configured in Terraform) for non-critical services._

---

## File Structure

```
infra/
├── terraform/
│   ├── main.tf              # VPC, RDS, Redis, MQ, ECS, ALB, Secrets, Auto-scaling
│   ├── variables.tf         # Configurable inputs
│   └── outputs.tf           # Endpoint references
├── nginx/
│   ├── nginx.conf           # Reverse proxy config (local staging)
│   └── certs/               # TLS certs for local HTTPS testing
.github/
└── workflows/
    └── ci-cd.yml            # Full CI/CD pipeline
.env.production.template     # Reference for all environment variables
docker-compose.prod.yml      # Production-like local stack
```

---

## Deployment Runbook

### First-Time Setup

```bash
# 1. Create Terraform state backend (one-time)
aws s3 mb s3://mindsafe-terraform-state --region ap-south-1
aws dynamodb create-table \
  --table-name mindsafe-tf-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# 2. Get ACM certificate
aws acm request-certificate \
  --domain-name mindsafe.example.com \
  --validation-method DNS

# 3. Initialize and apply Terraform
cd infra/terraform
terraform init
terraform plan -var="domain_name=mindsafe.example.com" -var="acm_certificate_arn=arn:aws:acm:..."
terraform apply

# 4. Push Docker images (CI/CD does this automatically on merge)
# Manual push example:
aws ecr get-login-password | docker login --username AWS --password-stdin <ACCOUNT>.dkr.ecr.ap-south-1.amazonaws.com
docker build -t mindsafe/api_gateway -f src/docker/Dockerfile.api_gateway .
docker tag mindsafe/api_gateway:latest <ACCOUNT>.dkr.ecr.ap-south-1.amazonaws.com/mindsafe/api_gateway:latest
docker push <ACCOUNT>.dkr.ecr.ap-south-1.amazonaws.com/mindsafe/api_gateway:latest

# 5. Run schema migration
aws ecs run-task --cluster mindsafe-prod --task-definition mindsafe-prod-db-migrate ...
```

### Routine Operations

| Operation      | Command                                          |
| -------------- | ------------------------------------------------ |
| Deploy         | Push to `main` (automatic via CI/CD)             |
| Scale API      | `aws ecs update-service --desired-count 5 ...`   |
| View logs      | `aws logs tail /ecs/mindsafe-prod --follow`      |
| DB backup      | Automated daily via RDS (30-day retention)       |
| Rollback       | Trigger rollback workflow in GitHub Actions      |
| Rotate secrets | Update in Secrets Manager → force new ECS deploy |

---

## GCP Alternative

If deploying to GCP instead of AWS, map the services as:

| AWS             | GCP Equivalent                                  |
| --------------- | ----------------------------------------------- |
| ECS Fargate     | Cloud Run or GKE Autopilot                      |
| RDS PostgreSQL  | Cloud SQL                                       |
| ElastiCache     | Memorystore for Redis                           |
| Amazon MQ       | Cloud Pub/Sub (or self-managed RabbitMQ on GKE) |
| Secrets Manager | Secret Manager                                  |
| ALB             | Cloud Load Balancer                             |
| ECR             | Artifact Registry                               |
| CloudWatch      | Cloud Logging + Monitoring                      |
| Route 53        | Cloud DNS                                       |
| ACM             | Managed SSL Certificates                        |

The Terraform config can be adapted to use `google` provider with equivalent resources. The CI/CD pipeline replaces `aws-actions/*` with `google-github-actions/*`.

---

---

# Free-Tier Deployment ($0/month)

An alternative architecture using only permanent free tiers — no credit card required for core services.

## Architecture

```
             ┌──────────────────┐
             │   Vercel (Free)  │
             │   Next.js SSR    │
             │   CDN + HTTPS    │
             │   Auto-deploy    │
             └────────┬─────────┘
                      │ /api/* proxied
                      ▼
        ┌─────────────────────────┐
        │  Render (Free)          │
        │  API Gateway (Express)  │
        │  + 4 Python services    │
        │  + Queue Worker         │
        │  Auto-sleep after 15min │
        └──┬──────┬──────┬────────┘
           │      │      │
     ┌─────▼──┐ ┌─▼────┐ ┌▼──────────┐
     │  Neon  │ │Upstash│ │CloudAMQP  │
     │  Pg 15 │ │ Redis │ │ RabbitMQ  │
     │  Free  │ │ Free  │ │ LazyFox   │
     │ 0.5 GB │ │ 256MB │ │ 1M msg/mo │
     └────────┘ └───────┘ └───────────┘
```

## Free Service Providers

| Component | Provider | Free Tier Limits | Signup |
|-----------|----------|-----------------|--------|
| **Frontend** | Vercel | Unlimited deploys, 100 GB bandwidth, HTTPS, CDN | [vercel.com](https://vercel.com) |
| **Backend (×6)** | Render | 750 hours/month per service, auto-sleep after 15 min idle | [render.com](https://render.com) |
| **PostgreSQL** | Neon | 0.5 GB storage, auto-suspend, branches | [neon.tech](https://neon.tech) |
| **Redis** | Upstash | 10K commands/day, 256 MB, REST API | [upstash.com](https://upstash.com) |
| **RabbitMQ** | CloudAMQP | LazyFox plan: 1M messages/month, 3 queues | [cloudamqp.com](https://cloudamqp.com) |
| **Email** | Resend | 100 emails/day, 3000/month | [resend.com](https://resend.com) |
| **CI/CD** | GitHub Actions | 2000 min/month (private), unlimited (public) | [github.com](https://github.com) |
| **Monitoring** | Grafana Cloud | 10K metrics, 50 GB logs, 50 GB traces | [grafana.com](https://grafana.com) |

**Total: $0/month** (all permanently free, not trial periods)

## Trade-offs vs AWS Production

| Aspect | AWS ($340/mo) | Free Tier ($0/mo) |
|--------|---------------|-------------------|
| Cold starts | None (always running) | 30-50s spin-up after idle |
| Database | 100 GB, Multi-AZ, auto-backup | 0.5 GB, single region, manual backup |
| Redis | Dedicated, encrypted | 10K commands/day limit |
| Replicas | 2+ per service, auto-scaling | 1 per service, no scaling |
| Uptime SLA | 99.95% | Best-effort |
| Custom domain | Yes (Route 53) | Yes (Vercel + Render) |
| WebSocket | Full support | Render supports it |
| ML model loading | Always warm (2-4 GB RAM) | Cold loads (~60s for HuggingFace models) |

## Setup Steps

### 1. Database (Neon)
```
1. Go to neon.tech → Sign up
2. Create project → Region: Singapore
3. Copy connection string: postgresql://user:pass@ep-xxx.neon.tech/mindsafe_db
4. Run schema: psql $DATABASE_URL < src/deploy/postgres_schema.sql
5. Run mood schema: psql $DATABASE_URL < src/deploy/mood_tracking_schema.sql
```

### 2. Redis (Upstash)
```
1. Go to upstash.com → Sign up
2. Create Redis database → Region: AP-Southeast
3. Copy connection string: rediss://default:xxx@apn1-xxx.upstash.io:6379
```

### 3. RabbitMQ (CloudAMQP)
```
1. Go to cloudamqp.com → Sign up
2. Create instance → Plan: LazyFox (free)
3. Copy AMQP URL
```

### 4. Backend (Render)
```
1. Go to render.com → Sign up with GitHub
2. New → Blueprint → Connect your repo
3. Render auto-discovers render.yaml and creates 6 services
4. Go to each service → Environment → paste Neon, Upstash, CloudAMQP URLs
5. Manual deploy → all services start
```

### 5. Frontend (Vercel)
```
1. Go to vercel.com → Sign up with GitHub
2. Import repository
3. Set environment variables:
   NEXT_PUBLIC_API_URL = https://mindsafe-api.onrender.com
4. Deploy (automatic on every push)
```

### 6. CI/CD (GitHub Actions)
```
1. Go to repo → Settings → Secrets → Actions
2. Add Render deploy hook URLs (from Render dashboard → Deploy Hook):
   RENDER_DEPLOY_HOOK_API, RENDER_DEPLOY_HOOK_CHATBOT, etc.
3. Push to main → pipeline runs automatically
```

## Free-Tier File Structure

```
vercel.json                  # Vercel frontend config + API proxy rewrites
render.yaml                  # Render Blueprint (auto-creates 6 services)
.env.free-tier.template      # All free-tier connection strings reference
.github/workflows/ci-free.yml  # Lightweight CI/CD for free providers
```

## Mitigating Cold Starts

Free-tier Render services sleep after 15 minutes of inactivity. Options:

1. **Cron ping** — Use a free cron service (cron-job.org) to hit `/health` every 14 minutes
2. **Upstash QStash** — Free scheduled HTTP calls (included with Upstash account)
3. **GitHub Actions cron** — Add a scheduled workflow:
   ```yaml
   on:
     schedule:
       - cron: '*/14 * * * *'  # Every 14 minutes
   jobs:
     keepalive:
       runs-on: ubuntu-latest
       steps:
         - run: |
             curl -s https://mindsafe-api.onrender.com/health
             curl -s https://mindsafe-chatbot.onrender.com/health
   ```

## When to Upgrade

Move to the AWS stack when you hit any of these:
- Database exceeds 0.5 GB
- Need sub-second response times (no cold starts)
- Traffic exceeds Render free-tier hours
- Need auto-scaling or multi-region
- Compliance requirements (HIPAA BAA, SOC 2 report)
