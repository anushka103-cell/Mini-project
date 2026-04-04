# MindSafe Implementation Guide

**Quick Start: Deploy MindSafe's AI Mental Health Platform**

---

## Setup Checklist

### Prerequisites

- [ ] Node.js 18+
- [ ] Python 3.10+
- [ ] Docker & Docker Compose
- [ ] PostgreSQL 15
- [ ] Redis 7
- [ ] Google Cloud Console account (for OAuth)
- [ ] AWS account (for production deployment)

### Environment Setup

```bash
# 1. Clone the repository
git clone https://github.com/yourorg/mindsafe.git
cd mindsafe

# 2. Install frontend dependencies
npm install

# 3. Install backend dependencies
cd src/backend
npm install
cd ../..

# 4. Install Python service dependencies
cd src/services/emotion_detection && pip install -r requirements.txt
cd ../mood_analytics && pip install -r requirements.txt
cd ../crisis_detection && pip install -r requirements.txt
cd ../queue_worker && pip install -r requirements.txt
cd ../../..

# 5. Copy environment template
cp .env.example .env
cp src/backend/.env.example src/backend/.env

# 6. Generate secrets
node scripts/generate-secrets.js
```

### Configuration

#### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project: "MindSafe"
3. Enable APIs:
   - Google+ API
   - Google Identity
4. Create OAuth 2.0 Client ID (Web application):
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
5. Copy Client ID & Secret to `.env`:

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
NEXT_PUBLIC_GOOGLE_AUTH_URL=http://localhost:5000/api/auth/google
```

#### Database Setup

```bash
# Start PostgreSQL via Docker Compose
docker compose up -d postgres

# Run migrations
npm run migrate

# Seed example data (optional)
npm run seed
```

#### Environment Variables

**Root `./.env`:**

```bash
NODE_ENV=development
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key
RESEND_API_KEY=re_xxxxx  # Get from https://resend.com
DATABASE_URL=postgresql://mindsafe_user:password@localhost:5432/mindsafe_db
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
NEXT_PUBLIC_GOOGLE_AUTH_URL=http://localhost:5000/api/auth/google
```

---

## Local Development

### Start All Services

```bash
# Terminal 1: Start Docker Compose services
docker compose up -d

# Terminal 2: Start frontend (dev mode with hot reload)
npm run dev

# Terminal 3: Start backend API Gateway
cd src/backend && npm run dev

# Terminal 4: Run smoke tests in watch mode
npm run smoke:api -- --watch
```

### Access Points

| Service           | URL                        | Credentials                |
| ----------------- | -------------------------- | -------------------------- |
| Frontend          | http://localhost:3000      | Create account             |
| API Gateway       | http://localhost:5000      | Use token from /auth/login |
| Emotion Detection | http://localhost:8001/docs | No auth                    |
| Mood Analytics    | http://localhost:8002/docs | No auth                    |
| Crisis Detection  | http://localhost:8003/docs | No auth                    |
| Postgres          | localhost:5432             | mindsafe_user / password   |
| Redis             | localhost:6379             | No auth                    |
| Grafana           | http://localhost:3001      | admin / admin              |
| Prometheus        | http://localhost:9090      | No auth                    |

### Testing

```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Smoke tests
npm run smoke:api

# Security scan
npm run security:scan

# Accessibility audit
npm run audit:a11y
```

---

## Implementing Core Features

### 1. Emotion Detection Service

**File:** `src/services/emotion_detection/main.py`

```python
from fastapi import FastAPI, HTTPException
from transformers import pipeline
import logging

app = FastAPI()
logger = logging.getLogger(__name__)

# Load pre-trained emotion detection model
emotion_classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-roberta-large",
    device=0  # GPU device number
)

@app.post("/api/emotions/detect")
async def detect_emotion(request: EmotionRequest):
    """
    Detect emotion from user text.
    Request: { "text": "I'm feeling sad today" }
    Response: { "emotion": "sadness", "confidence": 0.92, ... }
    """
    try:
        # Validate input
        if not request.text or len(request.text) < 2:
            raise HTTPException(status_code=400, detail="Text too short")

        # Detect emotion
        result = emotion_classifier(request.text[:512])  # Limit to 512 chars

        return {
            "emotion": result[0]["label"],
            "confidence": float(result[0]["score"]),
            "intensity": calculate_intensity(request.text),
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Emotion detection failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Detection failed")

def calculate_intensity(text: str) -> float:
    """Calculate emotional intensity based on text features."""
    factors = 0.0
    score = 0.0

    # Uppercase letters (shouting)
    if text.isupper():
        score += 0.3
        factors += 1

    # Exclamation marks
    if "!!!" in text:
        score += 0.3
        factors += 1

    # Repetition
    if "...." in text or "..." in text:
        score += 0.2
        factors += 1

    factors = max(factors, 1)
    return min(score / factors + 0.3, 1.0)  # Base 0.3, max 1.0
```

### 2. Mood Analytics Service

**File:** `src/services/mood_analytics/main.py`

```python
from fastapi import FastAPI
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timedelta

app = FastAPI()

@app.post("/api/moods/analytics/trends")
async def analyze_trends(request: TrendsRequest):
    """
    Analyze mood trends over time.
    Response: { "trend": "upward", "forecast_7days": [...], "patterns": [...] }
    """
    try:
        # Fetch user's mood history (last 30 days)
        moods = await get_user_mood_history(request.user_id, days=30)

        if len(moods) < 7:
            return {"message": "Insufficient data", "moods_collected": len(moods)}

        # Create DataFrame
        df = pd.DataFrame(moods)
        df['date'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('date')

        # 7-day moving average
        df['ma7'] = df['score'].rolling(window=7, min_periods=1).mean()

        # Detect trend
        recent_avg = df['ma7'].iloc[-7:].mean()
        older_avg = df['ma7'].iloc[-14:-7].mean()

        if recent_avg > older_avg + 0.5:
            trend = "upward"
        elif recent_avg < older_avg - 0.5:
            trend = "downward"
        else:
            trend = "stable"

        # 7-day forecast (simple LSTM)
        forecast = forecast_mood_lstm(df['score'].values)

        # Detect patterns
        patterns = detect_mood_patterns(df)

        return {
            "trend": trend,
            "recent_average": float(recent_avg),
            "forecast_7days": forecast,
            "patterns": patterns,
            "data_quality": len(moods)
        }

    except Exception as e:
        logger.error(f"Trend analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Analysis failed")

def forecast_mood_lstm(mood_scores: np.ndarray) -> list:
    """
    Forecast mood for next 7 days using LSTM.
    """
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense

    # Prepare data
    X = mood_scores.reshape(-1, 1)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Create sequences
    seq_len = 7
    X_seq, y_seq = [], []
    for i in range(len(X_scaled) - seq_len):
        X_seq.append(X_scaled[i:i+seq_len])
        y_seq.append(X_scaled[i+seq_len])

    X_seq = np.array(X_seq)
    y_seq = np.array(y_seq)

    # Build LSTM model
    model = Sequential([
        LSTM(64, activation='relu', input_shape=(seq_len, 1)),
        Dense(32, activation='relu'),
        Dense(1)
    ])

    model.compile(optimizer='adam', loss='mse')
    model.fit(X_seq, y_seq, epochs=50, batch_size=16, verbose=0)

    # Forecast
    last_sequence = X_scaled[-seq_len:].reshape(1, seq_len, 1)
    forecast_scaled = []

    for _ in range(7):
        next_pred = model.predict(last_sequence, verbose=0)
        forecast_scaled.append(next_pred[0, 0])
        # Shift window
        last_sequence = np.append(last_sequence[:, 1:, :],
                                 [[[next_pred[0, 0]]]], axis=1)

    # Inverse scale
    forecast = scaler.inverse_transform(np.array(forecast_scaled).reshape(-1, 1))
    return forecast.flatten().tolist()

def detect_mood_patterns(df: pd.DataFrame) -> list:
    """Detect recurring mood patterns."""
    patterns = []

    # Weekly pattern (e.g., Monday blues)
    df['day_of_week'] = df['date'].dt.day_name()
    weekly_avg = df.groupby('day_of_week')['score'].agg(['mean', 'std'])

    # If weekend significantly different from weekdays
    weekend_avg = weekly_avg.loc[['Saturday', 'Sunday']]['mean'].mean()
    weekday_avg = weekly_avg.loc[['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']]['mean'].mean()

    if abs(weekend_avg - weekday_avg) > 1.0:
        patterns.append({
            "type": "weekly_cycle",
            "description": f"Weekend mood is {weekday_avg - weekend_avg:.1f} points {'higher' if weekend_avg > weekday_avg else 'lower'}"
        })

    return patterns
```

### 3. Crisis Detection Service

**File:** `src/services/crisis_detection/main.py`

```python
from fastapi import FastAPI, HTTPException
import pickle
import numpy as np

app = FastAPI()

# Load crisis detection model
crisis_model = pickle.load(open('models/crisis_classifier.pkl', 'rb'))

CRISIS_KEYWORDS = {
    "suicide": 0.95,
    "kill myself": 0.95,
    "self-harm": 0.90,
    "overdose": 0.90,
    "end it all": 0.85,
    "no point": 0.70,
    "give up": 0.65,
}

@app.post("/api/crisis/evaluate")
async def evaluate_crisis_risk(request: CrisisRequest):
    """
    Evaluate crisis risk from user message.
    Response: { "risk_level": "MODERATE", "risk_score": 0.58, ... }
    """
    try:
        text = request.text.lower()
        user_history = await get_user_history(request.user_id)

        # 1. Keyword-based scoring
        keyword_score = 0.0
        found_keywords = []
        for keyword, weight in CRISIS_KEYWORDS.items():
            if keyword in text:
                keyword_score = max(keyword_score, weight)
                found_keywords.append(keyword)

        keyword_score = min(keyword_score / 0.95, 1.0)  # Normalize

        # 2. ML-based scoring
        features = extract_text_features(text)
        ml_probability = crisis_model.predict_proba(features)[0][1]

        # 3. Context-based scoring
        context_score = 0.0

        # Recent mood deterioration
        if user_history['average_mood_7d'] < 3 and user_history['average_mood_30d'] > 5:
            context_score += 0.4

        # Frequent crisis mentions
        if user_history['crisis_messages_7d'] > 3:
            context_score += 0.3

        context_score = min(context_score, 1.0)

        # 4. Ensemble scoring
        final_score = (0.4 * keyword_score +
                      0.5 * ml_probability +
                      0.1 * context_score)

        # 5. Risk classification
        if final_score > 0.8:
            risk_level = "CRITICAL"
        elif final_score > 0.6:
            risk_level = "HIGH"
        elif final_score > 0.4:
            risk_level = "MODERATE"
        else:
            risk_level = "LOW"

        response = {
            "risk_level": risk_level,
            "risk_score": float(final_score),
            "keywords_found": found_keywords,
            "recommended_action": map_risk_to_action(risk_level),
            "crisis_resources": get_crisis_resources(request.country or "US"),
            "alert_needed": risk_level in ["CRITICAL", "HIGH"]
        }

        # Trigger alerts if needed
        if response['alert_needed']:
            await trigger_crisis_alerts(request.user_id, risk_level)

        return response

    except Exception as e:
        logger.error(f"Crisis evaluation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Evaluation failed")

def extract_text_features(text: str) -> np.ndarray:
    """Extract features for ML model."""
    features = []

    # Linguistic features
    features.append(len(text.split()))  # Word count
    features.append(text.count('!'))   # Exclamation marks
    features.append(text.count('*'))   # Emphasis
    features.append(len(text) / max(len(text.split()), 1))  # Avg word length
    features.append(text.isupper())    # All caps

    # Sentiment features (using pre-trained sentiment analyzer)
    sentiment = sentiment_analyzer(text)
    features.append(sentiment['negative'])
    features.append(sentiment['neutral'])
    features.append(sentiment['positive'])

    return np.array([features])

def map_risk_to_action(risk_level: str) -> dict:
    """Map risk level to recommended action."""
    actions = {
        "CRITICAL": {
            "action": "immediate_intervention",
            "message": "We're connecting you with emergency support immediately."
        },
        "HIGH": {
            "action": "emergency_resources",
            "message": "Please reach out to a crisis counselor using the resources below."
        },
        "MODERATE": {
            "action": "supportive_resources",
            "message": "We're here to support you. Here are some helpful resources."
        },
        "LOW": {
            "action": "continue_support",
            "message": "We're here to listen. Feel free to share more."
        }
    }
    return actions.get(risk_level, {})
```

### 4. Backend API Routes

**File:** `src/backend/src/routes/moodRoutes.js`

```javascript
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth");
const moodController = require("../controllers/moodController");

// All mood routes require authentication
router.use(authMiddleware);

// Create mood log
router.post("/", async (req, res) => {
  try {
    const { mood_score, emotion, context, notes } = req.body;

    // Validate input
    if (!mood_score || mood_score < 1 || mood_score > 10) {
      return res.status(400).json({ error: "Invalid mood score (1-10)" });
    }

    // Create mood log
    const mood = await moodController.createMood({
      user_id: req.user.id,
      mood_score,
      emotion,
      context,
      notes: encryptPII(notes), // Encrypt notes
      created_at: new Date(),
    });

    res.status(201).json(mood);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's mood history with filters
router.get("/", async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.query;

    const moods = await moodController.getUserMoods({
      user_id: req.user.id,
      start_date,
      end_date,
      limit,
      offset,
    });

    res.json(moods);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get mood analytics
router.get("/analytics/trends", async (req, res) => {
  try {
    const trends = await fetch(
      "http://mood_analytics:8002/api/moods/analytics/trends",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: req.user.id }),
      },
    ).then((r) => r.json());

    res.json(trends);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 5. Frontend Chat Component

**File:** `src/app/(protected)/ai-companion/ChatWindow.js`

```javascript
"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

export default function ChatWindow({ conversationId }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch messages for this conversation
  const { data: conversationData } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const res = await fetch(
        `http://localhost:5000/api/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      return res.json();
    },
  });

  useEffect(() => {
    setMessages(conversationData?.messages || []);
    scrollToBottom();
  }, [conversationData]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message) => {
      const res = await fetch(
        `http://localhost:5000/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ role: "user", message_text: message }),
        },
      );
      return res.json();
    },
    onSuccess: (data) => {
      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: data.user_message_id,
          role: "user",
          message_text: inputValue,
          created_at: new Date().toISOString(),
        },
      ]);

      // Add AI response with streaming
      setMessages((prev) => [
        ...prev,
        {
          id: data.assistant_message_id,
          role: "assistant",
          message_text: data.response,
          emotion_detected: data.emotion_detected,
          created_at: new Date().toISOString(),
        },
      ]);

      setInputValue("");
      setIsLoading(false);
    },
    onError: (error) => {
      alert("Failed to send message: " + error.message);
      setIsLoading(false);
    },
  });

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsLoading(true);
    sendMessageMutation.mutate(inputValue);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                msg.role === "user"
                  ? "bg-cyan-500 text-slate-950 rounded-br-none"
                  : "bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700"
              }`}
            >
              <p className="text-sm">{msg.message_text}</p>
              {msg.emotion_detected && msg.role === "assistant" && (
                <p className="text-xs mt-2 text-slate-400">
                  Detected: {msg.emotion_detected}
                </p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-slate-800 p-4"
      >
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Share your thoughts..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-700 text-slate-950 px-4 py-2 rounded-lg transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## Production Deployment

### AWS Deployment with ECS Fargate

```yaml
# terraform/main.tf
provider "aws" {
  region = "us-east-1"
}

# Load Balancer
resource "aws_lb" "main" {
  name               = "mindsafe-lb"
  internal           = false
  load_balancer_type = "application"
  subnets            = aws_subnet.public[*].id
  security_groups    = [aws_security_group.lb_sg.id]
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "mindsafe-cluster"
}

# RDS PostgreSQL
resource "aws_db_instance" "postgres" {
  allocated_storage    = 100
  storage_type         = "gp3"
  engine               = "postgres"
  engine_version       = "15.3"
  instance_class       = "db.t3.large"
  db_name              = "mindsafe_db"
  username             = "mindsafe_admin"
  password             = random_password.db_password.result
  multi_az             = true
  backup_retention_period = 30

  # Encryption
  storage_encrypted       = true
  kms_key_id             = aws_kms_key.rds.arn

  # Security
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false
  skip_final_snapshot    = false
  final_snapshot_identifier = "mindsafe-final-snapshot"

  tags = {
    Name = "mindsafe-postgres"
  }
}

# ElastiCache Redis
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "mindsafe-redis"
  engine               = "redis"
  node_type            = "cache.t3.medium"
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379

  # Security
  security_group_ids  = [aws_security_group.redis_sg.id]

  tags = {
    Name = "mindsafe-redis"
  }
}
```

### Kubernetes Deployment

```bash
# Deploy to EKS
helm repo add mindsafe https://charts.mindsafe.io
helm install mindsafe mindsafe/mindsafe \
  --namespace production \
  --values values-prod.yaml

# Monitor deployment
kubectl get pods -n production
kubectl logs -f deployment/api-gateway -n production
```

---

## Monitoring & Maintenance

### Health Check Dashboard

```bash
# Check all services
curl http://localhost:5000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
curl http://localhost:8003/health

# View metrics
curl http://localhost:5000/metrics
```

### Database Maintenance

```sql
-- Weekly maintenance
VACUUM ANALYZE;

-- Check table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Backup
pg_dump -U mindsafe_user -d mindsafe_db > backup_$(date +%Y%m%d).sql
```

---

## Troubleshooting

### Common Issues

**Issue: "Google OAuth is not configured"**

- Solution: Verify `.env` has real `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Rebuild containers: `docker compose up -d --build`

**Issue: "Connection refused" to emotion detection service**

- Solution: Services may not be ready; wait 10 seconds and retry
- Check: `docker logs mindsafe_emotion_detection`

**Issue: Database migration fails**

- Solution: Ensure PostgreSQL is running: `docker compose up -d postgres`
- Check migrations: `npm run migrate:status`

**Issue: CORS errors from frontend**

- Solution: Update `.env` `CORS_ORIGINS` to include frontend domain

---

## Next Steps

1. ✅ Set up local development environment
2. ✅ Configure Google OAuth
3. ✅ Deploy and test all microservices
4. 📋 Implement additional AI models (emotion tracking, prediction)
5. 📋 Add emergency contact management
6. 📋 Deploy to AWS production
7. 📋 Set up HIPAA compliance & security audit
8. 📋 Launch beta with real users
9. 📋 Iterate based on user feedback

---

**Questions?** Check `docs/`, `README.md`, or open an issue on GitHub.
