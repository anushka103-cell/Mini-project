# MindSafe — Comprehensive Testing Guide

> Everything you need to build, run, and test MindSafe — from a quick dev smoke test to a full production test matrix.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Building the Application](#2-building-the-application)
3. [Development Testing (Local)](#3-development-testing-local)
4. [Docker Compose Testing](#4-docker-compose-testing)
5. [Automated Smoke Tests](#5-automated-smoke-tests)
6. [Python Service Unit Tests](#6-python-service-unit-tests)
7. [Linting & Static Analysis](#7-linting--static-analysis)
8. [Frontend UI Testing Checklist](#8-frontend-ui-testing-checklist)
9. [API Endpoint Testing Matrix](#9-api-endpoint-testing-matrix)
10. [Microservice Testing](#10-microservice-testing)
11. [Security Testing](#11-security-testing)
12. [Performance & Stability Testing](#12-performance--stability-testing)
13. [Database Verification](#13-database-verification)
14. [Production Testing](#14-production-testing)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Prerequisites

| Tool              | Min Version | Purpose                        |
| ----------------- | ----------- | ------------------------------ |
| Node.js           | 18+         | Frontend & backend gateway     |
| npm               | 9+          | Package management             |
| Python            | 3.10+       | ML microservices               |
| Docker            | 24+         | Container orchestration        |
| Docker Compose    | 2.20+       | Multi-service stack            |
| PostgreSQL client | 15+         | Database inspection (optional) |
| curl              | Any         | API smoke testing              |

**Environment files required:**

```
.env               # Development environment variables
.env.production    # Production environment variables
```

Key environment variables:

```env
POSTGRES_USER=mindsafe_user
POSTGRES_PASSWORD=<strong-password>
POSTGRES_DB=mindsafe_db
JWT_SECRET=<random-secret>
JWT_REFRESH_SECRET=<random-secret>
GROQ_API_KEY=<groq-api-key>       # Required for chatbot & anon summary
```

---

## 2. Building the Application

### 2a. Install Dependencies

```powershell
# Frontend (project root)
npm install

# Backend gateway
cd src/backend
npm install
cd ../..

# Python services (from project root, with venv active)
pip install -r src/services/emotion_detection/requirements.txt
pip install -r src/services/mood_analytics/requirements.txt
pip install -r src/services/crisis_detection/requirements.txt
pip install -r src/services/chatbot/requirements.txt
pip install -r src/services/recommendation/requirements.txt
pip install -r src/services/queue_worker/requirements.txt
```

### 2b. Build the Next.js Frontend

```powershell
npm run build
```

**Expected output:**

```
▲ Next.js 16.x (Turbopack)
✓ Compiled successfully
✓ Generating static pages (21/21)

Route (app)
┌ ○ /
├ ○ /ai-companion
├ ○ /anonymous
├ ○ /avatar
├ ○ /dashboard
├ ○ /emergency
├ ○ /games
├ ○ /insights
├ ○ /login
├ ○ /mood
├ ○ /profile
├ ○ /reset-password
├ ○ /signup
└ ○ /verify-email
```

All 18 routes should appear. Static pages marked `○`, dynamic API routes marked `ƒ`.

### 2c. Build Docker Images

```powershell
# Development stack
docker compose build

# Production stack
docker compose -f docker-compose.prod.yml build
```

---

## 3. Development Testing (Local)

### 3a. Start Development Servers

```powershell
# Terminal 1: Next.js frontend (port 3000)
npm run dev

# Terminal 2: Backend API gateway (port 5000)
cd src/backend
npm run dev

# Terminal 3+: Python services (each in separate terminals)
cd src/services/emotion_detection && python main.py   # Port 8001
cd src/services/mood_analytics && python main.py      # Port 8002
cd src/services/crisis_detection && python main.py    # Port 8003
cd src/services/chatbot && python main.py             # Port 8004
cd src/services/recommendation && python main.py      # Port 8005
```

### 3b. Quick Health Checks

```powershell
curl http://localhost:5000/health         # API Gateway
curl http://localhost:8001/health         # Emotion Detection
curl http://localhost:8002/health         # Mood Analytics
curl http://localhost:8003/health         # Crisis Detection
curl http://localhost:8004/health         # Chatbot
curl http://localhost:8005/health         # Recommendation
curl http://localhost:3000/               # Frontend (returns HTML)
```

**Expected:** All return `{"status":"ok"}` or `{"status":"healthy"}`.

---

## 4. Docker Compose Testing

### 4a. Start the Development Stack

```powershell
docker compose up -d --build
```

**Services started (development):**

| Service           | Container               | Port        | Purpose               |
| ----------------- | ----------------------- | ----------- | --------------------- |
| PostgreSQL        | mindsafe_postgres       | 5432        | Database              |
| Redis             | mindsafe_redis          | 6379        | Session/cache         |
| RabbitMQ          | mindsafe_rabbitmq       | 5672, 15672 | Message queue         |
| API Gateway       | mindsafe_api_gateway    | 5000        | Backend REST API      |
| Emotion Detection | mindsafe_emotion        | 8001        | ML emotion analysis   |
| Mood Analytics    | mindsafe_mood           | 8002        | Mood tracking service |
| Crisis Detection  | mindsafe_crisis         | 8003        | Crisis detection      |
| Chatbot           | mindsafe_chatbot        | 8004        | AI companion          |
| Recommendation    | mindsafe_recommendation | 8005        | Coping strategies     |
| Queue Worker      | mindsafe_queue_worker   | —           | Background jobs       |
| Prometheus        | mindsafe_prometheus     | 9090        | Metrics               |
| Grafana           | mindsafe_grafana        | 3001        | Dashboards            |

### 4b. Verify All Containers Are Healthy

```powershell
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

All containers should show `Up` / `healthy`.

### 4c. View Logs

```powershell
# All services
docker compose logs -f --tail=50

# Specific service
docker compose logs -f api_gateway
docker compose logs -f emotion_detection
```

---

## 5. Automated Smoke Tests

MindSafe includes automated smoke test suites that cover the full API lifecycle.

### 5a. API Smoke Test

Covers: registration, email verification, login, profile CRUD, chat, mood logging, avatar, error handling.

```powershell
# Against local dev (default: http://localhost:5000)
npm run smoke:api

# Against Docker dev stack
$env:API_BASE_URL = "http://localhost:5000"
npm run smoke:api

# Against production (HTTPS via Nginx)
$env:API_BASE_URL = "https://localhost"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
npm run smoke:api
```

**Expected output:** Each test prints `PASS` or `FAIL` with details. Summary at the end shows total pass/fail count.

### 5b. Mood API Smoke Test

Covers: register, login, mood logging (same-day append), mood retrieval, ordering.

```powershell
# Against local dev
npm run smoke:mood

# Against Docker dev stack
$env:API_BASE_URL = "http://localhost:5000"
npm run smoke:mood
```

**Expected:** All assertions pass. Verifies same-day mood entries are appended (not replaced) and returned newest-first.

### 5c. Docker Compose + Smoke Test (One Command)

```powershell
npm run smoke:api:compose
```

This builds and starts the Docker stack, then runs the API smoke test suite.

---

## 6. Python Service Unit Tests

### 6a. Emotion Detection Tests

```powershell
cd src/services/emotion_detection
python -m pytest test_emotion_detector.py -v
```

Tests cover:

- Sentiment analysis (positive/negative text)
- Emotion classification (joy, sadness, anger, etc.)
- Crisis keyword detection
- Batch analysis

### 6b. Mood Analytics Integration Tests

```powershell
# From project root
npm run test:mood:service

# Or directly
python -m pytest src/services/mood_analytics/test_mood_logging_integration.py -v
```

Tests cover:

- Mood entry creation
- Same-day append behavior
- Trend analysis calculations
- Weekly score computation
- Streak tracking

---

## 7. Linting & Static Analysis

### 7a. ESLint (Frontend + Backend JS)

```powershell
npm run lint
```

Runs ESLint with the Next.js Core Web Vitals rule set. Configuration is in [eslint.config.mjs](../eslint.config.mjs).

**Expected:** No errors. Warnings are acceptable but should be reviewed.

### 7b. Python Linting (Optional)

```powershell
# Install linters
pip install flake8 black

# Check style
flake8 src/services/ --max-line-length=120
black --check src/services/
```

---

## 8. Frontend UI Testing Checklist

Open the app in a browser and verify each page manually.

### Public Pages (No Auth Required)

| #   | Page           | URL                                    | What to Verify                                                                        |
| --- | -------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Landing        | `http://localhost:3000/`               | Page loads, CTA buttons visible, no console errors                                    |
| 2   | Signup         | `http://localhost:3000/signup`         | Form renders, validation works (empty fields, weak password), submission succeeds     |
| 3   | Login          | `http://localhost:3000/login`          | Form renders, wrong credentials show error, correct credentials redirect to dashboard |
| 4   | Verify Email   | `http://localhost:3000/verify-email`   | Token from URL is processed, success/error message appears                            |
| 5   | Reset Password | `http://localhost:3000/reset-password` | Form renders, accepts email, shows confirmation                                       |

### Protected Pages (Login Required)

| #   | Page           | URL             | What to Verify                                                                             |
| --- | -------------- | --------------- | ------------------------------------------------------------------------------------------ |
| 6   | Dashboard      | `/dashboard`    | Loads after login, shows mood summary, sidebar navigation works                            |
| 7   | AI Companion   | `/ai-companion` | Chat interface loads, send a message, receive AI response, emotion detection badge visible |
| 8   | Mood Tracker   | `/mood`         | Log a mood with score + label, chart displays entries, streak counter updates              |
| 9   | Profile        | `/profile`      | Displays user info, can update name/email/mobile, toggle anonymous mode                    |
| 10  | Avatar         | `/avatar`       | 3D avatar renders in canvas, can customize appearance, change expressions                  |
| 11  | Insights       | `/insights`     | Emotion analytics charts load, trends display correctly                                    |
| 12  | Emergency      | `/emergency`    | Crisis resources visible, helpline numbers displayed                                       |
| 13  | Games          | `/games`        | Coping strategy games/activities load                                                      |
| 14  | Anonymous Chat | `/anonymous`    | Peer support chat works, summary generation works                                          |

### Cross-Cutting UI Checks

| #   | Area                | What to Verify                                                            |
| --- | ------------------- | ------------------------------------------------------------------------- |
| 15  | Auth Guard          | Accessing `/dashboard` without login redirects to `/login`                |
| 16  | Sidebar             | All navigation links work, active page highlighted                        |
| 17  | Theme               | Dark/light mode toggle works, persists on refresh                         |
| 18  | Responsive          | App works on mobile viewport (375px), tablet (768px), desktop (1440px)    |
| 19  | Keyboard Navigation | Tab through all interactive elements, Enter/Space activates buttons       |
| 20  | Accessibility       | Screen reader announces page changes (AriaAnnouncer), no missing alt text |

---

## 9. API Endpoint Testing Matrix

Use `curl`, Postman, or the [OpenAPI spec](api/openapi.yaml) to test each endpoint.

### Authentication Endpoints

| Method | Endpoint               | Body                         | Expected Status | Notes                                    |
| ------ | ---------------------- | ---------------------------- | --------------- | ---------------------------------------- |
| POST   | `/api/register`        | `{email, password}`          | 201             | Returns anonymizedUserId                 |
| POST   | `/api/verify-email`    | `{token}`                    | 200             | Token from email or dev response         |
| POST   | `/api/login`           | `{email, password}`          | 200             | Returns token, accessToken, refreshToken |
| POST   | `/api/refresh-token`   | `{refreshToken}`             | 200             | One-time use token rotation              |
| POST   | `/api/logout`          | —                            | 200             | Invalidates token                        |
| POST   | `/api/forgot-password` | `{email}`                    | 200             | Sends reset email                        |
| POST   | `/api/reset-password`  | `{token, newPassword}`       | 200             | Resets password                          |
| POST   | `/api/register`        | `{email: "existing"}`        | 409             | Conflict — duplicate email               |
| POST   | `/api/login`           | `{email, password: "wrong"}` | 401             | Unauthorized                             |

### Profile Endpoints (Auth Required)

| Method | Endpoint       | Body                                                      | Expected Status |
| ------ | -------------- | --------------------------------------------------------- | --------------- |
| GET    | `/api/profile` | —                                                         | 200             |
| POST   | `/api/profile` | `{fullName, email, mobile, anonymousName, anonymousMode}` | 200             |
| DELETE | `/api/profile` | —                                                         | 200/204         |

### Chat Endpoints (Auth Required)

| Method | Endpoint       | Body                                     | Expected Status |
| ------ | -------------- | ---------------------------------------- | --------------- |
| POST   | `/api/chatbot` | `{content, style, use_name, use_memory}` | 200             |
| POST   | `/api/chat`    | `{role, content}`                        | 200             |
| GET    | `/api/chat`    | —                                        | 200             |

### Mood Endpoints (Auth Required)

| Method | Endpoint                           | Body/Params                                  | Expected Status |
| ------ | ---------------------------------- | -------------------------------------------- | --------------- |
| POST   | `/api/moods/log`                   | `{mood_score, mood_label, notes, logged_at}` | 201             |
| GET    | `/api/moods/logs?days=30`          | —                                            | 200 (array)     |
| GET    | `/api/moods/trends?days=30`        | —                                            | 200             |
| GET    | `/api/moods/weekly-score`          | —                                            | 200             |
| GET    | `/api/moods/visualization?days=90` | —                                            | 200             |
| GET    | `/api/moods/patterns?days=30`      | —                                            | 200             |
| GET    | `/api/moods/streaks`               | —                                            | 200             |
| DELETE | `/api/moods/:id`                   | —                                            | 200/204         |
| PATCH  | `/api/moods/:id`                   | `{mood_score?, mood_label?, notes?}`         | 200             |

### Avatar Endpoints (Auth Required)

| Method | Endpoint                  | Body                      | Expected Status |
| ------ | ------------------------- | ------------------------- | --------------- |
| GET    | `/api/avatar`             | —                         | 200             |
| POST   | `/api/avatar`             | `{avatar3D}`              | 200             |
| GET    | `/api/avatar/preferences` | —                         | 200             |
| POST   | `/api/avatar/preferences` | `{expression, animation}` | 200             |

### Recommendation Endpoints (Auth Required)

| Method | Endpoint                              | Body                                         | Expected Status |
| ------ | ------------------------------------- | -------------------------------------------- | --------------- |
| POST   | `/api/recommendations`                | `{context: {mood_score, mood_label, notes}}` | 200             |
| POST   | `/api/recommendations/feedback`       | `{strategy_id, rating}`                      | 200             |
| GET    | `/api/recommendations/strategies`     | —                                            | 200             |
| GET    | `/api/recommendations/strategies/:id` | —                                            | 200             |
| GET    | `/api/recommendations/emotions`       | —                                            | 200             |
| GET    | `/api/recommendations/categories`     | —                                            | 200             |

### Anonymous Summary (No Auth)

| Method | Endpoint            | Body                           | Expected Status |
| ------ | ------------------- | ------------------------------ | --------------- |
| POST   | `/api/anon/summary` | `{messages: [{sender, text}]}` | 200             |

### Google OAuth

| Method | Endpoint                    | Expected                 |
| ------ | --------------------------- | ------------------------ |
| GET    | `/api/auth/google`          | Redirects to Google      |
| GET    | `/api/auth/google/callback` | Processes OAuth callback |

---

## 10. Microservice Testing

### Emotion Detection Service (Port 8001)

```powershell
# Analyze text emotion
curl -X POST http://localhost:8001/analyze `
  -H "Content-Type: application/json" `
  -d '{"text": "I am feeling really happy today!"}'
```

**Expected:** Returns `{sentiment, emotions, crisis_detected, ...}`.

```powershell
# Batch analysis
curl -X POST http://localhost:8001/batch-analyze `
  -H "Content-Type: application/json" `
  -d '{"texts": ["I feel great", "I am so angry", "Everything is hopeless"]}'
```

```powershell
# Service stats
curl http://localhost:8001/stats
```

### Crisis Detection Service (Port 8003)

```powershell
# Detect crisis from indicators
curl -X POST http://localhost:8003/detect `
  -H "Content-Type: application/json" `
  -d '{"user_id":"test-1","indicators":[{"type":"keyword","severity":"high","confidence":0.9,"trigger_text":"I want to end it all","timestamp":"2026-04-04T00:00:00Z"}]}'
```

**Expected:** Returns crisis level (LOW/MEDIUM/HIGH/CRITICAL), response plan, and emergency resources.

```powershell
# Get emergency resources by region
curl http://localhost:8003/resources/US
curl http://localhost:8003/resources/UK

# Active crises
curl http://localhost:8003/active-crises

# Service stats
curl http://localhost:8003/stats
```

### Recommendation Service (Port 8005)

```powershell
# Get recommendations for an emotion
curl -X POST http://localhost:8005/recommend `
  -H "Content-Type: application/json" `
  -d '{"emotion":"anxiety","context":{"situation":"exam stress"}}'
```

**Expected:** Returns personalized coping strategies ranked by relevance.

```powershell
# Browse strategies & categories
curl http://localhost:8005/strategies
curl http://localhost:8005/emotions
curl http://localhost:8005/categories
```

### Chatbot Service (Port 8004)

```powershell
# Start new conversation
curl -X POST http://localhost:8004/conversation/new `
  -H "Content-Type: application/json" `
  -d '{"user_id":"test-user"}'

# Send message
curl -X POST http://localhost:8004/chat `
  -H "Content-Type: application/json" `
  -d '{"session_id":"<session_id>","message":"I have been feeling stressed about my exams"}'

# Get conversation
curl http://localhost:8004/conversation/<session_id>

# Service stats
curl http://localhost:8004/stats
```

### Mood Analytics Service (Port 8002)

```powershell
# Log mood
curl -X POST http://localhost:8002/moods/log `
  -H "Content-Type: application/json" `
  -d '{"user_id":"test-user","mood_score":7,"mood_label":"happy","notes":"Good day"}'

# Get logs
curl http://localhost:8002/moods/test-user/logs?days=30

# Get trends
curl http://localhost:8002/moods/test-user/trends?days=30

# Get weekly score
curl http://localhost:8002/moods/test-user/weekly-score

# Get streaks
curl http://localhost:8002/moods/test-user/streaks
```

---

## 11. Security Testing

### 11a. Security Headers

```powershell
curl -I http://localhost:3000/
```

**Verify these headers:**

| Header                   | Expected Value                             |
| ------------------------ | ------------------------------------------ |
| `X-Content-Type-Options` | `nosniff`                                  |
| `X-Frame-Options`        | `DENY`                                     |
| `Referrer-Policy`        | `strict-origin-when-cross-origin`          |
| `Permissions-Policy`     | `camera=(), microphone=(), geolocation=()` |

In production (via Nginx), also verify:

| Header                      | Expected Value                                 |
| --------------------------- | ---------------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-XSS-Protection`          | `1; mode=block`                                |
| `Content-Security-Policy`   | Present                                        |

### 11b. HTTPS Redirect (Production)

```powershell
curl -I http://localhost/
```

**Expected:** `301` redirect to `https://`.

### 11c. Rate Limiting

```powershell
# Hammer auth endpoint — should get 429 after several requests
for ($i=0; $i -lt 20; $i++) {
  $status = (curl.exe -k -s -o NUL -w "%{http_code}" -X POST https://localhost/api/login `
    -H "Content-Type: application/json" `
    -d '{"email":"fake@test.com","password":"wrong"}')
  Write-Host "Request $i : $status"
}
```

**Expected:** First few return `401`, then `429 Too Many Requests`.

### 11d. JWT Token Validation

```powershell
# Access protected endpoint without token
curl http://localhost:5000/api/profile
# Expected: 401

# Access with invalid token
curl http://localhost:5000/api/profile -H "Authorization: Bearer invalid-token"
# Expected: 401

# Access with expired token (use an old JWT)
curl http://localhost:5000/api/profile -H "Authorization: Bearer <expired-jwt>"
# Expected: 401
```

### 11e. Input Validation

```powershell
# Register with weak password
curl -X POST http://localhost:5000/api/register `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"123"}'
# Expected: 400

# Register with invalid email
curl -X POST http://localhost:5000/api/register `
  -H "Content-Type: application/json" `
  -d '{"email":"not-an-email","password":"StrongPass123!"}'
# Expected: 400

# SQL injection attempt
curl -X POST http://localhost:5000/api/login `
  -H "Content-Type: application/json" `
  -d '{"email":"\" OR 1=1 --","password":"anything"}'
# Expected: 400 or 401 (NOT a successful login)
```

---

## 12. Performance & Stability Testing

### 12a. Resource Monitoring

```powershell
# CPU/memory snapshot
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

### 12b. Stability Check (Let Stack Run)

After completing all tests, leave the stack running and check periodically:

```powershell
docker compose ps --format "table {{.Name}}\t{{.Status}}"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

Watch for:

- Memory usage climbing steadily (indicates a leak)
- Any container restarting
- All services staying `healthy`

### 12c. ML Model Load Time

```powershell
# Check emotion detection model load time
docker logs mindsafe_emotion 2>&1 | Select-String "loaded|ready|startup"
```

First request after startup may be slow while models load (BERT, VADER). Subsequent requests should be fast.

### 12d. Monitoring Dashboards

| Tool                | Dev URL                  | Purpose                    |
| ------------------- | ------------------------ | -------------------------- |
| Grafana             | `http://localhost:3001`  | Dashboards & visualization |
| Prometheus          | `http://localhost:9090`  | Metrics scraping           |
| RabbitMQ Management | `http://localhost:15672` | Queue monitoring           |

---

## 13. Database Verification

### 13a. Check Tables

```powershell
# Development
docker exec -it mindsafe_postgres psql -U mindsafe_user -d mindsafe_db -c "\dt"

# Production
docker exec -it mindsafe_prod_postgres psql -U mindsafe_admin -d mindsafe_db -c "\dt"
```

**Expected tables:** `app_users`, `app_chat_messages`, `app_mood_entries`, `app_profiles`, `app_avatars`, `app_sessions`, `mood_logs`, `users`, `chat_messages`, `audit_logs`, `crisis_alerts`, `verification_tokens`, etc.

### 13b. Verify Data After Testing

```powershell
docker exec -it mindsafe_postgres psql -U mindsafe_user -d mindsafe_db -c "SELECT count(*) FROM app_users;"
docker exec -it mindsafe_postgres psql -U mindsafe_user -d mindsafe_db -c "SELECT count(*) FROM mood_logs;"
docker exec -it mindsafe_postgres psql -U mindsafe_user -d mindsafe_db -c "SELECT count(*) FROM app_chat_messages;"
```

### 13c. Seed Test Data

```powershell
cd src/backend
npm run seed
```

---

## 14. Production Testing

For full production testing with Docker Compose + Nginx + TLS, see [Test_MindSafe.md](Test_MindSafe.md).

### Quick Summary

```powershell
# Start production stack
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Verify all 17 containers
docker compose -f docker-compose.prod.yml --env-file .env.production ps

# Test through Nginx (HTTPS)
curl.exe -sk https://localhost/health
curl.exe -sk https://localhost/

# Run smoke tests through Nginx
$env:API_BASE_URL = "https://localhost"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
node tests/smoke/api-smoke.mjs
node tests/smoke/mood-api-smoke.mjs
```

---

## 15. Troubleshooting

### Build Fails

| Problem                                  | Solution                                                           |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `npm run build` fails with module errors | Run `npm install` first                                            |
| TypeScript errors                        | Check `jsconfig.json` path aliases                                 |
| Docker build fails                       | Verify Dockerfiles in `src/docker/` and base images are accessible |

### Services Won't Start

| Problem                     | Solution                                                  |
| --------------------------- | --------------------------------------------------------- |
| Port already in use         | Kill existing process: `npx kill-port 5000`               |
| Database connection refused | Ensure PostgreSQL is running and credentials match `.env` |
| Python service import error | Activate venv and install requirements                    |
| Redis connection refused    | Start Redis or Docker Redis container                     |

### Tests Fail

| Problem                              | Solution                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------- |
| Smoke test: connection refused       | Ensure API Gateway is running on expected port                                        |
| `401` on all authenticated endpoints | Token may have expired; re-login                                                      |
| `429` on login                       | Rate limited; wait 15 minutes or restart API Gateway                                  |
| Mood duplicate error                 | Same-day mood is appended, not replaced — this is correct behavior                    |
| Email verification missing           | In dev, token is returned in register response; in prod, check email or verify via DB |

### Docker Issues

```powershell
# Reset everything (CAUTION: destroys data)
docker compose down -v
docker compose up -d --build

# Rebuild specific service
docker compose build api_gateway
docker compose up -d api_gateway

# Check container logs
docker compose logs -f <service-name>
```

---

## Test Commands — Quick Reference

| Command                                                                       | What It Tests                                                          |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `npm run build`                                                               | Frontend compiles without errors                                       |
| `npm run lint`                                                                | ESLint passes                                                          |
| `npm run smoke:api`                                                           | Full API lifecycle (register → login → profile → chat → mood → avatar) |
| `npm run smoke:mood`                                                          | Mood logging same-day append behavior                                  |
| `npm run smoke:api:compose`                                                   | Docker build + API smoke test                                          |
| `npm run test:mood:service`                                                   | Mood analytics Python integration tests                                |
| `python -m pytest src/services/emotion_detection/test_emotion_detector.py -v` | Emotion detection unit tests                                           |
| `docker compose ps`                                                           | All containers healthy                                                 |
| `docker stats --no-stream`                                                    | Resource usage snapshot                                                |
