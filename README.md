# MindSafe — Privacy-First Mental Health Platform

A Next.js + Python microservices platform providing AI companions, anonymous peer support, mood tracking, 3D avatars, and therapeutic games — all with end-to-end encryption.

## Architecture

| Service           | Tech                   | Port | Path                              |
| ----------------- | ---------------------- | ---- | --------------------------------- |
| Frontend          | Next.js 16 (Turbopack) | 3000 | `src/app/`                        |
| Backend API       | Node.js / Express      | 5000 | `src/backend/`                    |
| Emotion Detection | Python / FastAPI       | 8001 | `src/services/emotion_detection/` |
| Mood Analytics    | Python / FastAPI       | 8002 | `src/services/mood_analytics/`    |
| Crisis Detection  | Python / FastAPI       | 8003 | `src/services/crisis_detection/`  |
| Chatbot           | Python / FastAPI       | 8004 | `src/services/chatbot/`           |
| Recommendations   | Python / FastAPI       | 8005 | `src/services/recommendation/`    |

## Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **PostgreSQL** (optional, in-memory store used by default)
- **Groq API key** (for AI chatbot responses)

## Quick Start

### 1. Install dependencies

```bash
# Frontend + Backend (Node)
npm install
cd src/backend && npm install && cd ../..

# Python microservices
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r src/services/chatbot/requirements.txt
pip install -r src/services/emotion_detection/requirements.txt
pip install -r src/services/mood_analytics/requirements.txt
pip install -r src/services/crisis_detection/requirements.txt
pip install -r src/services/recommendation/requirements.txt
```

### 2. Configure environment

Copy the template and fill in your values:

```bash
cp .env.free-tier.template .env
```

Key variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_WS_URL=ws://localhost:5000
GROQ_API_KEY=your_groq_api_key
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
DATABASE_URL=postgresql://user:pass@localhost:5432/mindsafe  # optional
```

### 3. Start all services

Run each in a separate terminal:

```bash
# Terminal 1 — Frontend (Next.js)
npm run dev

# Terminal 2 — Backend API (Node.js)
cd src/backend && node server.js

# Terminal 3 — Chatbot service (required for AI Companion)
python src/services/chatbot/main.py

# Terminal 4 — Emotion detection (optional, enhances chatbot)
python src/services/emotion_detection/main.py

# Terminal 5 — Other services (optional)
python src/services/crisis_detection/main.py
python src/services/mood_analytics/main.py
python src/services/recommendation/main.py
```

### 4. Verify

Open http://localhost:3000 — sign up, then try the AI Companion.

Quick health checks:

```bash
curl http://localhost:3000        # Frontend
curl http://localhost:5000/health  # Backend API
curl http://localhost:8004/health  # Chatbot service
```

## Smoke Tests

```bash
npm run smoke:api             # API smoke tests (stack must be running)
npm run smoke:api:compose     # Docker Compose + smoke tests
npm run smoke:mood            # Mood API tests
```

## Docker Deployment

```bash
# Local
docker compose up -d --build

# Production
docker compose -f docker-compose.prod.yml up -d --build
```

## Project Structure

```
src/
├── app/              # Next.js pages and routes
├── backend/          # Node.js Express API server
├── components/       # React components
├── hooks/            # Custom React hooks
├── lib/              # Shared utilities and helpers
├── services/         # Python FastAPI microservices
│   ├── chatbot/          # AI companion (port 8004)
│   ├── emotion_detection/ # NLP emotion analysis (port 8001)
│   ├── mood_analytics/   # Mood tracking analytics (port 8002)
│   ├── crisis_detection/ # Crisis detection (port 8003)
│   └── recommendation/   # Recommendations (port 8005)
├── deploy/           # Database schemas, Prometheus config
└── docker/           # Dockerfiles for each service
docs/                 # API docs, architecture, guides
infra/                # Nginx, Terraform configs
tests/                # Smoke and integration tests
.github/              # Agent definitions (AGENTS.md, agent files)
```

## Troubleshooting

| Problem                              | Fix                                                              |
| ------------------------------------ | ---------------------------------------------------------------- |
| Frontend stuck on "Compiling"        | Delete `.next/` folder and restart `npm run dev`                 |
| "Trouble connecting" in AI Companion | Start the chatbot service: `python src/services/chatbot/main.py` |
| 401 Unauthorized on API calls        | Sign up / log in first — all API routes require JWT auth         |
| Python module not found              | Activate venv and install requirements for the specific service  |
| Port already in use                  | Kill the process: `npx kill-port 3000` (or whichever port)       |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment Architecture](docs/DEPLOYMENT_ARCHITECTURE.md)
- [Quick Start Guide](docs/QUICK_START_GUIDE.md)
- [Quick Reference](docs/QUICK_REFERENCE.md)
- [API Documentation](docs/api/REST-API.md)
- [Encryption Implementation](docs/ENCRYPTION_IMPLEMENTATION.md)
