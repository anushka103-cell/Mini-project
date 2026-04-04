# MindSafe: Scalable AI Mental Health Platform Architecture

**Privacy-First | GDPR/HIPAA Compliant | Cloud-Native | Enterprise-Grade**

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend Architecture](#backend-architecture)
4. [AI Model Pipeline](#ai-model-pipeline)
5. [Database Schema](#database-schema)
6. [API Structure](#api-structure)
7. [Security & Privacy](#security--privacy)
8. [Deployment & Scaling](#deployment--scaling)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Web Browser  │  │ Mobile App   │  │ Desktop App  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────▲─────────────────────────────────────┘
                         │ HTTPS/WSS
┌────────────────────────▼─────────────────────────────────────┐
│                  API GATEWAY LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Rate Limiting │ Auth │ Logging │ CORS │ Metrics      │ │
│  └─────────────────────────────────────────────────────────┘ │
└────────────────────────▲─────────────────────────────────────┘
         │               │               │               │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ User    │     │ Emotion │     │ Mood    │     │ Crisis  │
    │ Service │     │ Service │     │ Service │     │ Service │
    └────┬────┘     └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │               │
    ┌────▼──────────────────────────────────────────────────┐
    │          DATA LAYER                                   │
    │  ┌──────────────┐  ┌──────────┐  ┌──────────────┐   │
    │  │ PostgreSQL   │  │  Redis   │  │  Vec DB      │   │
    │  │ (Encrypted)  │  │ (Cache)  │  │ (Embeddings) │   │
    │  └──────────────┘  └──────────┘  └──────────────┘   │
    └────────────────────────────────────────────────────────┘
         │               │               │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ Backup  │     │ Archive │     │ Audit   │
    │ Storage │     │ S3      │     │ Log     │
    └─────────┘     └─────────┘     └─────────┘
```

---

## Frontend Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **State Management**: TanStack Query (data) + Zustand (UI)
- **Real-time**: WebSocket via Socket.io
- **Styling**: Tailwind CSS + Shadcn/ui
- **Authentication**: JWT + HTTP-only cookies
- **Encryption**: libsodium.js (client-side sensitive data)

### Component Structure

```
src/app/
├── (auth)/
│   ├── login/
│   │   ├── page.js
│   │   └── components/
│   │       ├── GoogleOAuthButton.js
│   │       ├── EmailForm.js
│   │       └── MFAStep.js
│   ├── signup/
│   ├── verify-email/
│   └── reset-password/
├── (protected)/
│   ├── dashboard/          # Main hub
│   │   ├── page.js
│   │   ├── MoodTrends.js
│   │   ├── QuickInsights.js
│   │   └── RecommendedActions.js
│   ├── ai-companion/       # Chat interface
│   │   ├── page.js
│   │   ├── ChatWindow.js
│   │   ├── ConversationHistory.js
│   │   └── EmojiReactions.js
│   ├── mood-tracker/       # Daily mood log
│   │   ├── page.js
│   │   ├── MoodSelector.js
│   │   ├── ContextForm.js
│   │   └── HistoryCalendar.js
│   ├── insights/           # Analytics
│   │   ├── page.js
│   │   ├── EmotionTrends.js
│   │   ├── CopingStrategies.js
│   │   └── PatternAnalysis.js
│   ├── crisis-resources/   # Emergency support
│   │   ├── page.js
│   │   ├── EmergencyContacts.js
│   │   └── CrisisHotlines.js
│   └── settings/
│       ├── page.js
│       ├── Privacy.js
│       ├── Notifications.js
│       └── DataExport.js
├── api/
│   ├── auth/
│   ├── user/
│   ├── mood/
│   ├── chat/
│   └── analytics/
└── components/
    ├── AuthGuard.js
    ├── PrivacyBanner.js
    ├── ConsentManager.js
    └── DataProcessor.js

src/hooks/
├── useAuth.js
├── useMoodTracker.js
├── useEmotionAnalysis.js
├── useEncryption.js
└── usePrivacy.js

src/lib/
├── api.js
├── encryption.js
├── dataAnonymizer.js
└── privacyUtils.js
```

### Key Features

**Privacy-First UI:**

- Automatic session timeout (15 min inactivity)
- One-click data export (GDPR right to portability)
- Clear consent dialogs before any data collection
- Visual encryption indicators on sensitive fields
- Incognito mode toggle (data not stored locally)

**Real-time Updates:**

- WebSocket connection for live chatbot responses
- Live mood notifications from AI recommendations
- Real-time crisis alerts for caregivers (with consent)

---

## Backend Architecture

### Microservices Design

```yaml
Services:
  api_gateway:
    - Node.js + Express
    - Port: 5000
    - Responsibilities:
        - Request routing & rate limiting
        - JWT validation & session management
        - Request/response encryption
        - Audit logging
        - Health checks

  user_service:
    - Node.js + Express
    - Port: 5001
    - Responsibilities:
        - User registration & authentication
        - Profile management
        - Consent & privacy settings
        - OAuth provider integration (Google, Apple, Microsoft)
        - MFA/2FA management

  emotion_detection_service:
    - Python + FastAPI
    - Port: 8001
    - Responsibilities:
        - NLP emotion classification (RoBERTa)
        - Sentiment analysis
        - Emotion intensity scoring
        - Emotion trend analysis
        - Response: { emotion, confidence, intensity, suggested_coping }

  mood_analytics_service:
    - Python + FastAPI
    - Port: 8002
    - Responsibilities:
        - Mood pattern detection (time-series analysis)
        - Trend forecasting (LSTM)
        - Personalized insights generation
        - Correlation analysis (mood vs. activities)
        - Response: { trend, forecast, insights, correlation_score }

  crisis_detection_service:
    - Python + FastAPI
    - Port: 8003
    - Responsibilities:
        - Risk assessment via keyword matching + ML
        - Suicide/self-harm risk scoring
        - Crisis resource recommendations
        - Emergency contact alerts (with consent)
        - Response: { risk_level, resources, alert_needed }

  recommendation_engine:
    - Python + FastAPI
    - Port: 8004
    - Responsibilities:
        - Coping strategy recommendations (collaborative filtering)
        - Activity suggestions based on mood/emotion
        - Therapy resource matching
        - Personalization based on user profile
        - A/B testing framework

  notification_service:
    - Node.js + Bull (job queue)
    - Port: 5002
    - Responsibilities:
        - Email notifications (Resend API)
        - SMS alerts (Twilio)
        - Push notifications (FCM)
        - Scheduled daily/weekly digests
        - No PII in notification bodies

  analytics_service:
    - Python + FastAPI
    - Port: 8005
    - Responsibilities:
        - Event collection & aggregation
        - Anonymized metrics
        - Trend analysis
        - GDPR-compliant logging
        - Dashboard data aggregation
```

### Technology Stack

| Component         | Technology           | Rationale                                    |
| ----------------- | -------------------- | -------------------------------------------- |
| API Gateway       | Node.js + Express    | Fast, lightweight, mature ecosystem          |
| Microservices     | Python + FastAPI     | ML/AI native, async support                  |
| Message Queue     | RabbitMQ + Bull      | Async tasks, job scheduling, resilience      |
| Cache             | Redis                | Session store, rate limiting, real-time data |
| Monitoring        | Prometheus + Grafana | Industry standard observability              |
| Logging           | ELK Stack + Winston  | Centralized structured logs                  |
| Secret Management | HashiCorp Vault      | Encrypted credential rotation                |

### Request Flow

```
User Request
    ↓
API Gateway (auth, rate limit, logging)
    ↓
Route to Microservice
    ↓
Service Logic
    ↓
Query Data Layer (PostgreSQL/Redis/VectorDB)
    ↓
Response to Gateway
    ↓
Encrypt Sensitive Fields
    ↓
Return to Client
```

---

## AI Model Pipeline

### Emotion Detection Pipeline

**Input:** User text message from chat

**Processing:**

```python
# 1. Text Preprocessing
def preprocess(text):
    # Remove PII (emails, phone numbers)
    text = anonymize_pii(text)
    # Normalize text (lowercase, remove extra spaces)
    text = normalize(text)
    # Tokenization
    tokens = tokenizer(text)
    return tokens

# 2. Emotion Classification (RoBERTa)
model = AutoModelForSequenceClassification.from_pretrained(
    "j-hartmann/emotion-english-roberta-large"
)
emotions = ["sadness", "joy", "love", "anger", "fear", "surprise"]
result = model(tokens)
emotion_scores = softmax(result.logits)

# 3. Intensity Scoring
def calculate_intensity(text, emotion_scores):
    # Lexicon-based intensity (caps, repetition, punctuation)
    intensity = analyze_emphasis(text)
    # Model-based confidence as proxy for intensity
    max_confidence = emotion_scores.max()
    final_intensity = (intensity * 0.3) + (max_confidence * 0.7)
    return final_intensity

# 4. Response Generation
response = {
    "emotion": emotions[argmax(emotion_scores)],
    "confidence": max(emotion_scores),
    "intensity": final_intensity,
    "all_emotions": dict(zip(emotions, emotion_scores)),
    "suggested_coping": get_coping_strategies(emotion),
    "timestamp": utcnow(),
    "user_id_hash": hash_pii(user_id)  # Not raw user ID
}
```

**Output:**

```json
{
  "emotion": "sadness",
  "confidence": 0.92,
  "intensity": 0.78,
  "suggested_coping": [
    "breathing exercises",
    "journaling",
    "reach out to friend"
  ],
  "timestamp": "2026-03-30T14:23:00Z"
}
```

### Mood Analytics Pipeline

**Input:** Historical mood records (last 30 days)

**Processing:**

```python
# 1. Time-Series Analysis
def analyze_trends(mood_history):
    df = pd.DataFrame(mood_history)
    df['date'] = pd.to_datetime(df['timestamp'])
    df = df.set_index('date').resample('D').agg({'score': 'mean'})

    # 7-day moving average
    df['ma7'] = df['score'].rolling(7).mean()
    # Trend: upward, downward, stable
    trend = calculate_trend(df['ma7'][-14:])

    return df, trend

# 2. LSTM Forecasting (7-day prediction)
model = LSTM(input_shape=(30, 1), units=64, dropout=0.2)
X_train = create_sequences(df['score'].values, seq_length=30)
predictions = model.predict(X_train[-1].reshape(1, 30, 1))

# 3. Pattern Detection
def detect_patterns(df, mood_metadata):
    patterns = []

    # Weekly pattern (e.g., worse on Mondays)
    weekly = df.groupby(df.index.dayofweek)['score'].mean()
    if weekly.std() > threshold:
        patterns.append({"type": "weekly_cycle", "details": weekly.to_dict()})

    # Activity correlation (mood vs. exercise, sleep, social interaction)
    correlations = compute_correlations(mood_metadata)
    for activity, corr in correlations.items():
        if abs(corr) > 0.5:
            patterns.append({
                "type": "activity_correlation",
                "activity": activity,
                "correlation": corr
            })

    return patterns

# 4. Insight Generation
def generate_insights(df, trend, patterns, forecast):
    insights = []

    if trend == 'upward':
        insights.append("Great! Your mood has been improving over the past week.")
    elif trend == 'downward':
        insights.append("We've noticed a slight downward trend. Consider reaching out.")

    for pattern in patterns:
        if pattern['type'] == 'activity_correlation':
            activity = pattern['activity']
            corr = pattern['correlation']
            direction = "improves" if corr > 0 else "worsens"
            insights.append(f"Your mood {direction} after {activity}.")

    return insights

response = {
    "trend": trend,
    "forecast_7days": predictions.tolist(),
    "confidence": 0.85,
    "patterns": patterns,
    "insights": insights,
    "recommendation": get_recommendation(patterns, forecast)
}
```

**Output:**

```json
{
  "trend": "upward",
  "forecast_7days": [6.2, 6.5, 6.8, 7.0, 6.9, 6.7, 6.5],
  "confidence": 0.85,
  "patterns": [
    {
      "type": "activity_correlation",
      "activity": "exercise",
      "correlation": 0.72
    },
    {
      "type": "weekly_cycle",
      "details": { "Monday": 5.2, "Friday": 7.1 }
    }
  ],
  "insights": ["Your mood improves significantly after exercise"],
  "recommendation": "Keep maintaining your exercise routine 3x per week"
}
```

### Crisis Detection Pipeline

**Input:** User message

**Processing:**

```python
def detect_crisis_risk(user_text, user_history):
    # 1. Keyword-based scoring
    crisis_keywords = {
        "suicide": 5.0,
        "kill myself": 5.0,
        "self-harm": 4.5,
        "overdose": 4.5,
        "end it all": 4.0,
        "depressed": 1.0,
        "no hope": 2.0
    }

    keyword_score = sum(crisis_keywords.get(kw, 0) for kw in tokenize(user_text))
    keyword_score = min(keyword_score / 5.0, 1.0)  # Normalize to [0, 1]

    # 2. ML-based risk scoring (fine-tuned BERT-based classifier)
    model = load_crisis_detection_model()
    risk_probability = model.predict(user_text)  # Float in [0, 1]

    # 3. Context-based scoring (user history, patterns)
    context_score = 0
    if user_history['average_mood_7d'] < 3:
        context_score += 0.3
    if user_has_crisis_intervention_plan():
        context_score -= 0.2
    context_score = clip(context_score, 0, 1)

    # 4. Ensemble scoring
    final_score = 0.4 * keyword_score + 0.5 * risk_probability + 0.1 * context_score

    # 5. Risk level classification
    if final_score > 0.8:
        risk_level = "CRITICAL"
        action = "immediate_intervention"
    elif final_score > 0.6:
        risk_level = "HIGH"
        action = "contact_emergency_services"
    elif final_score > 0.4:
        risk_level = "MODERATE"
        action = "recommend_crisis_resources"
    else:
        risk_level = "LOW"
        action = "continue_support"

    response = {
        "risk_level": risk_level,
        "risk_score": final_score,
        "component_scores": {
            "keyword": keyword_score,
            "ml_model": risk_probability,
            "context": context_score
        },
        "recommended_action": action,
        "crisis_resources": get_crisis_resources(user_location),
        "alert_needed": risk_level in ["CRITICAL", "HIGH"],
        "suggested_response": generate_supportive_response(risk_level)
    }

    # 6. Trigger alerts if needed
    if response['alert_needed']:
        if user_has_emergency_contact_consent():
            alert_emergency_contact(user_id, risk_level)
        if user_has_facility_provider():
            alert_provider(user_id, risk_level)

    return response
```

**Output:**

```json
{
  "risk_level": "MODERATE",
  "risk_score": 0.58,
  "recommended_action": "recommend_crisis_resources",
  "crisis_resources": [
    {
      "name": "National Suicide Prevention Lifeline",
      "phone": "988",
      "chat": "https://suicidepreventionlifeline.org/chat/"
    }
  ],
  "alert_needed": false,
  "suggested_response": "I hear you're struggling. That's very real, and you're not alone. Would you like to talk about what's happening?"
}
```

---

## Database Schema

### Core Tables (PostgreSQL + Encryption)

#### users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt
    oauth_provider VARCHAR(50),           -- google, apple, microsoft
    oauth_id VARCHAR(255),
    profile_data JSONB ENCRYPTED,         -- first_name, last_name, avatar_url (encrypted at rest)
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255) ENCRYPTED,
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,

    -- Privacy settings
    data_retention_days INT DEFAULT 365,
    allow_analytics BOOLEAN DEFAULT false,
    allow_notifications BOOLEAN DEFAULT true,
    allow_emergency_contact BOOLEAN DEFAULT false,

    -- Compliance tracking
    gdpr_consent_at TIMESTAMP WITH TIME ZONE,
    hipaa_acknowledgment_at TIMESTAMP WITH TIME ZONE,

    INDEX idx_email,
    INDEX idx_oauth_provider_id(oauth_provider, oauth_id),
    INDEX idx_is_active,
    CHECK (is_deleted = false OR deleted_at IS NOT NULL)
);
```

#### mood_logs

```sql
CREATE TABLE mood_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mood_score INT NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
    emotion VARCHAR(50),                   -- sadness, joy, anger, etc.
    emotion_confidence DECIMAL(3,2),
    context JSONB ENCRYPTED,               -- activities, sleep, exercise, etc.
    notes TEXT ENCRYPTED,                  -- user's journal entry
    location_hash VARCHAR(64),              -- hashed for privacy
    weather_condition VARCHAR(50),
    energy_level INT CHECK (energy_level >= 1 AND energy_level <= 5),
    anxiety_level INT CHECK (anxiety_level >= 1 AND anxiety_level <= 5),

    -- Crisis flag
    crisis_flag BOOLEAN DEFAULT false,
    crisis_score DECIMAL(4,2),
    provider_notified BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id_created(user_id, created_at DESC),
    INDEX idx_crisis_flag
);
```

#### emotion_detections

```sql
CREATE TABLE emotion_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Input
    input_text_hash VARCHAR(64),           -- SHA256 for deduplication, actual text encrypted
    input_text_encrypted TEXT ENCRYPTED,

    -- Detection results
    detected_emotion VARCHAR(50),
    emotion_confidence DECIMAL(4,3),
    emotion_intensity DECIMAL(4,3),
    all_emotions JSONB,                   -- {emotion: score, ...}

    -- Model metadata
    model_version VARCHAR(50),
    model_name VARCHAR(255),
    inference_time_ms INT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id_created(user_id, created_at DESC),
    INDEX idx_detected_emotion
);
```

#### chat_conversations

```sql
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(255),
    conversation_summary TEXT ENCRYPTED,

    -- Metadata
    message_count INT DEFAULT 0,
    primary_emotion VARCHAR(50),
    crisis_detected BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP WITH TIME ZONE,

    INDEX idx_user_id_created(user_id, created_at DESC),
    INDEX idx_crisis_detected
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    role VARCHAR(20) NOT NULL,             -- user, assistant
    message_text TEXT ENCRYPTED,
    message_hash VARCHAR(64),              -- Deduplication

    -- AI metadata
    emotion_detected VARCHAR(50),
    emotion_confidence DECIMAL(4,3),
    is_crisis_message BOOLEAN DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_conversation_id_created(conversation_id, created_at),
    INDEX idx_user_id_created(user_id, created_at DESC)
);
```

#### recommendations

```sql
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    recommendation_type VARCHAR(50),       -- coping_strategy, activity, therapy, resource
    recommendation_content JSONB ENCRYPTED,

    reason TEXT,                           -- Why this recommendation
    confidence_score DECIMAL(4,3),

    -- Engagement tracking
    viewed BOOLEAN DEFAULT false,
    viewed_at TIMESTAMP WITH TIME ZONE,
    acted_on BOOLEAN DEFAULT false,
    acted_on_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),

    INDEX idx_user_id_created(user_id, created_at DESC),
    INDEX idx_expires_at
);
```

#### consent_logs

```sql
CREATE TABLE consent_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    consent_type VARCHAR(100),             -- data_processing, emergency_alert, marketing
    version VARCHAR(50),
    given BOOLEAN,
    ip_address INET ENCRYPTED,             -- Encrypted for GDPR compliance
    user_agent TEXT ENCRYPTED,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id_created(user_id, created_at DESC)
);
```

#### audit_logs

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID,                          -- May be NULL for system actions
    action VARCHAR(255) NOT NULL,          -- login, export_data, update_settings
    resource_type VARCHAR(100),            -- user, mood, conversation
    resource_id VARCHAR(255),

    changes JSONB,                         -- What changed (PII redacted)
    status VARCHAR(50),                    -- success, failure
    error_message TEXT,

    ip_address INET ENCRYPTED MASKED,
    user_agent TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_user_id_created(user_id, created_at DESC),
    INDEX idx_action
);
```

#### vector_embeddings (for semantic search, powered by pgvector)

```sql
CREATE TABLE vector_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,

    content_hash VARCHAR(64),
    embedding vector(384),                 -- MiniLM 384-dim embeddings

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_embedding ON vector_embeddings USING ivfflat (embedding vector_cosine_ops)
);
```

### Encryption Strategy

- **At-Rest Encryption**: PostgreSQL pgcrypto extension + application-level AES-256-GCM
- **In-Transit Encryption**: TLS 1.3 for all network communication
- **Key Rotation**: Monthly automated rotation via HashiCorp Vault
- **Field-Level Encryption**: PII fields (notes, profile, context) encrypted independently

---

## API Structure

### Authentication Endpoints

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh-token
POST /api/auth/google
GET  /api/auth/google/callback
POST /api/auth/mfa/setup
POST /api/auth/mfa/verify
POST /api/auth/password-reset
POST /api/auth/password-reset/confirm
```

### User Endpoints

```
GET  /api/users/me
PATCH /api/users/me
GET  /api/users/me/stats
POST /api/users/me/export-data          # GDPR data portability
DELETE /api/users/me                    # Account deletion

# Consent & Privacy
GET  /api/users/me/consents
POST /api/users/me/consents
GET  /api/users/me/audit-log
PUT  /api/users/me/privacy-settings
```

### Mood Tracking Endpoints

```
POST  /api/moods
GET   /api/moods                         # With pagination & filtering
GET   /api/moods/{id}
PATCH /api/moods/{id}
DELETE /api/moods/{id}

GET   /api/moods/analytics/trends        # Aggregated mood trends
GET   /api/moods/analytics/patterns      # Pattern detection
GET   /api/moods/analytics/forecast      # 7-day forecast
GET   /api/moods/analytics/insights      # AI-generated insights
GET   /api/moods/analytics/correlation   # Mood vs. activity correlation
```

### Emotion Detection Endpoints

```
POST /api/emotions/detect                # Analyze user text
GET  /api/emotions/history               # Emotion detection history
GET  /api/emotions/summary               # Emotion frequency summary
```

### Chat/Companion Endpoints

```
POST  /api/conversations                 # Create new conversation
GET   /api/conversations                 # List conversations
GET   /api/conversations/{id}
PATCH /api/conversations/{id}/title

POST  /api/conversations/{id}/messages   # Send message
GET   /api/conversations/{id}/messages   # Get messages
DELETE /api/conversations/{id}/messages/{msg_id}

GET   /api/chat/suggested-responses      # AI suggestions for user query
POST  /api/chat/typing-indicator         # Real-time typing indicator
```

### Crisis Management Endpoints

```
POST /api/crisis/evaluate                # Evaluate crisis risk
POST /api/crisis/resources               # Get crisis resources
POST /api/crisis/emergency-contacts      # Notify emergency contacts
GET  /api/crisis/safety-plan             # User's safety plan
POST /api/crisis/safety-plan             # Create/update safety plan
```

### Recommendations Endpoints

```
GET  /api/recommendations                # Get personalized recommendations
GET  /api/recommendations/{id}
POST /api/recommendations/{id}/viewed    # Track engagement
POST /api/recommendations/{id}/acted-on
```

### Analytics Endpoints (Anonymized)

```
GET  /api/analytics/dashboard            # Anonymized aggregate stats
GET  /api/analytics/trends               # Industry trends (anonymized)
GET  /api/analytics/research             # Research data (opt-in, anonymized)
```

### Admin Endpoints (Private)

```
GET  /api/admin/users
GET  /api/admin/audit-logs
GET  /api/admin/compliance-reports
POST /api/admin/data-export
```

---

## Security & Privacy

### OWASP Top 10 Mitigations

| Risk                        | Mitigation                               | Implementation                 |
| --------------------------- | ---------------------------------------- | ------------------------------ |
| Injection                   | Parameterized queries, input validation  | ORM + TypeScript validation    |
| Auth Bypass                 | JWT + MFA, rate limiting                 | 2FA, OAuth, session management |
| Sensitive Data              | Encryption at-rest & in-transit          | pgcrypto, TLS 1.3              |
| Access Control              | RBAC, principle of least privilege       | Role-based API middleware      |
| XSS                         | Content Security Policy, output encoding | Helmet.js, React sanitization  |
| Security Misconfiguration   | Security headers, no default credentials | Environment-based config       |
| XXE                         | XML parsing disabled, DTD validation     | No XML processing              |
| Broken Auth                 | JWT + session validation                 | Refresh token rotation         |
| CSRF                        | CSRF tokens, SameSite cookies            | CSRF middleware                |
| Using Components with Vulns | Dependency scanning, automated updates   | Dependabot + renovatebot       |

### Privacy by Design

**Data Minimization:**

- Collect only essential data
- Delete data after retention period (default: 365 days)
- Provide user control over data retention

**Anonymization:**

- Hash sensitive identifiers for analytics
- Strip PII before ML model processing
- Aggregate data in dashboards

**Differential Privacy:**

- Add noise to aggregate statistics
- Prevent inference attacks

**Purpose Limitation:**

- Explicit user consent for each data use
- Separate consent for research, analytics, recommendations

**GDPR Compliance:**

- Right to access: `/api/users/me/export-data`
- Right to erasure: Account deletion cascades
- Right to portability: Export user data in standard format
- Right to object: Opt-out of analytics/marketing
- Consent management system
- DPA with data processors
- Privacy Impact Assessment performed

**HIPAA Considerations (Extended Healthcare):**

- Unique encryption keys per user
- Audit logs for all access
- Business Associate Agreements (BAAs) with vendors
- User authentication required before viewing any record
- Automatic logout after inactivity

---

## Deployment & Scaling

### Production Architecture

```
┌──────────────────────────────────────────────┐
│         AWS Multi-Region Setup               │
├──────────────────────────────────────────────┤
│  Primary Region: us-east-1 (N. Virginia)    │
│  DR Region: eu-west-1 (Ireland)              │
└──────────────────────────────────────────────┘
         │                          │
    ┌────▼────┐              ┌─────▼────┐
    │ ECS/EKS │              │ ECS/EKS  │
    │Fargate  │              │ (Standby)│
    └────┬────┘              └──────────┘
         │
    Load Balancer (ALB)
         │
    ┌────┴────┬────────────┬────────────┐
    │          │            │            │
 Api-GW    User-Svc   Emotion-Svc  Crisis-Svc
    │          │            │            │
    └────┬─────┴────────────┴────────────┘
         │
    ┌────▼──────────────────┐
    │   RDS PostgreSQL      │
    │  (Multi-AZ, Backup)   │
    └───────────────────────┘
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      containers:
        - name: api-gateway
          image: mindsafe/api-gateway:latest
          ports:
            - containerPort: 5000
          env:
            - name: NODE_ENV
              value: "production"
            - name: JWT_SECRET
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: jwt-secret
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health
              port: 5000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 5000
            initialDelaySeconds: 10
            periodSeconds: 5
```

### Monitoring & Observability

```yaml
# Prometheus Metrics
- Request latency (p50, p95, p99)
- Error rates by endpoint
- ML model inference latency
- Database query performance
- Cache hit/miss ratios
- User engagement metrics

# Grafana Dashboards
- Platform Health: Uptime, error rates, latency
- User Growth: Daily active users, retention
- ML Model Performance: Accuracy, latency, drift
- Business Metrics: Mood trends, crisis detections
- Security: Failed auth attempts, suspicious IPs
```

### Scaling Strategy

| Metric                   | Threshold | Action                 |
| ------------------------ | --------- | ---------------------- |
| CPU Utilization          | >70%      | Scale-out (+2 pods)    |
| Memory Utilization       | >80%      | Scale-out (+1 pod)     |
| Request Latency          | >500ms    | Scale-out, investigate |
| Error Rate               | >1%       | Alert, investigate     |
| Database Connection Pool | >90%      | Increase pool size     |
| Cache Hit Rate           | <80%      | Increase cache size    |

---

## Implementation Roadmap

### Phase 1: MVP (Weeks 1-4)

- [x] Auth system (email + Google OAuth)
- [x] Mood tracking (simple numeric scale)
- [x] Chat interface (GPT-4 API integration)
- [x] Basic dashboard
- [ ] Emotion detection (deploy RoBERTa model)
- [ ] Crisis detection (rule-based + model)

### Phase 2: Intelligence (Weeks 5-8)

- [ ] Mood analytics (trends, forecasts)
- [ ] Recommendation engine (collaborative filtering)
- [ ] Coping strategy library
- [ ] Activity correlation analysis
- [ ] Weekly digest emails

### Phase 3: Safety (Weeks 9-12)

- [ ] Emergency contact alerts
- [ ] Crisis hotline integration
- [ ] Safety planning tools
- [ ] Provider integration (therapist notes)
- [ ] Multi-factor authentication

### Phase 4: Scale (Weeks 13+)

- [ ] Mobile app (React Native)
- [ ] Production deployment (AWS)
- [ ] HIPAA compliance certification
- [ ] SOC 2 audit
- [ ] Multi-language support
- [ ] Wearable device integration (Apple Watch, Oura Ring)

---

## Best Practices Summary

✅ **Privacy-First:**

- Encrypt everything in transit and at rest
- Minimize data collection; provide user control
- Implement GDPR/HIPAA by design, not as afterthought

✅ **Security:**

- Use industry-standard libraries (bcrypt, jsonwebtoken, argon2)
- Regular dependency updates
- Automated security scanning (SAST, DAST)
- Penetration testing annually

✅ **Reliability:**

- Microservices with clear boundaries
- Graceful degradation (optional services)
- Circuit breakers for external APIs
- Health checks and automated recovery

✅ **Performance:**

- Cache aggressively (Redis, CDN)
- Lazy-load UI components
- Async processing for heavy tasks
- Monitor latency at all layers

✅ **Observability:**

- Structured logging (JSON)
- Distributed tracing (Jaeger)
- Prometheus metrics
- Real-time alerting

---

## References & Tools

- **Auth**: Auth0, Firebase, Keycloak
- **ML Models**: Hugging Face Hub, OpenAI API
- **Database**: PostgreSQL, PgVector, Redis
- **Monitoring**: Prometheus, Grafana, Datadog
- **Infrastructure**: Kubernetes, Docker, Helm
- **Security**: HashiCorp Vault, Snyk, OWASP
- **Compliance**: OneTrust (GDPR), Drata (SOC 2)

---

**Document Version**: 1.0 | **Last Updated**: March 30, 2026 | **Status**: Ready for Implementation
