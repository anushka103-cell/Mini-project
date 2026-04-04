# MindSafe — Production Testing Guide

> All commands assume the prod stack is running via `docker compose -f docker-compose.prod.yml`.
> Nginx terminates TLS on `https://localhost` (port 443). Services are internal — test through Nginx or direct container ports.

---

## Step 0 — Verify All Services Are Up

```powershell
docker compose -f docker-compose.prod.yml --env-file .env.production ps --format "table {{.Name}}\t{{.Status}}"
```

All 17 containers should show `Up` / `healthy`.

---

## Step 1 — Health Checks (No Auth Needed)

Run these first. If any fail, stop and investigate before moving on.

```powershell
# Via Nginx (production path)
curl.exe -sk https://localhost/health

# Direct service health checks (ports not exposed to host — use docker exec)
docker exec mind-safe-api_gateway-1 wget -qO- http://localhost:5000/health   # API Gateway
docker exec mindsafe_prod_emotion curl -s http://localhost:8001/health           # Emotion Detection
docker exec mindsafe_prod_mood curl -s http://localhost:8002/health              # Mood Analytics
docker exec mindsafe_prod_crisis curl -s http://localhost:8003/health            # Crisis Detection
docker exec mind-safe-chatbot-1 curl -s http://localhost:8004/health          # Chatbot

# Frontend check
curl.exe -sk https://localhost/                 # Should return HTML
```

> **Note:** In the prod compose stack, only Nginx ports (80/443) are mapped to the host. Internal services must be tested via `docker exec`.

**Expected:** All return `{"status":"ok"}` or `{"status":"healthy"}`. Frontend returns HTML.

---

## Step 2 — Nginx & Security Headers

```powershell
curl.exe -k -I https://localhost/
```

**Verify these headers exist in response:**

| Header                      | Expected Value                                 |
| --------------------------- | ---------------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options`    | `nosniff`                                      |
| `X-Frame-Options`           | `DENY`                                         |
| `X-XSS-Protection`          | `1; mode=block`                                |
| `Content-Security-Policy`   | Present                                        |

**HTTP→HTTPS redirect:**

```powershell
curl.exe -I http://localhost/
```

Expected: `301` redirect to `https://`.

---

## Step 3 — Auth Flow: Register → Login → Get Token

### 3a. Register a Test User

```powershell
curl.exe -k -X POST https://localhost/api/register `
  -H "Content-Type: application/json" `
  -d '{"email":"testuser@mindsafe.local","password":"TestPass123!@","name":"Test User"}'
```

**Expected:** `201 Created` with `anonymizedUserId` and message. In production, the verification token is NOT returned (sent via email only).

> **Production Note:** New users must verify their email before login. In testing, verify manually:
>
> ```powershell
> docker exec mindsafe_prod_postgres psql -U mindsafe_admin -d mindsafe_db -c "UPDATE app_users SET is_verified = true WHERE is_verified = false;"
> ```

### 3b. Login

```powershell
curl.exe -k -X POST https://localhost/api/login `
  -H "Content-Type: application/json" `
  -d '{"email":"testuser@mindsafe.local","password":"TestPass123!@"}'
```

**Expected:** `200 OK` with JSON:

```json
{
  "token": "<accessToken>",
  "accessToken": "<JWT>",
  "refreshToken": "<JWT>",
  "expiresIn": "15m"
}
```

Save the token:

```powershell
$TOKEN = "<paste accessToken here>"
```

### 3c. Refresh Token

```powershell
curl.exe -k -X POST https://localhost/api/refresh-token `
  -H "Content-Type: application/json" `
  -d '{"refreshToken":"<paste refreshToken here>"}'
```

**Expected:** `200 OK` with message `"Refresh token has been rotated"` (one-time use — re-login for new tokens).

---

## Step 4 — Profile Endpoints (Auth Required)

```powershell
# Get profile
curl.exe -k https://localhost/api/profile `
  -H "Authorization: Bearer $TOKEN"

# Update profile (email and mobile are required fields)
curl.exe -k -X POST https://localhost/api/profile `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"email":"testuser@mindsafe.local","fullName":"Test User","mobile":"+1234567890","anonymousName":"BraveOwl42","anonymousMode":false}'
```

**Expected:** `200 OK` with `{"success":true}`.

---

## Step 5 — AI Chatbot (Core Feature)

### 5a. Send a Chat Message

```powershell
curl.exe -k -X POST https://localhost/api/chatbot `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"content":"I have been feeling stressed about my exams lately","style":"warm","use_name":true,"use_memory":true}'
```

**Expected:** `200 OK` with:

```json
{
  "session_id": "uuid",
  "response": "...",
  "emotion_detected": "anxiety",
  "emotional_intensity": 0.75,
  "crisis_level": "none",
  "coping_strategies": ["..."]
}
```

### 5b. Continue Conversation (same session)

```powershell
curl.exe -k -X POST https://localhost/api/chatbot `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"content":"Thank you, that really helped","session_id":"<session_id from 5a>","style":"warm"}'
```

> **Known Issue:** With multiple chatbot replicas behind Nginx load balancing, the session may route to a different instance and return `"Session not found"`. This is expected when sessions are stored in-memory per instance.

### 5c. Save and Retrieve Chat History

```powershell
# Save message
curl.exe -k -X POST https://localhost/api/chat `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"role":"user","content":"I feel stressed"}'

# Get history
curl.exe -k https://localhost/api/chat `
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 6 — Mood Tracking

### 6a. Log a Mood Entry

```powershell
curl.exe -k -X POST https://localhost/api/moods/log `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"mood_score":7,"mood_label":"happy","notes":"Good therapy session","emotion_scores":{"joy":0.8,"sadness":0.1},"activities":["exercise","reading"],"sleep_hours":7.5}'
```

**Expected:** `201 Created` with mood record.

### 6b. Query Mood Data

```powershell
# Mood history (last 30 days)
curl.exe -k "https://localhost/api/moods/logs?days=30" `
  -H "Authorization: Bearer $TOKEN"

# Trend analysis
curl.exe -k "https://localhost/api/moods/trends?days=30" `
  -H "Authorization: Bearer $TOKEN"

# Weekly mental health score
curl.exe -k https://localhost/api/moods/weekly-score `
  -H "Authorization: Bearer $TOKEN"

# Visualization data (for charts)
curl.exe -k "https://localhost/api/moods/visualization?days=90" `
  -H "Authorization: Bearer $TOKEN"

# Patterns (day-of-week, time-of-day)
curl.exe -k "https://localhost/api/moods/patterns?days=30" `
  -H "Authorization: Bearer $TOKEN"

# Logging streaks
curl.exe -k https://localhost/api/moods/streaks `
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 7 — Emotion Detection (Internal Microservice)

```powershell
# Analyze text emotion (use docker exec + python since ports are internal)
docker exec mindsafe_prod_emotion python -c "import requests; r = requests.post('http://localhost:8001/analyze', json={'text': 'I am feeling really happy today!'}); print(r.text)"
```

**Expected:** `200 OK` with emotion classification, sentiment scores, and crisis detection.

```powershell
# Service stats
docker exec mindsafe_prod_emotion curl -s http://localhost:8001/stats
```

---

## Step 8 — Crisis Detection (Internal Microservice)

```powershell
# Detect crisis from indicators (use docker exec since port is internal)
docker exec mindsafe_prod_crisis python -c "import requests; r = requests.post('http://localhost:8003/detect', json={'user_id':'test-user-1','indicators':[{'type':'keyword','severity':'low','confidence':0.3,'trigger_text':'feeling down','timestamp':'2026-04-04T00:00:00Z'}]}); print(r.text)"

# Get emergency resources
docker exec mindsafe_prod_crisis curl -s http://localhost:8003/resources/US

# View active crises
docker exec mindsafe_prod_crisis curl -s http://localhost:8003/active-crises

# Service stats
docker exec mindsafe_prod_crisis curl -s http://localhost:8003/stats
```

---

## Step 9 — Recommendation Engine

```powershell
# Get personalized recommendations (via API gateway)
curl.exe -k -X POST https://localhost/api/recommendations `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"context":{"mood_score":3,"mood_label":"Sad","notes":"feeling down"}}'

# Direct on service (optional)
docker exec mindsafe_prod_recommendation python -c "import requests; r = requests.post('http://localhost:8005/recommend', json={'emotion':'anxiety','context':{'situation':'exam stress'}}); print(r.text[:500])"

# Browse strategy library
docker exec mindsafe_prod_recommendation curl -s http://localhost:8005/strategies

# List supported emotions
docker exec mindsafe_prod_recommendation curl -s http://localhost:8005/emotions
```

> **Note:** The `context` field must be a dict (e.g., `{"situation": "exam stress"}`), not a plain string.

---

## Step 10 — Avatar Endpoints

```powershell
# Get avatar
curl.exe -k https://localhost/api/avatar `
  -H "Authorization: Bearer $TOKEN"

# Set avatar
curl.exe -k -X POST https://localhost/api/avatar `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"avatar3D":"https://example.com/my-avatar.vrm"}'

# Save avatar preferences
curl.exe -k -X POST https://localhost/api/avatar/preferences `
  -H "Authorization: Bearer $TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"expression":"happy","animation":"wave"}'

# Get avatar preferences
curl.exe -k https://localhost/api/avatar/preferences `
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 11 — Anonymous Chat Summary (No Auth)

```powershell
curl.exe -k -X POST https://localhost/api/anon/summary `
  -H "Content-Type: application/json" `
  -d '{"messages":[{"sender":"me","text":"I felt anxious"},{"sender":"partner","text":"That is normal"},{"sender":"me","text":"Thanks for listening"}]}'
```

**Expected:** `200 OK` with AI-generated session summary from Groq LLM.

> **Note:** Messages must use `sender` (`"me"` / `"partner"`) and `text` fields — not `role`/`content`. Requires `GROQ_API_KEY` set in `.env.production`.

---

## Step 12 — Rate Limiting Verification

```powershell
# Hammer auth endpoint — should get 429 after 5 requests/second
for ($i=0; $i -lt 20; $i++) {
  $status = (curl.exe -k -s -o NUL -w "%{http_code}" -X POST https://localhost/api/login `
    -H "Content-Type: application/json" `
    -d '{"email":"fake@test.com","password":"wrong"}')
  Write-Host "Request $i : $status"
}
```

**Expected:** First few return `401` (wrong creds), then `429 Too Many Requests`.

---

## Step 13 — Run Existing Smoke Tests

```powershell
# From project root (use HTTPS via Nginx, disable TLS for self-signed cert)
$env:API_BASE_URL = "https://localhost"
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
node tests/smoke/api-smoke.mjs
node tests/smoke/mood-api-smoke.mjs
```

These automated tests cover: registration, login, profile, chat, mood logging, avatar, and error handling.

> **Expected Failures in Production:**
>
> - `auth register returns verification token` — Production does NOT leak verification tokens (security by design)
> - `auth login valid` / `auth token issued` — Freshly registered users need email verification; the smoke test cannot auto-verify in production mode
> - Run smoke tests **before** Step 12 (rate limiting), otherwise the login rate limit (10 per 15 min) will block login attempts

---

## Step 14 — Frontend UI Walkthrough

Open in browser (accept self-signed cert warning):

| URL                        | What to Test                              |
| -------------------------- | ----------------------------------------- |
| `https://localhost/signup` | Create a new account                      |
| `https://localhost/login`  | Login with credentials                    |
| `https://localhost/`       | Dashboard loads, sidebar navigation works |
| Chat page                  | Send messages, verify AI responses appear |
| Mood tracker               | Log a mood, check chart/streak displays   |
| Profile page               | Update name, toggle anonymous mode        |
| Avatar page                | 3D avatar renders, change expression      |

---

## Step 15 — Monitoring Dashboards

| Tool           | URL                                                | Credentials                 |
| -------------- | -------------------------------------------------- | --------------------------- |
| **Grafana**    | `http://localhost:3001` (dev) or via Nginx in prod | admin / `$GRAFANA_PASSWORD` |
| **Prometheus** | `http://localhost:9090` (dev)                      | N/A                         |
| **RabbitMQ**   | `http://localhost:15672` (dev)                     | `$MQ_USER` / `$MQ_PASSWORD` |

In prod, these ports are not exposed. Access via `docker exec`:

```powershell
docker exec -it mindsafe_prod_grafana wget -qO- http://localhost:3000/api/health
docker exec -it mindsafe_prod_prometheus wget -qO- http://localhost:9090/-/healthy
```

---

## Step 16 — Database Verification

```powershell
docker exec -it mindsafe_prod_postgres psql -U mindsafe_admin -d mindsafe_db -c "\dt"
```

**Expected tables (22 total):** `app_users`, `app_chat_messages`, `app_mood_entries`, `app_profiles`, `app_avatars`, `app_sessions`, `mood_logs`, `users`, `chat_messages`, `audit_logs`, `crisis_alerts`, `verification_tokens`, etc.

```powershell
# Check data after testing
docker exec -it mindsafe_prod_postgres psql -U mindsafe_admin -d mindsafe_db -c "SELECT count(*) FROM app_users;"
docker exec -it mindsafe_prod_postgres psql -U mindsafe_admin -d mindsafe_db -c "SELECT count(*) FROM mood_logs;"
docker exec -it mindsafe_prod_postgres psql -U mindsafe_admin -d mindsafe_db -c "SELECT count(*) FROM app_chat_messages;"
```

---

## Step 17 — Stability Check (Let It Run)

After completing Steps 1-16, leave the stack running and check hourly:

```powershell
# Quick health check script — run every 30 minutes
docker compose -f docker-compose.prod.yml --env-file .env.production ps --format "table {{.Name}}\t{{.Status}}"
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```

Watch for:

- Memory usage climbing steadily (should now be stable after the leak fixes)
- Any container restarting
- All services staying `healthy`

---

## Quick Reference: Error Codes

| Code  | Meaning                              |
| ----- | ------------------------------------ |
| `200` | Success                              |
| `201` | Created                              |
| `204` | No content (deleted)                 |
| `400` | Bad request (validation error)       |
| `401` | Unauthorized (missing/expired token) |
| `403` | Forbidden                            |
| `404` | Not found                            |
| `409` | Conflict (duplicate email)           |
| `429` | Rate limited                         |
| `500` | Server error                         |
