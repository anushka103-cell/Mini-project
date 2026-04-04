# MindSafe REST API Documentation

> **Base URL** — `http://localhost:5000` (local) or your deployed domain  
> **Auth** — Bearer JWT in the `Authorization` header  
> **Content-Type** — `application/json` for all requests/responses  
> **OpenAPI Spec** — [`docs/api/openapi.yaml`](openapi.yaml)

---

## Table of Contents

1. [Authentication Flow](#1-authentication-flow)
2. [Error Handling](#2-error-handling)
3. [Endpoints](#3-endpoints)
   - [Health](#31-health)
   - [Authentication](#32-authentication)
   - [AI Chatbot](#33-ai-chatbot)
   - [Mood Tracking](#34-mood-tracking)
   - [Profile](#35-profile)
   - [Avatar](#36-avatar)
4. [Internal Microservices](#4-internal-microservices)
   - [Emotion Detection](#41-emotion-detection-port-8001)
   - [Mood Analytics](#42-mood-analytics-port-8002)
   - [Crisis Detection](#43-crisis-detection-port-8003)
   - [Chatbot Engine](#44-chatbot-engine-port-8004)
5. [Rate Limits & Timeouts](#5-rate-limits--timeouts)
6. [Validation Rules](#6-validation-rules)

---

## 1. Authentication Flow

```
┌──────────┐       POST /api/register        ┌──────────────┐
│  Client   │ ──────────────────────────────▶ │  API Gateway  │
│           │ ◀────── 201 + userId ────────── │               │
│           │                                 │  (Express 5)  │
│           │       POST /api/login           │               │
│           │ ──────────────────────────────▶ │               │
│           │ ◀── 200 { accessToken,          │               │
│           │        refreshToken }  ── ───── │               │
│           │                                 └──────────────┘
│           │  Authorization: Bearer <token>
│           │ ──────────────────────────────▶  Protected endpoints
│           │
│           │       POST /api/refresh-token
│           │ ──────────────────────────────▶  New token pair
└──────────┘
```

- **Access token** expires in **15 minutes** (HS512-signed JWT)
- **Refresh token** expires in **7 days**
- **bcrypt** with 12 rounds for password hashing
- On logout, the server-side session is revoked immediately

---

## 2. Error Handling

All errors follow a consistent JSON format:

```json
{
  "message": "Human-readable error description"
}
```

| Status | Meaning | When |
|--------|---------|------|
| `400` | Bad Request | Validation failure (missing fields, format errors) |
| `401` | Unauthorized | Missing/expired/invalid token |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Route or resource doesn't exist |
| `409` | Conflict | Duplicate resource (e.g., email already registered) |
| `502` | Bad Gateway | Downstream microservice unavailable |
| `504` | Gateway Timeout | Downstream microservice timed out |
| `500` | Internal Error | Unexpected server error |

---

## 3. Endpoints

### 3.1 Health

#### `GET /`

Root info endpoint (no auth required).

```bash
curl http://localhost:5000/
```

```json
{ "message": "MindSafe Backend Running" }
```

#### `GET /health`

Health check.

```bash
curl http://localhost:5000/health
```

```json
{ "status": "ok" }
```

---

### 3.2 Authentication

#### `POST /api/register`

Create a new account.

```bash
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "MySecureP@ss1",
    "name": "Priya Sharma"
  }'
```

**Response** `201`
```json
{
  "message": "Registration successful. Check your email.",
  "userId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Errors:**
- `400` — Invalid email format or password under 8 characters
- `409` — Email already registered

---

#### `POST /api/login`

Login with email and password.

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "MySecureP@ss1"
  }'
```

**Response** `200`
```json
{
  "token": "eyJhbGciOiJIUzUxMiIs...",
  "accessToken": "eyJhbGciOiJIUzUxMiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
  "expiresIn": "15m",
  "anonymizedUserId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "analyticsSubjectId": "anon_abc123",
  "role": "user"
}
```

---

#### `POST /api/verify-email`

Verify email address with the token from the verification email.

```bash
curl -X POST http://localhost:5000/api/verify-email \
  -H "Content-Type: application/json" \
  -d '{ "token": "abcdef1234567890abcdef" }'
```

**Validation:** Token must be at least 16 characters.

---

#### `POST /api/email/request-verification` 🔒

Resend verification email. Requires authentication.

```bash
curl -X POST http://localhost:5000/api/email/request-verification \
  -H "Authorization: Bearer <token>"
```

---

#### `POST /api/mobile/request-otp`

Request OTP for mobile login.

```bash
curl -X POST http://localhost:5000/api/mobile/request-otp \
  -H "Content-Type: application/json" \
  -d '{ "mobile": "+919876543210" }'
```

**Validation:** Mobile must match `^\+?\d{10,15}$`

---

#### `POST /api/mobile/login-otp`

Login using mobile + OTP.

```bash
curl -X POST http://localhost:5000/api/mobile/login-otp \
  -H "Content-Type: application/json" \
  -d '{ "mobile": "+919876543210", "otp": "123456" }'
```

**Validation:** OTP must be exactly 6 digits.  
**Response:** Same as `/api/login`.

---

#### `POST /api/mobile/verify-otp` 🔒

Verify mobile number on an authenticated account.

```bash
curl -X POST http://localhost:5000/api/mobile/verify-otp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "mobile": "+919876543210", "otp": "123456" }'
```

---

#### `POST /api/refresh-token`

Exchange a refresh token for a new access + refresh token pair.

```bash
curl -X POST http://localhost:5000/api/refresh-token \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "dGhpcyBpcyBhIHJlZnJl..." }'
```

**Response:** Same shape as `/api/login`.

---

#### `POST /api/logout` 🔒

Revoke the current session.

```bash
curl -X POST http://localhost:5000/api/logout \
  -H "Authorization: Bearer <token>"
```

---

#### `GET /api/auth/google`

Redirect to Google OAuth consent screen. Open in a browser, not `curl`.

#### `GET /api/auth/google/callback?code=...`

Callback from Google. On success, redirects to `{frontend}/auth/callback?token={accessToken}`.

---

### 3.3 AI Chatbot

#### `POST /api/chatbot` 🔒

Send a message to the AI companion. Proxied to the internal Chatbot service.

```bash
curl -X POST http://localhost:5000/api/chatbot \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "I have been feeling really anxious about my exams",
    "style": "warm",
    "use_name": true,
    "use_memory": true
  }'
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `content` | string | ✅ | — | User message (max 5000 chars) |
| `session_id` | string | — | auto | Existing session to continue |
| `style` | string | — | `balanced` | `warm`, `balanced`, or `concise` |
| `use_name` | boolean | — | `true` | Address user by name |
| `use_memory` | boolean | — | `true` | Remember conversation context |

**Response** `200`
```json
{
  "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "message_id": "msg_001",
  "response": "I hear you, Priya. Exam anxiety is really common and it's okay to feel this way...",
  "emotion_detected": "anxiety",
  "emotional_intensity": 0.72,
  "crisis_level": "low",
  "crisis_resources": [],
  "coping_strategies": [
    "Try the 4-7-8 breathing technique",
    "Break study sessions into 25-minute blocks"
  ],
  "requires_escalation": false,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Errors:**
- `400` — `content` is required
- `502` — Chatbot service unavailable
- `504` — Chatbot request timed out (20s limit)

---

#### `POST /api/chat` 🔒

Persist a chat message to the database.

```bash
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "I have been feeling really anxious about my exams"
  }'
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `role` | string | ✅ | `user`, `ai`, `assistant`, or `system` |
| `content` | string | ✅ | Max 5000 characters |

---

#### `GET /api/chat` 🔒

Retrieve chat message history.

```bash
curl http://localhost:5000/api/chat \
  -H "Authorization: Bearer <token>"
```

**Response** `200`
```json
{
  "messages": [
    {
      "role": "user",
      "content": "I have been feeling really anxious about my exams",
      "timestamp": "2025-01-15T10:30:00Z"
    },
    {
      "role": "ai",
      "content": "I hear you. Exam anxiety is really common...",
      "timestamp": "2025-01-15T10:30:02Z"
    }
  ]
}
```

---

### 3.4 Mood Tracking

#### `POST /api/moods/log` 🔒

Log today's mood entry.

```bash
curl -X POST http://localhost:5000/api/moods/log \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "mood_score": 7,
    "mood_label": "happy",
    "notes": "Had a good therapy session today",
    "emotion_scores": { "joy": 0.8, "sadness": 0.1 }
  }'
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `mood_score` | integer | ✅ | 1–10 |
| `mood_label` | string | — | Free text label |
| `notes` | string | — | Optional journal note |
| `emotion_scores` | object | — | `{ emotion: score }` pairs |
| `logged_at` | ISO datetime | — | Defaults to now |

**Response** `201`
```json
{
  "id": 42,
  "user_id": "anon_abc123",
  "logged_date": "2025-01-15",
  "mood_score": 7,
  "mood_label": "happy",
  "notes": "Had a good therapy session today",
  "emotion_scores": { "joy": 0.8, "sadness": 0.1 },
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

---

#### `GET /api/moods/logs` 🔒

Get mood history. Optionally pass `?days=N` (default 30, max 365).

```bash
curl "http://localhost:5000/api/moods/logs?days=14" \
  -H "Authorization: Bearer <token>"
```

---

#### `GET /api/moods/trends` 🔒

Mood trend analysis over a time window.

```bash
curl "http://localhost:5000/api/moods/trends?days=30" \
  -H "Authorization: Bearer <token>"
```

**Response** `200`
```json
{
  "user_id": "anon_abc123",
  "window_days": 30,
  "trend_direction": "improving",
  "slope": 0.15,
  "points": [
    { "date": "2025-01-01", "score": 5 },
    { "date": "2025-01-15", "score": 7 }
  ],
  "top_emotions": [
    { "emotion": "joy", "average": 0.72 },
    { "emotion": "anxiety", "average": 0.35 }
  ]
}
```

---

#### `GET /api/moods/weekly-score` 🔒

Composite weekly mental health score.

```bash
curl http://localhost:5000/api/moods/weekly-score \
  -H "Authorization: Bearer <token>"
```

**Response** `200`
```json
{
  "user_id": "anon_abc123",
  "week_start": "2025-01-13",
  "week_end": "2025-01-19",
  "entries_count": 5,
  "average_mood": 6.8,
  "consistency_ratio": 0.85,
  "stability_score": 0.72,
  "weekly_mental_health_score": 73.2
}
```

---

#### `GET /api/moods/visualization` 🔒

Chart-ready data for mood visualization. Optionally pass `?days=N` (default 90).

```bash
curl "http://localhost:5000/api/moods/visualization?days=90" \
  -H "Authorization: Bearer <token>"
```

**Response** `200`
```json
{
  "user_id": "anon_abc123",
  "labels": ["2025-01-01", "2025-01-02", "..."],
  "mood_scores": [5, 6, 7, 6, 8],
  "moving_avg_7d": [null, null, null, null, null, null, 6.14],
  "weekly_scores": [
    { "week_start": "2025-01-06", "score": 68.5 }
  ],
  "emotion_series": {
    "joy": [0.5, 0.6, 0.8],
    "sadness": [0.3, 0.2, 0.1]
  }
}
```

---

### 3.5 Profile

#### `GET /api/profile` 🔒

Get the authenticated user's profile.

```bash
curl http://localhost:5000/api/profile \
  -H "Authorization: Bearer <token>"
```

**Response** `200`
```json
{
  "profile": {
    "fullName": "Priya Sharma",
    "email": "user@example.com",
    "mobile": "+919876543210",
    "anonymousName": "StarGazer42",
    "anonymousMode": false
  }
}
```

---

#### `POST /api/profile` 🔒

Create or update profile.

```bash
curl -X POST http://localhost:5000/api/profile \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Priya Sharma",
    "email": "user@example.com",
    "mobile": "+919876543210",
    "anonymousName": "StarGazer42",
    "anonymousMode": false
  }'
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `fullName` | string | ✅ | 2–100 characters |
| `email` | string | ✅ | Valid email format |
| `mobile` | string | ✅ | 10–15 digits, optional `+` prefix |
| `anonymousName` | string | — | Max 80 characters |
| `anonymousMode` | boolean | — | Enable anonymous mode |

---

#### `DELETE /api/profile` 🔒

Permanently delete account and all associated data (GDPR right to erasure).

```bash
curl -X DELETE http://localhost:5000/api/profile \
  -H "Authorization: Bearer <token>"
```

> ⚠️ **Irreversible.** Deletes user account, profile, chat history, mood data, and all records.

---

### 3.6 Avatar

#### `GET /api/avatar` 🔒

Get the user's 3D avatar URL.

```bash
curl http://localhost:5000/api/avatar \
  -H "Authorization: Bearer <token>"
```

**Response** `200`
```json
{
  "avatar3D": "https://models.readyplayer.me/abc123.glb"
}
```

---

#### `POST /api/avatar` 🔒

Save a 3D avatar URL.

```bash
curl -X POST http://localhost:5000/api/avatar \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "avatar3D": "https://models.readyplayer.me/abc123.glb" }'
```

**Validation:** Must be a valid HTTP/HTTPS URL, max 2048 characters.

---

## 4. Internal Microservices

These services run on internal Docker ports and are **not exposed publicly**. The API Gateway proxies relevant requests to them.

### 4.1 Emotion Detection (port 8001)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/analyze` | Analyze text for sentiment, emotion, and crisis signals |
| `POST` | `/batch-analyze` | Batch analyze multiple texts |
| `GET` | `/stats` | Service statistics |

**`POST /analyze`**
```json
// Request
{
  "text": "I feel so hopeless and I don't know what to do",
  "user_id": "anon_abc123",
  "conversation_id": "conv_001"
}

// Response
{
  "text": "I feel so hopeless and I don't know what to do",
  "sentiment": {
    "sentiment": "VERY_NEGATIVE",
    "score": -0.89,
    "confidence": 0.94
  },
  "emotion": {
    "emotion": "SADNESS",
    "confidence": 0.87,
    "all_emotions": {
      "SADNESS": 0.87,
      "FEAR": 0.45,
      "ANGER": 0.12,
      "JOY": 0.02
    }
  },
  "crisis_detection": {
    "is_crisis": true,
    "crisis_level": "HIGH",
    "crisis_keywords": ["hopeless"],
    "risk_score": 0.78,
    "reason": "Keyword 'hopeless' detected with very negative sentiment"
  },
  "language": "en",
  "processing_time_ms": 42.5,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**Enums:**
- Sentiments: `VERY_NEGATIVE`, `NEGATIVE`, `NEUTRAL`, `POSITIVE`, `VERY_POSITIVE`
- Emotions: `JOY`, `SADNESS`, `ANGER`, `FEAR`, `SURPRISE`, `DISGUST`, `TRUST`, `ANTICIPATION`
- Crisis levels: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`

---

### 4.2 Mood Analytics (port 8002)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/moods/log` | Log mood entry |
| `GET` | `/moods/{user_id}/logs` | Get user's mood history |
| `GET` | `/moods/{user_id}/trends` | Trend analysis |
| `GET` | `/moods/{user_id}/weekly-score` | Weekly composite score |
| `GET` | `/moods/{user_id}/visualization` | Chart-ready data |

> All GET endpoints accept `?days=N` query parameter.

---

### 4.3 Crisis Detection (port 8003)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/detect` | Evaluate crisis indicators |
| `GET` | `/resources/{region}` | Regional emergency resources |
| `GET` | `/active-crises` | All currently active crises |
| `POST` | `/resolve/{crisis_id}` | Mark crisis as resolved |
| `GET` | `/history/{user_id}` | User's crisis history |
| `GET` | `/stats` | Service statistics |
| `WS` | `/ws/monitor/{user_id}` | Real-time crisis monitoring |

**`POST /detect`**
```json
// Request
{
  "user_id": "anon_abc123",
  "indicators": [
    { "type": "keyword", "value": "hopeless", "severity": "high" },
    { "type": "emotion", "value": "SADNESS", "severity": "high" }
  ],
  "context": "User expressed despair during chatbot conversation",
  "recent_mood_trend": "declining"
}

// Response
{
  "crisis_id": "crisis_a1b2c3d4",
  "user_id": "anon_abc123",
  "detected_level": "HIGH",
  "actions_taken": ["emergency_resources_shown", "support_line_suggested"],
  "resources_provided": [
    { "name": "iCall", "phone": "9152987821", "available": "24/7" },
    { "name": "Vandrevala Foundation", "phone": "9999666555", "available": "24/7" }
  ],
  "notifications_sent": ["system_alert"],
  "escalation_status": "monitoring",
  "follow_up_scheduled": "2025-01-15T16:30:00Z",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**WebSocket `/ws/monitor/{user_id}`** — Streams real-time crisis level updates:
```json
{ "crisis_level": "HIGH", "timestamp": "2025-01-15T10:30:00Z" }
```

---

### 4.4 Chatbot Engine (port 8004)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/chat` | Generate AI response |
| `POST` | `/conversation/new` | Create new conversation session |
| `GET` | `/conversation/{session_id}` | Get conversation history |
| `POST` | `/conversation/{session_id}/close` | Close a conversation |
| `GET` | `/stats` | Service statistics |

---

## 5. Rate Limits & Timeouts

| Endpoint | Timeout | Notes |
|----------|---------|-------|
| `POST /api/chatbot` | 20 seconds | AI response generation |
| Mood proxy endpoints | 10 seconds | Analytics queries |
| General API | — | No global rate limit yet |

---

## 6. Validation Rules

| Field | Rule |
|-------|------|
| `email` | Must match standard email format |
| `password` | Minimum 8 characters (registration) |
| `token` (email verify) | Minimum 16 characters |
| `mobile` | 10–15 digits, optional `+` prefix |
| `otp` | Exactly 6 digits |
| `content` (chat) | Required, max 5000 characters |
| `role` (chat) | One of: `user`, `ai`, `assistant`, `system` |
| `mood_score` | Integer 1–10 |
| `fullName` | 2–100 characters |
| `avatar3D` | Valid HTTP(S) URL, max 2048 characters |
| `anonymousName` | Max 80 characters |

---

## Appendix: Architecture Overview

```
Client (Next.js)
  │
  ▼
API Gateway (Express :5000)
  │
  ├──▶ PostgreSQL 15 (users, profiles, sessions, chats)
  ├──▶ Redis 7 (session cache)
  ├──▶ RabbitMQ 3.12 (async jobs)
  │
  ├──proxy──▶ Chatbot Service (:8004)  ──▶ Emotion Detection (:8001)
  ├──proxy──▶ Mood Analytics (:8002)
  └──proxy──▶ Crisis Detection (:8003)
```

🔒 = Requires `Authorization: Bearer <token>` header
