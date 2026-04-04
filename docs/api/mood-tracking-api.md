# Mood Tracking API

Base URL (local): `http://localhost:8002`
Service health: `GET /health`

## Overview

The mood tracking service supports:

- Daily mood logging (upsert per user per day)
- Trend analysis for mood and emotions
- Weekly mental health score
- Visualization-ready chart payloads

## Database Schema

Applied schema file:

- `src/deploy/mood_tracking_schema.sql`

Main table: `mood_logs`

- `id` BIGSERIAL PRIMARY KEY
- `user_id` VARCHAR(128) NOT NULL
- `logged_date` DATE NOT NULL
- `mood_score` INTEGER NOT NULL CHECK 1..10
- `mood_label` VARCHAR(32)
- `notes` TEXT
- `emotion_scores` JSONB
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- UNIQUE (`user_id`, `logged_date`)

## Endpoints

### 1) Log Daily Mood

`POST /moods/log`

Request JSON:

```json
{
  "user_id": "user-123",
  "mood_score": 6,
  "mood_label": "neutral",
  "notes": "Work pressure but manageable",
  "emotion_scores": {
    "anxiety": 0.4,
    "calm": 0.5
  },
  "logged_at": "2026-03-31T08:30:00Z"
}
```

Behavior:

- Creates new row for (`user_id`, `logged_date`) if none exists
- Updates existing row for same date otherwise

Response JSON (example):

```json
{
  "id": 42,
  "user_id": "user-123",
  "logged_date": "2026-03-31",
  "mood_score": 6,
  "mood_label": "neutral",
  "notes": "Work pressure but manageable",
  "emotion_scores": {
    "anxiety": 0.4,
    "calm": 0.5
  },
  "created_at": "2026-03-31T08:30:01.120000Z",
  "updated_at": "2026-03-31T08:30:01.120000Z"
}
```

### 2) Get Mood Logs

`GET /moods/{user_id}/logs?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=90`

Response: list of mood log objects.

### 3) Emotion Trend Analysis

`GET /moods/{user_id}/trends?days=30`

Response JSON (example):

```json
{
  "user_id": "user-123",
  "window_days": 30,
  "trend_direction": "improving",
  "slope": 0.052341,
  "points": [
    {
      "date": "2026-03-25",
      "avg_mood_score": 5.0,
      "moving_avg_7d": null
    }
  ],
  "top_emotions": [
    {
      "emotion": "calm",
      "avg_score": 0.62
    }
  ]
}
```

### 4) Weekly Mental Health Score

`GET /moods/{user_id}/weekly-score?week_start=YYYY-MM-DD`

If `week_start` omitted, current week is used.

Response JSON (example):

```json
{
  "user_id": "user-123",
  "week_start": "2026-03-30",
  "week_end": "2026-04-05",
  "entries_count": 4,
  "average_mood": 6.25,
  "consistency_ratio": 0.571,
  "stability_score": 0.88,
  "weekly_mental_health_score": 62.45
}
```

Score notes:

- Weighted range: 0 to 100
- Factors: mood average, weekly logging consistency, mood stability

### 5) Visualization-Ready Data

`GET /moods/{user_id}/visualization?days=90`

Response JSON (example):

```json
{
  "user_id": "user-123",
  "labels": ["2026-03-29", "2026-03-30", "2026-03-31"],
  "mood_scores": [5.0, 6.0, 7.0],
  "moving_avg_7d": [null, null, null],
  "weekly_scores": [
    {
      "week_start": "2026-03-30",
      "score": 64.2
    }
  ],
  "emotion_series": {
    "anxiety": [0.6, 0.4, 0.2],
    "calm": [0.2, 0.5, 0.8]
  }
}
```

## Error Cases

Common responses:

- `400`: invalid payload (score range, missing fields)
- `404`: no data for selected period
- `500`: database not initialized/available

## Quick Curl Samples

```bash
curl -X POST http://localhost:8002/moods/log \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"user-123",
    "mood_score":7,
    "mood_label":"good",
    "emotion_scores":{"happiness":0.7,"calm":0.8}
  }'

curl "http://localhost:8002/moods/user-123/trends?days=30"
curl "http://localhost:8002/moods/user-123/weekly-score"
curl "http://localhost:8002/moods/user-123/visualization?days=90"
```
