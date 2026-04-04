<#
.SYNOPSIS
  MindSafe - Production Deployment Script (Windows PowerShell)

.DESCRIPTION
  Automates the full production deployment via Docker Compose.
  Generates secrets, validates config, builds images, starts services, runs health checks.

.EXAMPLE
  .\scripts\deploy-prod.ps1              # interactive
  .\scripts\deploy-prod.ps1 -AutoYes     # skip confirmation prompts
#>
[CmdletBinding()]
param(
  [switch]$AutoYes
)

$ErrorActionPreference = "Stop"

# -- Paths --
$ProjectRoot  = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
$EnvFile      = Join-Path $ProjectRoot ".env.production"
$EnvTemplate  = Join-Path $ProjectRoot ".env.production.template"
$ComposeProd  = Join-Path $ProjectRoot "docker-compose.prod.yml"
$CertsDir     = Join-Path $ProjectRoot "infra\nginx\certs"

function Write-Info  { param($msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Ok    { param($msg) Write-Host "[OK]    $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "[WARN]  $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "[FAIL]  $msg" -ForegroundColor Red; exit 1 }

function Confirm-Step {
  param($Prompt)
  if ($AutoYes) { return $true }
  $ans = Read-Host "$Prompt [y/N]"
  return $ans -match '^[Yy]'
}

function New-Secret {
  $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
  $bytes = [byte[]]::new(64)
  $rng.GetBytes($bytes)
  $rng.Dispose()
  $raw = [Convert]::ToBase64String($bytes) -replace '[+/=]', ''
  return $raw.Substring(0, [Math]::Min(64, $raw.Length))
}

# ============================================================
# 1. Prerequisite checks
# ============================================================
Write-Info "Checking prerequisites..."

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Fail "Docker is not installed. Install from https://docs.docker.com/get-docker/"
}

try {
  $dockerVersion = docker version --format '{{.Server.Version}}' 2>$null
  Write-Ok "Docker $dockerVersion"
}
catch {
  Write-Warn "Could not determine Docker version. Is Docker Desktop running?"
}

# Verify compose file exists
if (-not (Test-Path $ComposeProd)) { Write-Fail "Missing $ComposeProd" }
Write-Ok "Compose files found"

# ============================================================
# 2. Secret keys to generate
# ============================================================
$SecretKeys = @(
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_EMAIL_VERIFICATION_SECRET",
  "JWT_PASSWORD_RESET_SECRET",
  "DATA_ENCRYPTION_KEY",
  "DATA_HMAC_KEY",
  "POSTGRES_PASSWORD",
  "REDIS_PASSWORD",
  "MQ_PASSWORD",
  "GRAFANA_PASSWORD"
)

# ============================================================
# 3. Create / update .env.production
# ============================================================
$envLines = @{}

if (Test-Path $EnvFile) {
  Write-Warn ".env.production already exists."
  # Parse existing file
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') {
      $envLines[$Matches[1]] = $Matches[2]
    }
  }
  if (Confirm-Step "Fill in empty secrets?") {
    foreach ($key in $SecretKeys) {
      if (-not $envLines[$key] -or $envLines[$key].Trim() -eq "") {
        $envLines[$key] = New-Secret
        Write-Ok "Generated $key"
      }
    }
    # Rewrite file preserving comments and order
    $content = Get-Content $EnvFile
    $newContent = [System.Collections.ArrayList]@()
    $writtenKeys = @{}
    foreach ($line in $content) {
      if ($line -match '^([A-Z_]+)=(.*)$' -and $envLines.ContainsKey($Matches[1])) {
        [void]$newContent.Add("$($Matches[1])=$($envLines[$Matches[1]])")
        $writtenKeys[$Matches[1]] = $true
      }
      else {
        [void]$newContent.Add($line)
      }
    }
    # Append keys that were generated but had no line in the file
    foreach ($key in $SecretKeys) {
      if ($envLines.ContainsKey($key) -and -not $writtenKeys.ContainsKey($key)) {
        [void]$newContent.Add("$key=$($envLines[$key])")
      }
    }
    $newContent | Set-Content $EnvFile -Encoding UTF8
  }
}
else {
  Write-Info "Creating .env.production from template..."

  if (Test-Path $EnvTemplate) {
    Copy-Item $EnvTemplate $EnvFile
  }
  else {
    New-Item -Path $EnvFile -ItemType File -Force | Out-Null
  }

  # Parse template
  Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$') {
      $envLines[$Matches[1]] = $Matches[2]
    }
  }

  # Generate all secrets
  foreach ($key in $SecretKeys) {
    $envLines[$key] = New-Secret
    Write-Ok "Generated $key"
  }

  # Set production defaults
  $defaults = @{
    "NODE_ENV"       = "production"
    "PYTHON_ENV"     = "production"
    "USE_POSTGRES"   = "true"
    "BCRYPT_ROUNDS"  = "12"
    "LOG_LEVEL"      = "WARNING"
  }
  foreach ($k in $defaults.Keys) {
    if (-not $envLines.ContainsKey($k)) { $envLines[$k] = $defaults[$k] }
  }

  # Rewrite file with generated secrets
  $content = Get-Content $EnvFile
  $newContent = $content | ForEach-Object {
    if ($_ -match '^([A-Z_]+)=(.*)$' -and $envLines.ContainsKey($Matches[1])) {
      "$($Matches[1])=$($envLines[$Matches[1]])"
    }
    else { $_ }
  }
  # Append any keys not already in the template
  $existingKeys = $content | Where-Object { $_ -match '^([A-Z_]+)=' } | ForEach-Object { ($_ -split '=')[0] }
  foreach ($k in $envLines.Keys) {
    if ($k -notin $existingKeys) {
      $newContent += "$k=$($envLines[$k])"
    }
  }
  $newContent | Set-Content $EnvFile -Encoding UTF8

  Write-Ok ".env.production created with auto-generated secrets"
  Write-Warn "Review $EnvFile and fill in: RESEND_API_KEY, GOOGLE_CLIENT_ID, DOMAIN_NAME, etc."
}

# ============================================================
# 4. Validate critical env vars
# ============================================================
Write-Info "Validating environment..."

# Re-parse
$envLines = @{}
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^([A-Z_]+)=(.*)$') { $envLines[$Matches[1]] = $Matches[2] }
}

$critical = @("JWT_SECRET", "JWT_REFRESH_SECRET", "DATA_ENCRYPTION_KEY", "DATA_HMAC_KEY", "POSTGRES_PASSWORD")
$missing = @()
foreach ($key in $critical) {
  $val = $envLines[$key]
  if (-not $val -or $val.Length -lt 32) { $missing += $key }
}

if ($missing.Count -gt 0) {
  Write-Fail "These secrets are missing or too short (<32 chars): $($missing -join ', ')"
}

Write-Ok "All critical secrets set (32+ chars)"

# ============================================================
# 5. Self-signed certs (optional)
# ============================================================
if (-not (Test-Path (Join-Path $CertsDir "fullchain.pem"))) {
  Write-Warn "No TLS certificates found at $CertsDir"
  if ((Get-Command openssl -ErrorAction SilentlyContinue) -and (Confirm-Step "Generate self-signed certs for local testing?")) {
    New-Item -Path $CertsDir -ItemType Directory -Force | Out-Null
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 `
      -keyout "$CertsDir\privkey.pem" `
      -out "$CertsDir\fullchain.pem" `
      -subj "/CN=localhost/O=MindSafe-Dev" 2>$null
    Write-Ok "Self-signed cert created (replace with real certs for production)"
  }
}

# ============================================================
# 6. Build and deploy
# ============================================================
Write-Host ""
Write-Info "==========================================="
Write-Info "  Deploying MindSafe Production Stack"
Write-Info "==========================================="
Write-Host ""

Set-Location $ProjectRoot

# Export env vars so docker compose can interpolate ${VAR} references
Write-Info "Loading environment variables from .env.production..."
Get-Content $EnvFile | ForEach-Object {
  if ($_ -match '^([A-Z_][A-Z0-9_]*)=(.+)$') {
    [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
  }
}

# Switch to Continue for Docker commands (they write warnings to stderr)
$ErrorActionPreference = "Continue"

Write-Info "Pulling base images..."
docker compose --env-file $EnvFile -f $ComposeProd pull postgres redis rabbitmq 2>&1 | Out-Null

Write-Info "Building application images (this may take several minutes)..."
docker compose --env-file $EnvFile -f $ComposeProd build --parallel
if ($LASTEXITCODE -ne 0) { Write-Fail "Docker build failed. Is Docker Desktop running?" }

$ErrorActionPreference = "Stop"

if (-not (Confirm-Step "Ready to start all services. Proceed?")) {
  Write-Info "Aborted."
  exit 0
}

Write-Info "Starting infrastructure (postgres, redis, rabbitmq)..."
$ErrorActionPreference = "Continue"
docker compose --env-file $EnvFile -f $ComposeProd up -d postgres redis rabbitmq

Write-Info "Waiting for databases to become healthy..."
$timeout = 120; $elapsed = 0
while ($elapsed -lt $timeout) {
  $healthy = (docker compose --env-file $EnvFile -f $ComposeProd ps --format json 2>$null | Select-String '"healthy"').Count
  if ($healthy -ge 3) { break }
  Start-Sleep -Seconds 5
  $elapsed += 5
  Write-Host "`r  Waiting... ${elapsed}s / ${timeout}s" -NoNewline
}
Write-Host ""

if ($elapsed -ge $timeout) {
  Write-Warn "Timeout waiting for databases. Continuing..."
}
else {
  Write-Ok "Databases healthy"
}

Write-Info "Starting all application services..."
docker compose --env-file $EnvFile -f $ComposeProd up -d

# ============================================================
# 7. Health checks
# ============================================================
Write-Info "Waiting for services to initialize (30s)..."
Start-Sleep -Seconds 30

Write-Host ""
Write-Info "Running health checks..."
Write-Host ""

$checks = @(
  @{ Name = "API Gateway";        Url = "http://localhost:5000/health" },
  @{ Name = "Frontend";           Url = "http://localhost:3000" },
  @{ Name = "Chatbot";            Url = "http://localhost:8004/health" },
  @{ Name = "Emotion Detection";  Url = "http://localhost:8001/health" },
  @{ Name = "Mood Analytics";     Url = "http://localhost:8002/health" },
  @{ Name = "Crisis Detection";   Url = "http://localhost:8003/health" },
  @{ Name = "Recommendation";     Url = "http://localhost:8005/health" }
)

$pass = 0
foreach ($svc in $checks) {
  try {
    $resp = Invoke-WebRequest -Uri $svc.Url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
    Write-Ok "$($svc.Name) - $($resp.StatusCode)"
    $pass++
  }
  catch {
    $code = "ERR"
    if ($_.Exception.Response) {
      $code = [int]$_.Exception.Response.StatusCode
    }
    Write-Warn "$($svc.Name) - $code (may still be starting)"
  }
}

# ============================================================
# 8. Security smoke tests
# ============================================================
Write-Host ""
Write-Info "Running security checks..."

try {
  $randomEmail = "deploy-test-$(Get-Random)@example.com"
  $body = @{ email = $randomEmail; password = "DeployTest@12345" } | ConvertTo-Json
  $regResp = Invoke-RestMethod -Uri "http://localhost:5000/api/register" -Method POST `
    -ContentType "application/json" -Body $body -ErrorAction Stop
  if ($regResp.emailVerificationToken) {
    Write-Warn "SECURITY: Register response leaks emailVerificationToken - check NODE_ENV"
  }
  else {
    Write-Ok "Register response does not leak dev tokens"
  }
}
catch {
  Write-Warn "Could not test registration endpoint (may not be ready)"
}

try {
  $healthResp = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -ErrorAction Stop
  if ($healthResp.Headers["X-Content-Type-Options"]) {
    Write-Ok "Security headers present"
  }
  else {
    Write-Warn "Security headers may be missing"
  }
}
catch {
  Write-Warn "Could not check security headers"
}

# ============================================================
# 9. Summary
# ============================================================
Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  MindSafe Production Deployment Complete" -ForegroundColor Green
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Services: $pass / $($checks.Count) healthy"
Write-Host ""
Write-Host "  Frontend:    http://localhost:3000  (or https://localhost via nginx)"
Write-Host "  API:         http://localhost:5000"
Write-Host "  Grafana:     http://localhost:3001"
Write-Host "  Prometheus:  http://localhost:9090"
Write-Host "  RabbitMQ UI: http://localhost:15672"
Write-Host ""
$logsCmd = "docker compose -f docker-compose.prod.yml logs -f"
$stopCmd = "docker compose -f docker-compose.prod.yml down"
$restartCmd = "docker compose -f docker-compose.prod.yml restart"
Write-Host "  Logs:        $logsCmd"
Write-Host "  Stop:        $stopCmd"
Write-Host "  Restart:     $restartCmd"
Write-Host ""
Write-Host "  Env file:    $EnvFile"
Write-Host ""

if ($pass -lt $checks.Count) {
  Write-Warn "Some services not yet healthy. They may still be starting."
  $statusCmd = "docker compose -f docker-compose.prod.yml ps"
  Write-Host "  Check status: $statusCmd"
}
