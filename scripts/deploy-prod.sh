#!/usr/bin/env bash
# ============================================================
# MindSafe — Production Deployment Script
# ============================================================
# Automates the full production deployment via Docker Compose.
#
# Usage:
#   chmod +x scripts/deploy-prod.sh
#   ./scripts/deploy-prod.sh              # interactive — prompts for missing secrets
#   ./scripts/deploy-prod.sh --yes        # skip confirmation prompts
# ============================================================
set -euo pipefail

# ── Paths ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.production"
ENV_TEMPLATE="$PROJECT_ROOT/.env.production.template"
COMPOSE_BASE="$PROJECT_ROOT/docker-compose.yml"
COMPOSE_PROD="$PROJECT_ROOT/docker-compose.prod.yml"
CERTS_DIR="$PROJECT_ROOT/infra/nginx/certs"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

AUTO_YES=false
[[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]] && AUTO_YES=true

info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $*"; exit 1; }

confirm() {
  if $AUTO_YES; then return 0; fi
  read -rp "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy] ]]
}

# ════════════════════════════════════════════════════════════
# 1. Prerequisite checks
# ════════════════════════════════════════════════════════════
info "Checking prerequisites..."

command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install from https://docs.docker.com/get-docker/"
command -v docker compose >/dev/null 2>&1 || fail "Docker Compose v2 is required. Update Docker Desktop or install the compose plugin."

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
ok "Docker $DOCKER_VERSION"

# Verify compose files exist
[[ -f "$COMPOSE_BASE" ]] || fail "Missing $COMPOSE_BASE"
[[ -f "$COMPOSE_PROD" ]] || fail "Missing $COMPOSE_PROD"
ok "Compose files found"

# ════════════════════════════════════════════════════════════
# 2. Generate secrets
# ════════════════════════════════════════════════════════════
generate_secret() {
  # 48 random bytes → 64-char base64url string
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '=/+' | head -c 64
  elif command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url').slice(0,64))"
  else
    head -c 48 /dev/urandom | base64 | tr -d '=/+' | head -c 64
  fi
}

SECRET_KEYS=(
  JWT_SECRET
  JWT_REFRESH_SECRET
  JWT_EMAIL_VERIFICATION_SECRET
  JWT_PASSWORD_RESET_SECRET
  DATA_ENCRYPTION_KEY
  DATA_HMAC_KEY
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  MQ_PASSWORD
  GRAFANA_PASSWORD
)

# ════════════════════════════════════════════════════════════
# 3. Create / update .env.production
# ════════════════════════════════════════════════════════════
if [[ -f "$ENV_FILE" ]]; then
  warn ".env.production already exists."
  if ! confirm "Overwrite secrets that are currently empty?"; then
    info "Keeping existing .env.production as-is."
  else
    info "Filling in empty secrets..."
    for key in "${SECRET_KEYS[@]}"; do
      # If key exists but value is empty, fill it
      if grep -q "^${key}=$" "$ENV_FILE" 2>/dev/null; then
        val=$(generate_secret)
        sed -i "s|^${key}=$|${key}=${val}|" "$ENV_FILE"
        ok "Generated $key"
      fi
    done
  fi
else
  info "Creating .env.production from template..."

  if [[ -f "$ENV_TEMPLATE" ]]; then
    cp "$ENV_TEMPLATE" "$ENV_FILE"
  else
    touch "$ENV_FILE"
  fi

  # Ensure all secret keys exist, generate values
  for key in "${SECRET_KEYS[@]}"; do
    val=$(generate_secret)
    if grep -q "^${key}=" "$ENV_FILE"; then
      sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
      echo "${key}=${val}" >> "$ENV_FILE"
    fi
    ok "Generated $key"
  done

  # Set production defaults
  grep -q "^NODE_ENV=" "$ENV_FILE" || echo "NODE_ENV=production" >> "$ENV_FILE"
  grep -q "^PYTHON_ENV=" "$ENV_FILE" || echo "PYTHON_ENV=production" >> "$ENV_FILE"
  grep -q "^USE_POSTGRES=" "$ENV_FILE" || echo "USE_POSTGRES=true" >> "$ENV_FILE"
  grep -q "^BCRYPT_ROUNDS=" "$ENV_FILE" || echo "BCRYPT_ROUNDS=12" >> "$ENV_FILE"
  grep -q "^LOG_LEVEL=" "$ENV_FILE" || echo "LOG_LEVEL=WARNING" >> "$ENV_FILE"

  ok ".env.production created with auto-generated secrets"
  warn "Review $ENV_FILE and fill in external service keys (RESEND_API_KEY, GOOGLE_CLIENT_ID, etc.)"
fi

# ════════════════════════════════════════════════════════════
# 4. Validate critical env vars
# ════════════════════════════════════════════════════════════
info "Validating environment..."

source "$ENV_FILE" 2>/dev/null || true

MISSING=()
for key in JWT_SECRET JWT_REFRESH_SECRET DATA_ENCRYPTION_KEY DATA_HMAC_KEY POSTGRES_PASSWORD; do
  val="${!key:-}"
  if [[ -z "$val" || ${#val} -lt 32 ]]; then
    MISSING+=("$key")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  fail "These secrets are missing or too short (<32 chars): ${MISSING[*]}"
fi

ok "All critical secrets are set (32+ chars)"

# ════════════════════════════════════════════════════════════
# 5. Create nginx certs directory (self-signed for local prod)
# ════════════════════════════════════════════════════════════
if [[ ! -f "$CERTS_DIR/fullchain.pem" ]]; then
  warn "No TLS certificates found at $CERTS_DIR"
  if confirm "Generate self-signed certificates for local testing?"; then
    mkdir -p "$CERTS_DIR"
    openssl req -x509 -nodes -days 365 \
      -newkey rsa:2048 \
      -keyout "$CERTS_DIR/privkey.pem" \
      -out "$CERTS_DIR/fullchain.pem" \
      -subj "/CN=localhost/O=MindSafe-Dev" 2>/dev/null
    ok "Self-signed cert created (replace with real certs for production)"
  fi
fi

# ════════════════════════════════════════════════════════════
# 6. Build and deploy
# ════════════════════════════════════════════════════════════
echo ""
info "═══════════════════════════════════════════"
info "  Deploying MindSafe Production Stack"
info "═══════════════════════════════════════════"
echo ""

cd "$PROJECT_ROOT"

info "Pulling base images..."
docker compose -f "$COMPOSE_PROD" pull postgres redis rabbitmq 2>/dev/null || true

info "Building application images (this may take several minutes)..."
docker compose -f "$COMPOSE_PROD" build --parallel

if ! confirm "Ready to start all services. Proceed?"; then
  info "Aborted."
  exit 0
fi

info "Starting infrastructure (postgres, redis, rabbitmq)..."
docker compose -f "$COMPOSE_PROD" up -d postgres redis rabbitmq

info "Waiting for databases to become healthy..."
TIMEOUT=120
ELAPSED=0
while [[ $ELAPSED -lt $TIMEOUT ]]; do
  HEALTHY=$(docker compose -f "$COMPOSE_PROD" ps --format json 2>/dev/null | grep -c '"healthy"' || echo "0")
  if [[ "$HEALTHY" -ge 3 ]]; then
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo -ne "\r  Waiting... ${ELAPSED}s / ${TIMEOUT}s"
done
echo ""

if [[ $ELAPSED -ge $TIMEOUT ]]; then
  warn "Timeout waiting for databases. Continuing anyway..."
else
  ok "Databases healthy"
fi

info "Starting all application services..."
docker compose -f "$COMPOSE_PROD" up -d

# ════════════════════════════════════════════════════════════
# 7. Health check
# ════════════════════════════════════════════════════════════
info "Waiting for services to initialize (30s)..."
sleep 30

echo ""
info "Running health checks..."
echo ""

SERVICES_TO_CHECK=(
  "API Gateway|http://localhost:5000/health"
  "Frontend|http://localhost:3000"
  "Chatbot|http://localhost:8004/health"
  "Emotion Detection|http://localhost:8001/health"
  "Mood Analytics|http://localhost:8002/health"
  "Crisis Detection|http://localhost:8003/health"
  "Recommendation|http://localhost:8005/health"
)

PASS=0
TOTAL=${#SERVICES_TO_CHECK[@]}

for entry in "${SERVICES_TO_CHECK[@]}"; do
  IFS='|' read -r name url <<< "$entry"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")
  if [[ "$STATUS" =~ ^2 ]]; then
    ok "$name — $STATUS"
    PASS=$((PASS + 1))
  else
    warn "$name — HTTP $STATUS (may still be starting)"
  fi
done

echo ""

# ════════════════════════════════════════════════════════════
# 8. Security smoke tests
# ════════════════════════════════════════════════════════════
info "Running security checks..."

# Check that dev tokens are NOT exposed
REGISTER_RESP=$(curl -s -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"deploy-test-'$RANDOM'@example.com","password":"DeployTest@12345"}' 2>/dev/null || echo "{}")

if echo "$REGISTER_RESP" | grep -q "emailVerificationToken"; then
  warn "SECURITY: Register response exposes emailVerificationToken — check NODE_ENV"
else
  ok "Register response does not leak dev tokens"
fi

# Check security headers
HEADERS=$(curl -sI http://localhost:5000/health 2>/dev/null || echo "")
if echo "$HEADERS" | grep -qi "x-content-type-options"; then
  ok "Security headers present"
else
  warn "Security headers missing from API response"
fi

# ════════════════════════════════════════════════════════════
# 9. Summary
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  MindSafe Production Deployment Complete${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "  Services: $PASS / $TOTAL healthy"
echo ""
echo "  Frontend:    http://localhost:3000  (or https://localhost via nginx)"
echo "  API:         http://localhost:5000"
echo "  Grafana:     http://localhost:3001"
echo "  Prometheus:  http://localhost:9090"
echo "  RabbitMQ UI: http://localhost:15672"
echo ""
echo "  Logs:        docker compose -f docker-compose.prod.yml logs -f"
echo "  Stop:        docker compose -f docker-compose.prod.yml down"
echo "  Restart:     docker compose -f docker-compose.prod.yml restart"
echo ""
echo "  Env file:    $ENV_FILE"
echo ""

if [[ $PASS -lt $TOTAL ]]; then
  warn "Some services are not yet healthy. They may still be starting."
  echo "  Check status: docker compose -f docker-compose.prod.yml ps"
fi
