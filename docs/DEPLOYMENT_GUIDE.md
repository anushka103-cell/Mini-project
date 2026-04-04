# MindSafe Deployment Guide (Free Tier)

Complete step-by-step guide to deploy MindSafe on Vercel (frontend) + Render (backend) + Neon (database) — all free tier.

## Architecture Overview

```
┌─────────────────┐    ┌──────────────────────────────────────────┐
│  Vercel (Free)   │    │            Render (Free Tier)             │
│                  │    │                                          │
│  Next.js Frontend│───▶│  mindsafe-api     (Node.js API Gateway)  │
│                  │    │  mindsafe-chatbot  (Python/FastAPI)       │
└─────────────────┘    │  mindsafe-emotion  (Python/FastAPI)       │
                       │  mindsafe-mood     (Python/FastAPI)       │
                       │  mindsafe-crisis   (Python/FastAPI)       │
                       └──────────────┬───────────────────────────┘
                                      │
                              ┌───────▼───────┐
                              │  Neon (Free)   │
                              │  PostgreSQL DB │
                              └───────────────┘
```

## Prerequisites

- GitHub account with `PariBansal/Mind-Safe` repo
- Google account (for OAuth, optional)

---

## Step 1: Deploy Frontend to Vercel

1. Go to **https://vercel.com** → Sign in with GitHub
2. Click **"Add New Project"** → Import **`PariBansal/Mind-Safe`**
3. Vercel auto-detects `vercel.json`. Set these **Environment Variables**:
   - `NEXT_PUBLIC_API_URL` = _(leave blank — set after Render deploys)_
   - `NEXT_PUBLIC_WS_URL` = _(leave blank — set after Render deploys)_
4. Click **Deploy**
5. Note your Vercel domain (e.g. `https://mind-safe-tan.vercel.app`)

---

## Step 2: Set Up Neon PostgreSQL (Free)

1. Go to **https://neon.tech** → Sign up (free)
2. Create a new project: **"mindsafe"**, region: **Singapore** (or closest to you)
3. Copy the **connection string** — looks like:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Open Neon's **SQL Editor** and paste the contents of `src/deploy/postgres_schema.sql` to create the tables

---

## Step 3: Deploy Backend Services to Render

### 3a. Create Blueprint

1. Go to **https://render.com** → Sign in with GitHub
2. Click **"New" → "Blueprint"** → Connect **`PariBansal/Mind-Safe`**
3. Render auto-discovers `render.yaml` and creates 5 services:
   - `mindsafe-api` (Node.js) — API Gateway
   - `mindsafe-chatbot` (Python) — AI Chatbot
   - `mindsafe-emotion` (Python) — Emotion Detection
   - `mindsafe-mood` (Python) — Mood Analytics
   - `mindsafe-crisis` (Python) — Crisis Detection

### 3b. Set Environment Variables

When Render prompts for manual env vars (`sync: false`), set:

**mindsafe-api** (required):

| Variable                | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| `DATABASE_URL`          | Your Neon connection string from Step 2                   |
| `CORS_ORIGINS`          | Your Vercel URL (e.g. `https://mind-safe-tan.vercel.app`) |
| `CHATBOT_SERVICE_URL`   | `https://mindsafe-chatbot.onrender.com`                   |
| `EMOTION_DETECTION_URL` | `https://mindsafe-emotion.onrender.com`                   |
| `MOOD_ANALYTICS_URL`    | `https://mindsafe-mood.onrender.com`                      |
| `CRISIS_DETECTION_URL`  | `https://mindsafe-crisis.onrender.com`                    |

**mindsafe-api** (optional — leave blank if not needed yet):

| Variable         | Value                                   |
| ---------------- | --------------------------------------- |
| `REDIS_URL`      | Upstash Redis URL (optional)            |
| `RABBITMQ_URL`   | CloudAMQP URL (optional)                |
| `RESEND_API_KEY` | Resend.com API key for email (optional) |

**mindsafe-chatbot** (required for AI chat):

| Variable       | Value                                                                          |
| -------------- | ------------------------------------------------------------------------------ |
| `GROQ_API_KEY` | Groq API key from [console.groq.com](https://console.groq.com) (starts `gsk_`) |

> **Without `GROQ_API_KEY`**, the chatbot falls back to generic template responses and all LLM quality features (quality filter, prompt engineering, retry logic) are disabled.

### 3c. Wait for Deploys

- **mindsafe-api** (Node.js) — builds in ~1 minute
- **mindsafe-crisis**, **mindsafe-mood** — build in ~2-3 minutes (lightweight Python)
- **mindsafe-emotion**, **mindsafe-chatbot** — build in ~5-10 minutes (larger dependencies)

Check each service in **Render Dashboard → Services** — all should show **Live**.

### 3d. Verify Health

Test each service's health endpoint:

```
https://mindsafe-api.onrender.com/health
https://mindsafe-chatbot.onrender.com/health
https://mindsafe-emotion.onrender.com/health
https://mindsafe-mood.onrender.com/health
https://mindsafe-crisis.onrender.com/health
```

---

## Step 4: Connect Vercel ↔ Render

Once `mindsafe-api` is Live:

1. Go to **Vercel** → Your Mind-Safe project → **Settings** → **Environment Variables**
2. Set:
   - `NEXT_PUBLIC_API_URL` = `https://mindsafe-api.onrender.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://mindsafe-api.onrender.com`
3. Click **Save**
4. Go to **Deployments** → click **"..."** on latest → **Redeploy**

---

## Step 5: Enable Google OAuth (Optional)

### 5a. Create Google OAuth Credentials

1. Go to **https://console.cloud.google.com**
2. Create a new project → name it **"MindSafe"**
3. Go to **APIs & Services** → **OAuth consent screen**
   - User type: **External**
   - App name: **MindSafe**
   - Support email: your email
   - Save and continue through all steps
4. Go to **APIs & Services** → **Credentials**
5. Click **"Create Credentials"** → **"OAuth client ID"**
   - Application type: **Web application**
   - Name: **MindSafe**
   - **Authorized JavaScript origins**:
     - `https://mind-safe-tan.vercel.app` _(your Vercel URL)_
   - **Authorized redirect URIs**:
     - `https://mindsafe-api.onrender.com/api/auth/google/callback`
6. Click **Create**
7. **Immediately copy** the **Client ID** and **Client Secret** from the popup

### 5b. Set OAuth Environment Variables on Render

Go to **Render** → **mindsafe-api** → **Environment** → Add:

| Variable               | Value                                                        |
| ---------------------- | ------------------------------------------------------------ |
| `GOOGLE_CLIENT_ID`     | `your-actual-client-id.apps.googleusercontent.com`           |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-your-actual-secret`                                  |
| `GOOGLE_CALLBACK_URL`  | `https://mindsafe-api.onrender.com/api/auth/google/callback` |

Click **Save Changes** → service auto-redeploys.

> **Note**: If you missed copying the secret, go to **Google Cloud Console → APIs & Services → Credentials** → click on your OAuth client → the Client ID and Secret are displayed there.

---

## Free Tier Limitations

| Service                       | Limitation                                                        |
| ----------------------------- | ----------------------------------------------------------------- |
| **Vercel**                    | 100GB bandwidth/month, serverless functions limited               |
| **Render free web services**  | 750 hours/month total, sleeps after 15 min idle (~50s cold start) |
| **Neon free PostgreSQL**      | 0.5 GB storage, 190 compute hours/month                           |
| **HuggingFace Inference API** | Rate limited (emotion detection uses this)                        |

### Important Notes

- Free Render services **sleep after 15 minutes of inactivity**. First request after sleep takes ~50 seconds.
- The API falls back to **in-memory storage** if PostgreSQL is unreachable (data lost on restart).
- Emotion detection uses **HuggingFace Inference API** (cloud) instead of local models to fit in 512MB RAM.
- Chatbot uses **Groq cloud API** for LLM responses — set `GROQ_API_KEY` in Render env vars for the chatbot service. Without this key, the chatbot uses template fallback (generic, repetitive responses).
- The Express API Gateway uses `trust proxy = 1` for correct client IP detection behind Render's reverse proxy (needed for rate limiting).
- Rate limiting is set to **1000 requests per 15 minutes** in production.
- Google OAuth now saves the user's Google profile name automatically.
- Frontend auto-retries once after 3 seconds on 502 errors (Render cold start). Backend also retries chatbot requests on 5xx/network errors.
- The `mindsafe-worker` (background worker) is not deployed — Render free tier doesn't support `type: worker`.

---

## Troubleshooting

### Service crashes with "Exited with status 1"

- Check the deploy logs in Render for the specific error
- Most common: missing environment variable — add it in the Environment tab

### "Ran out of memory (used over 512MB)"

- Python services must not load large ML models locally
- Emotion service uses HuggingFace Inference API (no local torch)
- Chatbot service uses Groq API (no local transformers)

### Chatbot gives generic/repetitive responses

- **Root cause**: `GROQ_API_KEY` is not set on the mindsafe-chatbot service in Render
- Go to Render → mindsafe-chatbot → Environment → add `GROQ_API_KEY`
- Get a key from [console.groq.com](https://console.groq.com) → API Keys (sign in with Google)
- Redeploy after adding the key

### CORS errors in browser

- Verify `CORS_ORIGINS` on Render mindsafe-api matches your exact Vercel URL
- Include the protocol: `https://mind-safe-tan.vercel.app`

### Google OAuth "redirect_uri_mismatch"

- The redirect URI in Google Console must exactly match `GOOGLE_CALLBACK_URL`
- Check for trailing slashes — `https://mindsafe-api.onrender.com/api/auth/google/callback`

### Python services fail to build

- Ensure `.python-version` file exists in the service's `rootDir` (pinned to 3.11.12)
- Avoid exact version pins (`==`) for packages — use minimum bounds (`>=`)

---

## Service URLs Reference

| Service           | URL                                        |
| ----------------- | ------------------------------------------ |
| Frontend          | `https://mind-safe-tan.vercel.app`         |
| API Gateway       | `https://mindsafe-api.onrender.com`        |
| Chatbot           | `https://mindsafe-chatbot.onrender.com`    |
| Emotion Detection | `https://mindsafe-emotion.onrender.com`    |
| Mood Analytics    | `https://mindsafe-mood.onrender.com`       |
| Crisis Detection  | `https://mindsafe-crisis.onrender.com`     |
| Health Check      | `https://mindsafe-api.onrender.com/health` |

> **Note**: Replace the Vercel URL with your actual domain if different.
