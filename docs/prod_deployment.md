# MindSafe — Production Deployment Guide

## Quick Start (Automated)

Run the deployment script and it handles everything — secrets, config, build, health checks:

```powershell
# Windows
.\scripts\deploy-prod.ps1

# Linux / macOS
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

The script will:

1. Check Docker prerequisites
2. Generate all secrets (JWT, encryption, DB passwords)
3. Create `.env.production` from the template
4. Optionally generate self-signed TLS certs
5. Build all Docker images in parallel
6. Start infrastructure first (Postgres, Redis, RabbitMQ), wait for healthy
7. Start all application services
8. Run health checks on all 7 endpoints
9. Run security smoke tests (token leak, headers)

For manual step-by-step deployment, continue reading below.

---

## Architecture Overview

```
                    ┌──────────────┐
                    │   Client     │
                    └──────┬───────┘
                           │
              ┌────────────▼────────────┐
              │  Nginx / ALB / Vercel   │  ← TLS termination
              └──┬──────────────────┬───┘
                 │                  │
        ┌────────▼──────┐  ┌───────▼────────┐
        │  Frontend     │  │  API Gateway   │
        │  (Next.js)    │  │  (Express)     │
        │  :3000        │  │  :5000         │
        └───────────────┘  └──┬─────────┬───┘
                              │         │
           ┌──────────────────┼─────────┼──────────────────┐
           │                  │         │                  │
   ┌───────▼──────┐  ┌───────▼───┐  ┌──▼──────────┐  ┌───▼──────────┐
   │ Chatbot      │  │ Emotion   │  │ Mood        │  │ Crisis       │
   │ :8004        │  │ :8001     │  │ :8002       │  │ :8003        │
   └──────────────┘  └───────────┘  └─────────────┘  └──────────────┘
           │                                │
   ┌───────▼──────┐              ┌──────────▼─────────┐
   │ Recommend.   │              │ Queue Worker       │
   │ :8005        │              │ (RabbitMQ consumer) │
   └──────────────┘              └────────────────────┘
           │                              │
    ┌──────▼──────┐  ┌──────────┐  ┌─────▼──────┐
    │ PostgreSQL  │  │  Redis   │  │ RabbitMQ   │
    │ :5432       │  │  :6379   │  │ :5672      │
    └─────────────┘  └──────────┘  └────────────┘
```

---

## Prerequisites

| Tool           | Version | Purpose                   |
| -------------- | ------- | ------------------------- |
| Docker         | 24+     | Container runtime         |
| Docker Compose | v2+     | Orchestration             |
| Node.js        | 20 LTS  | Frontend build            |
| Python         | 3.11    | ML microservices          |
| Terraform      | 1.5+    | AWS infra (Option C only) |
| AWS CLI v2     | latest  | AWS deployment (Option C) |

---

## Step 1 — Generate Secrets

Every secret **must** be at least 32 characters in production. The backend refuses to start otherwise.

```powershell
# Generate 5 unique secrets (run once per secret)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

You need values for:

| Secret                          | Description                    |
| ------------------------------- | ------------------------------ |
| `JWT_SECRET`                    | Access token signing key       |
| `JWT_REFRESH_SECRET`            | Refresh token signing key      |
| `JWT_EMAIL_VERIFICATION_SECRET` | Email verification token key   |
| `DATA_ENCRYPTION_KEY`           | Field-level encryption at rest |
| `DATA_HMAC_KEY`                 | HMAC digest for lookups        |
| `POSTGRES_PASSWORD`             | Database password              |

---

## Step 2 — Create `.env` File

```powershell
copy .env.production.template .env
```

Fill in **all** required values:

```env
NODE_ENV=production
PYTHON_ENV=production

# ── Secrets (32+ chars each) ──
JWT_SECRET=<generated>
JWT_REFRESH_SECRET=<generated>
JWT_EMAIL_VERIFICATION_SECRET=<generated>
DATA_ENCRYPTION_KEY=<generated>
DATA_HMAC_KEY=<generated>

# ── Database ──
POSTGRES_PASSWORD=<strong-password>
DATABASE_URL=postgresql://mindsafe_user:<POSTGRES_PASSWORD>@postgres:5432/mindsafe_db
USE_POSTGRES=true

# ── External Services ──
RESEND_API_KEY=<your-resend-api-key>
CORS_ORIGINS=https://yourdomain.com

# ── Optional: Google OAuth ──
GOOGLE_CLIENT_ID=<oauth-client-id>
GOOGLE_CLIENT_SECRET=<oauth-client-secret>
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

# ── Optional: SMS Provider (twilio or aws-sns) ──
# SMS_PROVIDER=twilio
# TWILIO_ACCOUNT_SID=...
# TWILIO_AUTH_TOKEN=...
# TWILIO_FROM_NUMBER=...
```

---

## Deployment Options

### Option A — Docker Compose on a VPS (Recommended for Getting Started)

Best for: Single-server deployment on any VPS (DigitalOcean, Hetzner, EC2 instance).

#### A1. Build and launch all services

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The production override (`docker-compose.prod.yml`) enables:

- `NODE_ENV=production` / `PYTHON_ENV=production`
- 2× replicas for api_gateway, chatbot, frontend
- CPU/memory resource limits per container
- Nginx reverse proxy on port 80/443
- `LOG_LEVEL=WARNING` for Python services

#### A2. Verify all services are healthy

```bash
docker compose ps
```

All containers should show `Up (healthy)`. Then:

```bash
curl http://localhost/health
# Expected: {"status":"ok","uptime":...,"timestamp":"..."}
```

#### A3. Run the database schema

The schema is applied automatically on first startup via `initializeDatabase()`. To verify:

```bash
docker compose exec postgres psql -U mindsafe_user -d mindsafe_db -c "\dt"
```

#### A4. Set up TLS/SSL

Place your certificate files and update `infra/nginx/nginx.conf`:

```nginx
server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    # ... existing proxy rules ...
}
```

Or use **Caddy** as a drop-in replacement for automatic HTTPS via Let's Encrypt.

#### A5. Monitor

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (login: `admin` / value of `GRAFANA_ADMIN_PASSWORD`)

---

### Option B — Free Tier (Render.com + Vercel)

Best for: Demo, portfolio, or zero-cost hosting.

#### B1. Deploy frontend to Vercel

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard:

| Variable              | Value                               |
| --------------------- | ----------------------------------- |
| `NEXT_PUBLIC_API_URL` | `https://mindsafe-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL`  | `wss://mindsafe-api.onrender.com`   |

The `vercel.json` in the repo configures build output, security headers, and API rewrites automatically.

#### B2. Deploy backend to Render

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **Blueprints**
3. Connect your repo — Render reads `render.yaml` and provisions all 7 web services + 1 worker
4. Secrets (JWT, encryption keys) are auto-generated by the blueprint

#### B3. Provision free managed databases

| Service    | Provider                           | Free Tier            |
| ---------- | ---------------------------------- | -------------------- |
| PostgreSQL | [Neon](https://neon.tech)          | 0.5 GB, auto-suspend |
| Redis      | [Upstash](https://upstash.com)     | 10K commands/day     |
| RabbitMQ   | [CloudAMQP](https://cloudamqp.com) | 1M messages/month    |

Copy `.env.free-tier.template` and fill in the connection URLs from each provider.

#### B4. Configure environment variables in Render

Add these to the `api_gateway` service in Render's dashboard:

```
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/mindsafe_db?sslmode=require
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
RABBITMQ_URL=amqps://user:pass@xxx.rmq.cloudamqp.com/user
CORS_ORIGINS=https://mindsafe.vercel.app
```

---

### Option C — AWS Production (Terraform)

Best for: Production-grade with auto-scaling, encryption, Multi-AZ redundancy.

#### C1. Prerequisites

- AWS CLI configured with appropriate IAM permissions
- ACM certificate for your domain in `ap-south-1`
- S3 bucket `mindsafe-terraform-state` for state backend

#### C2. Plan and apply infrastructure

```bash
cd infra/terraform

terraform init

terraform plan \
  -var="environment=prod" \
  -var="domain_name=mindsafe.example.com" \
  -var="acm_certificate_arn=arn:aws:acm:ap-south-1:123456:certificate/abc-123" \
  -var="resend_api_key=re_xxx" \
  -var="google_client_id=xxx.apps.googleusercontent.com" \
  -var="google_client_secret=GOCSPX-xxx"

terraform apply
```

This provisions:

| Resource             | Config                                               |
| -------------------- | ---------------------------------------------------- |
| VPC                  | 10.0.0.0/16, 2 AZs, public + private + DB subnets    |
| RDS PostgreSQL 15    | db.t3.medium, Multi-AZ, encrypted, 30-day backup     |
| ElastiCache Redis 7  | cache.t3.small, transit + at-rest encryption         |
| Amazon MQ (RabbitMQ) | mq.t3.micro, KMS encrypted                           |
| ECS Fargate Cluster  | FARGATE + FARGATE_SPOT (3:1), Container Insights     |
| ALB                  | TLS termination, path-based routing                  |
| ECR                  | 7 repositories, immutable tags, scan-on-push         |
| Secrets Manager      | All app secrets, auto-rotatable                      |
| CloudWatch Logs      | 30-day retention, KMS encrypted                      |
| Auto-scaling         | API: 2–10 (CPU 70%), Frontend: 2–6 (1000 req/target) |

#### C3. Push Docker images to ECR

```bash
# Get repo URLs
terraform output ecr_repositories

# Login to ECR
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com

# Build and push each service
SERVICES=(api_gateway frontend chatbot emotion_detection mood_analytics crisis_detection recommendation queue_worker)

for svc in "${SERVICES[@]}"; do
  docker build -t <account-id>.dkr.ecr.ap-south-1.amazonaws.com/mindsafe-prod-${svc}:latest \
    -f src/docker/Dockerfile.${svc} .
  docker push <account-id>.dkr.ecr.ap-south-1.amazonaws.com/mindsafe-prod-${svc}:latest
done
```

#### C4. Point DNS

```bash
terraform output alb_dns_name
```

Create a CNAME record: `mindsafe.example.com → <alb-dns-name>`

---

## Post-Deployment Checklist

Run through this after every deployment:

```
✅  NODE_ENV=production is set
✅  All JWT/encryption secrets are unique, 32+ chars
✅  CORS_ORIGINS matches actual frontend domain
✅  RESEND_API_KEY is configured (email verification works)
✅  POSTGRES_PASSWORD is not the default
✅  /health endpoint returns {"status":"ok"}
✅  /api/register → sends verification email (not console token)
✅  /api/login → does not return OTP in response body
✅  TLS/SSL is active (HTTPS only)
✅  Grafana/Prometheus dashboards load
✅  Seed users are NOT created (seed is skipped in production)
```

### Smoke Tests

```bash
# Health check
curl -s https://yourdomain.com/health | jq .

# Registration (should NOT return emailVerificationToken)
curl -s -X POST https://yourdomain.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test@12345"}' | jq .

# Security headers present
curl -sI https://yourdomain.com | grep -iE "x-frame|x-content|strict-transport|referrer"
```

---

## Scaling

### Docker Compose

```bash
# Scale a specific service
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --scale api_gateway=4
```

### AWS ECS

Auto-scaling is configured by Terraform:

- **API Gateway**: scales at 70% CPU, 2–10 tasks
- **Frontend**: scales at 1000 requests/target, 2–6 tasks

Manual override:

```bash
aws ecs update-service --cluster mindsafe-prod \
  --service api-gateway --desired-count 6
```

---

## Backup & Recovery

### Database backup (Docker Compose)

```bash
docker compose exec postgres pg_dump -U mindsafe_user mindsafe_db > backup.sql
```

### Database restore

```bash
cat backup.sql | docker compose exec -T postgres psql -U mindsafe_user mindsafe_db
```

### AWS RDS

Automated backups are enabled (30-day retention in prod). To restore:

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier mindsafe-prod-postgres \
  --target-db-instance-identifier mindsafe-prod-postgres-restored \
  --restore-time 2026-04-04T00:00:00Z
```

---

## Troubleshooting

| Symptom                            | Cause                                      | Fix                                                         |
| ---------------------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Server refuses to start            | Missing/short secrets in production        | Set all secrets to 32+ characters in `.env`                 |
| `Origin is not allowed by CORS`    | `CORS_ORIGINS` mismatch                    | Set to exact frontend URL (no trailing slash)               |
| Seed users appearing in production | `NODE_ENV` not set to `production`         | Ensure `NODE_ENV=production` in env                         |
| OTP/tokens visible in API response | Running in development mode                | Set `NODE_ENV=production`                                   |
| Email verification not sending     | `RESEND_API_KEY` missing                   | Sign up at resend.com and add the API key                   |
| Chatbot slow on first request      | ML model loading cold start                | Allow 60s startup; check healthcheck at `/health`           |
| Database connection refused        | Wrong `DATABASE_URL` or postgres not ready | Check URL, wait for healthcheck, verify `USE_POSTGRES=true` |
| WebSocket connection fails         | Nginx not configured for upgrade           | Ensure `proxy_set_header Upgrade $http_upgrade` in nginx    |
