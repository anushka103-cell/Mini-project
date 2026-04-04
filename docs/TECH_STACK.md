# MindSafe Tech Stack Guide

A complete guide to every technology in the MindSafe platform — what it is, why we use it, and how it works.

---

## Architecture Overview

```
┌─────────────┐      ┌──────────────────┐      ┌────────────────────────┐
│   Frontend   │─────▶│   API Gateway    │─────▶│   Python Microservices │
│  (Next.js)   │      │  (Express.js)    │      │  (FastAPI)             │
│   Vercel     │      │   Render         │      │   Render               │
└─────────────┘      └──────────────────┘      └────────────────────────┘
                              │                          │
                              ▼                          ▼
                     ┌──────────────┐         ┌──────────────────┐
                     │  PostgreSQL  │         │  External APIs   │
                     │  (Neon)      │         │  (Groq, HF)      │
                     └──────────────┘         └──────────────────┘
```

**How a request flows:** User clicks "Send" in the browser → Next.js frontend makes an HTTP request to the Express API gateway on Render → Express authenticates the JWT token, then forwards the request to the appropriate Python microservice (e.g., chatbot) → the microservice processes it (maybe calling Groq AI or the database) → response travels back the same path to the user's screen.

---

## 1. Frontend

### Next.js 16 (React 19)

Next.js is a **full-stack React framework** created by Vercel. Think of it as React with superpowers — it adds routing, server-side rendering, and build optimization on top of React. In plain React, you'd need to install a separate router, configure webpack, and handle SSR yourself. Next.js does all of this out of the box.

We use the **App Router** (the `src/app/` directory). Every folder inside `src/app/` becomes a URL route automatically. For example, `src/app/login/page.js` becomes the `/login` page. The `layout.js` file wraps all pages with shared UI like the sidebar and theme provider. The `(protected)` folder uses a route group — the parentheses mean "don't include this in the URL" but all pages inside require authentication via `AuthGuard`.

Next.js gives us **server-side rendering (SSR)**: the first page load is pre-rendered HTML (fast, SEO-friendly), then React "hydrates" and takes over in the browser for interactivity. Environment variables prefixed with `NEXT_PUBLIC_` are embedded at build time — that's why you must redeploy on Vercel after changing them.

### React 19

React is the **UI library** that the entire frontend is built with. It uses a component model — you break the UI into reusable pieces (like `<Sidebar>`, `<Avatar3D>`, `<Onboarding>`) that each manage their own state and rendering.

React maintains a **virtual DOM** — a lightweight copy of the actual browser DOM. When state changes (e.g., a new chat message arrives), React compares the old virtual DOM with the new one, calculates the minimum changes needed, and updates only those specific elements. This is called "reconciliation" and makes updates fast even for complex UIs.

**Hooks** are functions that let components use React features:

- `useState(initialValue)` — Creates a state variable. Calling the setter re-renders the component. Example: `const [messages, setMessages] = useState([])`.
- `useEffect(fn, deps)` — Runs side effects (API calls, subscriptions) after render. Empty `[]` means "run once on mount." If you pass `[userId]`, it re-runs whenever `userId` changes.
- `useRef(value)` — Holds a mutable value that persists across renders without causing re-renders. Used for DOM references (like focusing an input) and timers.
- `useCallback(fn, deps)` — Memoizes a function so it's not recreated every render. Prevents unnecessary re-renders of child components that receive the function as a prop.

### Tailwind CSS 3

Tailwind is a **utility-first CSS framework**. Instead of writing CSS in separate files with class names like `.btn-primary { background: blue; padding: 16px; }`, you compose styles directly in JSX:

```jsx
<button className="bg-blue-500 p-4 rounded-lg hover:bg-blue-600 text-white">
  Click me
</button>
```

Each utility class does exactly one thing: `bg-blue-500` sets background color, `p-4` adds 16px padding, `rounded-lg` rounds corners, `hover:` applies on mouse hover. This eliminates naming conflicts, dead CSS, and the mental overhead of switching between files.

The `tailwind.config.js` file customizes the design system — the dark theme colors, spacing scale, and responsive breakpoints used across MindSafe are all defined there. At build time, Tailwind purges unused classes, producing a tiny final CSS file (~10KB).

### Three.js + React Three Fiber

**Three.js** is a JavaScript library that renders 3D graphics using WebGL (the browser's GPU interface). **React Three Fiber** (R3F) is a React renderer for Three.js — it lets you write 3D scenes using JSX components like `<mesh>`, `<ambientLight>`, `<Canvas>` instead of imperative Three.js code.

In MindSafe, this powers the **3D VRM avatar** on the AI Companion page. VRM is an open format for 3D humanoid avatars (popular in VTuber apps). The `@pixiv/three-vrm` library loads `.vrm` files and provides controls for facial expressions and body poses. `@react-three/drei` adds helpful components like orbit controls and loaders. The avatar responds to conversation emotion — if the AI detects sadness, the avatar shows an empathetic expression.

### Recharts

Recharts is a **charting library** built on React and D3.js. It provides pre-built components like `<LineChart>`, `<BarChart>`, `<PieChart>`, and `<RadarChart>` that you compose declaratively. In MindSafe, it renders the **mood tracking dashboard** — line charts showing mood over time, bar charts for emotion distribution, and trend indicators. Each chart is a React component that accepts data as props and handles responsive resizing, animations, and tooltips automatically.

### Socket.IO Client

**Socket.IO** enables **real-time, bidirectional communication** between the browser and server using WebSockets. Unlike HTTP (client always initiates), WebSockets keep a persistent connection open — the server can push messages to the client instantly without the client asking.

In MindSafe, Socket.IO powers the **anonymous peer-to-peer chat**. When User A sends a message, it's emitted as a Socket.IO event to the server, which immediately broadcasts it to User B — no polling or page refresh needed. It also handles typing indicators ("User is typing..."), reconnection on network drops, and room management (matching two anonymous users together). The client library (`socket.io-client`) runs in the browser.

### DiceBear

DiceBear is an **avatar generation library** that creates unique, deterministic avatars from a seed string (like a user ID). It provides multiple art styles (pixel art, shapes, initials). In MindSafe, it generates default profile avatars for users who don't upload a photo — every user gets a visual identity while maintaining anonymity.

---

## 2. API Gateway (Node.js Backend)

### Express.js 5

Express is the most popular **web framework for Node.js**. It provides a request/response pipeline where you chain **middleware** functions that process each HTTP request sequentially — like an assembly line. Each function can inspect, modify, or reject the request before passing it to the next.

In MindSafe, Express serves as the **API Gateway** — the single entry point for all frontend requests. The processing pipeline looks like:

```
HTTP Request → CORS middleware → Helmet (security headers) → Rate limiter
→ JSON parser → Route matcher → Auth middleware (JWT verify) → Controller → Response
```

When the controller needs AI features (chat, emotion analysis), it makes an HTTP request to the appropriate Python microservice and returns the result. This **gateway pattern** means the frontend only talks to one backend URL, while behind the scenes there are 5 separate services.

### JSON Web Tokens (JWT) — `jsonwebtoken`

JWT is the **authentication system**. Instead of storing sessions on the server (which requires a database lookup on every request), JWTs are self-contained tokens the client carries.

A JWT has three parts separated by dots: `header.payload.signature`. The **header** declares the algorithm (HS256). The **payload** contains claims like `{ userId: "abc123", email: "user@example.com", exp: 1712346578 }`. The **signature** is an HMAC hash of the first two parts using the `JWT_SECRET` — this proves the token hasn't been tampered with.

When a user logs in, the server creates two tokens:

- **Access token** (15 minutes) — Sent in every API request as `Authorization: Bearer eyJhbGci...`. Short-lived for security.
- **Refresh token** (7 days) — Used to get a new access token when the old one expires, without the user re-logging in.

MindSafe uses **four separate JWT secrets** for different purposes (access, refresh, email verification, password reset). If one is compromised, the others remain secure.

### bcryptjs

bcrypt is a **password hashing algorithm** designed to be intentionally slow. When a user signs up, their password is run through bcrypt with 12 rounds (2^12 = 4096 iterations of a cipher). The result is a 60-character hash like `$2a$12$LJ3m4ys3...` stored in the database.

**Why slow?** If an attacker steals the database, they'd try cracking passwords by hashing millions of guesses. bcrypt's slowness means each guess takes ~250ms instead of microseconds, making brute-force impractical. Each hash includes a unique random **salt** — so even if two users have the same password, their hashes are completely different. The original password can never be recovered from the hash (one-way function).

### Helmet

Helmet is a **security middleware** that sets HTTP response headers to protect against common web attacks. One line (`app.use(helmet())`) configures ~15 headers:

- **Content-Security-Policy** — Controls which scripts/styles/images can load. Blocks XSS attacks where an attacker injects a `<script>` tag.
- **X-Frame-Options: DENY** — Prevents your site from being embedded in an `<iframe>`, blocking clickjacking.
- **X-Content-Type-Options: nosniff** — Stops browsers from guessing MIME types (prevents MIME confusion attacks).
- **Strict-Transport-Security** — Forces HTTPS for all future visits, even if user types `http://`.

### express-rate-limit

Rate limiting **caps how many requests** a single IP can make in a time window. MindSafe allows roughly 100 requests per 15 minutes. If someone tries to brute-force a login (thousands of passwords), they're blocked after 100 attempts with a `429 Too Many Requests` response.

It tracks request counts per IP in memory. When the window expires, counters reset. This protects against brute-force attacks, credential stuffing, and API abuse. The login endpoint has stricter limits than general endpoints.

### CORS — `cors`

**Cross-Origin Resource Sharing** is a browser security mechanism. By default, JavaScript on `mind-safe-tan.vercel.app` cannot make fetch requests to `mindsafe-api.onrender.com` — different domains. This is the browser's **Same-Origin Policy**.

CORS relaxes this: the server sends headers like `Access-Control-Allow-Origin: https://mind-safe-tan.vercel.app` telling the browser "this origin is trusted." The `cors` middleware reads `CORS_ORIGINS` from the environment and adds these headers. Without it, every API call from the frontend would fail with a CORS error.

For non-simple requests (POST with JSON, requests with auth headers), the browser first sends a **preflight OPTIONS request** to check permissions before the actual request.

### Socket.IO (Server)

The server-side Socket.IO library manages **WebSocket connections** for the anonymous chat system:

- **Connection management** — Each browser tab gets a unique socket ID. The server tracks who's connected.
- **Room-based messaging** — Two matched users join a private "room." Messages only reach those two.
- **Matching engine** — Queues users waiting for a partner and pairs them.
- **Events** — Custom events like `send_message`, `typing`, `disconnect` with handler functions.
- **Reconnection** — If a user loses internet briefly, Socket.IO auto-reconnects and restores the session.
- **Fallback** — If WebSockets are blocked (corporate firewalls), it falls back to HTTP long-polling.

### pg (node-postgres)

`pg` is the **PostgreSQL driver for Node.js**. It manages a **connection pool** — instead of opening a new database connection per query (slow), it keeps reusable connections ready. When a query comes in, it borrows a connection, executes, and returns it.

In MindSafe, `pg` executes SQL queries for user management, auth data, and encrypted chat storage. The connection string includes `sslmode=require` — all data between the app and Neon database is encrypted in transit.

### ioredis

Redis is an **in-memory key-value store** — a super-fast dictionary that can store strings, lists, and hashes with automatic expiration. `ioredis` is the Node.js client.

MindSafe uses Redis for: anonymous chat reconnection codes (survive page refresh), rate limiting counters, and temporary session data. Since Redis keeps everything in RAM, operations take microseconds vs milliseconds for a database. MindSafe gracefully falls back to in-memory Maps when Redis is unavailable.

### Resend + Nodemailer

**Resend** is a modern email API — you call their API with recipient, subject, and HTML body, and they handle delivery. Used for verification emails ("Click to verify") and password reset links.

**Nodemailer** is a Node.js SMTP library that serves as a fallback. If Resend is unavailable, MindSafe can use any SMTP server (Gmail, custom server) to send the same emails. Two providers ensure delivery reliability.

---

## 3. Python Microservices

### FastAPI

FastAPI is a **modern Python web framework** for building APIs. Its standout features are automatic request validation, built-in async support, and auto-generated interactive documentation.

```python
@app.post("/chat")
async def chat(request: ChatRequest):
    return {"response": "Hello!"}
```

FastAPI automatically: (1) validates request body matches `ChatRequest` → returns 422 with details if not, (2) generates Swagger docs at `/docs` you can test from the browser, (3) handles async I/O so one slow request doesn't block others. It's built on Starlette (ASGI framework) and Pydantic (validation), and benchmarks comparable to Node.js and Go.

### Uvicorn

Uvicorn is an **ASGI server** — the process that listens on a port and feeds HTTP requests to your FastAPI app. Think of FastAPI as the recipe and Uvicorn as the kitchen.

```bash
uvicorn main:app --host 0.0.0.0 --port 8004
```

This means: from `main.py`, get the `app` object, listen on all interfaces (`0.0.0.0`) on port 8004. Binding to `0.0.0.0` (not `localhost`) is required in cloud environments to accept external connections. Uvicorn is built on `uvloop` (a fast async event loop in Cython) for high performance.

### Pydantic

Pydantic provides **data validation** using Python type annotations. You define a model class, and Pydantic ensures incoming data matches:

```python
class MoodEntry(BaseModel):
    mood_score: int = Field(ge=1, le=10)   # Integer between 1-10
    note: str = Field(max_length=500)       # Max 500 chars
    timestamp: datetime = None              # Optional
```

If someone sends `{"mood_score": "abc"}`, Pydantic returns: "mood_score: value is not a valid integer." This eliminates manual validation code. FastAPI uses Pydantic automatically for request bodies, query parameters, and responses.

### The Four Microservices

| Service               | Port | Purpose                                  | Key Dependency                |
| --------------------- | ---- | ---------------------------------------- | ----------------------------- |
| **Chatbot**           | 8004 | AI conversation with mental health focus | `groq` (LLM API)              |
| **Emotion Detection** | 8001 | Sentiment & emotion analysis from text   | `httpx` (HuggingFace API)     |
| **Mood Analytics**    | 8002 | Mood tracking, streaks, trends           | `sqlalchemy` + `psycopg2`     |
| **Crisis Detection**  | 8003 | Detects crisis language in messages      | Rule-based + keyword matching |

**Why microservices?** Each service can be scaled, deployed, and updated independently. If the chatbot crashes, mood tracking still works. Different services use different tools optimized for their task. The downside is network overhead between services — but at MindSafe's scale, it's negligible.

- **Chatbot**: Receives user message + history, builds a system prompt with mental health guidelines (empathetic tone, crisis awareness, no medical advice), sends to Groq LLM, returns AI response. Also manages conversation memory and sessions.
- **Emotion Detection**: Takes text input and calls two HuggingFace models — one for binary sentiment (positive/negative) and one for six-way emotion classification (joy, anger, sadness, fear, surprise, disgust). Results feed the chatbot context and the analytics dashboard.
- **Mood Analytics**: Stores daily mood entries (score 1-10, note, tags) in PostgreSQL. Calculates streaks, 7-day/30-day trends, and historical patterns for the dashboard.
- **Crisis Detection**: Scans messages for crisis indicators (self-harm keywords, distress patterns). If detected, triggers safety resources (hotline numbers, breathing exercises). Uses rule-based matching — no ML model needed for this critical safety feature.

---

## 4. AI/ML Services

### Groq API

**Groq** is a cloud AI inference provider running LLMs on custom **Language Processing Units (LPUs)**. MindSafe uses it to run **Llama 3.3 70B** — a 70-billion parameter open-source model by Meta.

The chatbot sends an API request to Groq containing: a **system prompt** (the AI companion's personality, guidelines, safety rules), **conversation history** (last several messages for context), and the **user's latest message**. Groq returns a generated response in ~1-3 seconds.

Why Groq over OpenAI? Free tier available, extremely fast inference (~500 tokens/sec vs ~50 for GPT-4), and runs open-source models (no vendor lock-in). The 70B model is large enough for nuanced, empathetic conversations without needing our own GPU.

**Env var**: `GROQ_API_KEY` (get from console.groq.com)

### HuggingFace Inference API

**HuggingFace** is the largest open-source ML model repository (200k+ models). The **Inference API** runs any model on their cloud — send an HTTP POST with text, get predictions back. No local setup needed.

MindSafe uses two models:

1. **distilbert-base-uncased-finetuned-sst-2-english** — A compressed version of Google's BERT, fine-tuned on the Stanford Sentiment Treebank. Classifies text as POSITIVE or NEGATIVE with confidence. "I'm feeling great" → `{label: "POSITIVE", score: 0.9998}`. 60% faster than BERT with 97% accuracy.

2. **j-hartmann/emotion-english-distilroberta-base** — DistilRoBERTa fine-tuned to classify text into 7 emotions: anger, disgust, fear, joy, neutral, sadness, surprise. "I lost my job" → `{sadness: 0.82, fear: 0.10, anger: 0.05, ...}`.

We use the cloud API instead of local models because they need ~1-2GB RAM — Render free tier only has 512MB. API calls take ~0.5-2 seconds and are free for reasonable usage.

**Env var**: `HF_API_TOKEN` (get from huggingface.co/settings/tokens)

### httpx

`httpx` is a **modern Python HTTP client** (like `requests` but with async support). The emotion service uses it to call HuggingFace. It supports connection pooling, timeouts, and async/await — important for a non-blocking FastAPI service handling concurrent requests.

---

## 5. Database

### PostgreSQL (via Neon)

**PostgreSQL** is an open-source **relational database** storing data in tables with rows and columns, linked by foreign keys. Known for reliability, ACID compliance (Atomicity, Consistency, Isolation, Durability), and advanced features like JSON columns and full-text search.

**Neon** is a **serverless PostgreSQL** provider — you don't manage the database server. Neon handles backups, scaling, and uptime with a free tier. Connection uses standard PostgreSQL protocol over SSL:

```
postgresql://user:password@ep-host.aws.neon.tech/dbname?sslmode=require
```

MindSafe's database stores:

- **users** — email, hashed password, verification status
- **mood_entries** — user ID, mood score (1-10), notes, tags, timestamp
- **chat_messages** — encrypted conversation history (AES-256-GCM)
- **encrypted_profiles** — preferences and anonymized names (encrypted at rest)

### SQLAlchemy (Python)

SQLAlchemy is a **Python ORM (Object-Relational Mapper)** — interact with the database using Python classes instead of raw SQL:

```python
class MoodEntry(Base):
    __tablename__ = "mood_entries"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False)
    mood_score = Column(Integer)
```

Query with Python: `session.query(MoodEntry).filter_by(user_id="abc").all()` instead of `SELECT * FROM mood_entries WHERE user_id = 'abc'`. SQLAlchemy handles SQL generation, connection pooling, transactions, and prevents SQL injection. The mood analytics service uses it exclusively.

### psycopg2-binary

`psycopg2` is the **low-level PostgreSQL adapter for Python** — the driver that speaks PostgreSQL's wire protocol. SQLAlchemy uses it under the hood. The `-binary` variant ships pre-compiled, avoiding C compilation during install (important on Render's build servers).

---

## 6. Infrastructure & Deployment

### Vercel

**Vercel** is a **frontend hosting platform** by the Next.js creators. When you push to GitHub, Vercel:

1. Detects the framework (Next.js)
2. Runs `next build` to compile the app
3. Deploys to a global **CDN** — your site is cached on servers worldwide (users in India served from an Asian edge server)
4. Provisions a free SSL certificate (HTTPS)
5. Assigns URL: `mind-safe-tan.vercel.app`

Each PR gets a **preview deployment** for testing. `NEXT_PUBLIC_` env vars are baked into JavaScript at build time — you must redeploy after changing them.

### Render

**Render** is a **cloud platform for backends** (Heroku alternative). It runs Node.js and Python services in managed containers, auto-deploys from GitHub, and provides free SSL.

The **Blueprint** system (`render.yaml`) is infrastructure-as-code — defines all services, runtimes, build/start commands, env vars, and health checks in one file. Connect your repo and Render creates everything automatically.

**Free tier**: 512MB RAM per service, sleeps after 15 min idle (cold start takes ~30-50s), 750 hours/month total.

### Docker

Docker packages applications into **containers** — lightweight, portable units containing code, runtime, libraries, and config. Think of a shipping container for software: runs the same everywhere.

A **Dockerfile** is the recipe: start from a base image (`python:3.11-slim`), copy code, install dependencies, define the start command. `docker-compose.yml` orchestrates multiple containers — starts API gateway, all microservices, PostgreSQL, Redis, and Nginx together with `docker compose up`.

MindSafe uses Docker for **local development** — identical environments regardless of OS. Production on Render uses native runtimes (simpler builds).

### Nginx

**Nginx** (pronounced "engine-x") is a high-performance **web server and reverse proxy**. In MindSafe's Docker Compose setup, it sits in front of all services and routes by URL:

- `/api/*` → Express gateway (port 5000)
- `/chatbot/*` → Chatbot service (port 8004)
- `/emotion/*` → Emotion detection (port 8001)

Also handles SSL termination (decrypts HTTPS at the edge, forwards plain HTTP internally) and load balancing. Config: `infra/nginx/nginx.conf`. In production on Render, Render's own edge handles this.

### Terraform

**Terraform** is **Infrastructure-as-Code (IaC)** by HashiCorp. Instead of clicking through AWS consoles, you write config files:

```hcl
resource "aws_instance" "api" {
  ami           = "ami-0123456789"
  instance_type = "t3.micro"
}
```

`terraform apply` creates the resources. Change the file and apply again — only differences are updated. `terraform destroy` tears it down. In MindSafe, `infra/terraform/` has AWS definitions for scaling beyond free tier. Not used for current Vercel + Render deployment.

---

## 7. Security

### Encryption at Rest (AES-256-GCM)

**AES-256** is a symmetric encryption algorithm — same key encrypts and decrypts. MindSafe encrypts sensitive data before storing in the database: chat messages, profiles, personal notes.

**GCM (Galois/Counter Mode)** provides both **confidentiality** (unreadable without key) and **authenticity** (tampering detected). The `DATA_ENCRYPTION_KEY` is a 256-bit random key. Even if an attacker steals the entire database, they can't read messages without this key.

### HMAC Integrity (DATA_HMAC_KEY)

**HMAC (Hash-based Message Authentication Code)** is a keyed hash verifying data integrity. MindSafe computes an HMAC of encrypted data before storing and verifies before decrypting. If ciphertext was modified (bit-flip attack, corruption), the HMAC check fails. The HMAC key is separate from the encryption key — compromising one doesn't compromise the other.

### Password Hashing (bcrypt)

Passwords are **never stored reversibly**. bcrypt applies 4096 iterations of Blowfish cipher, producing a hash with an embedded random salt. Even identical passwords produce different hashes. An attacker with the database would need ~250ms per guess — making brute-force of any reasonable password impractical.

### HTTPS/SSL

All traffic between users and MindSafe is encrypted using **TLS** (Transport Layer Security). Vercel and Render provide automatic SSL certificates via Let's Encrypt. The padlock in the browser confirms this. Anyone intercepting traffic sees only encrypted bytes.

### Rate Limiting

Restricts requests per IP per time window. Without it, attackers could try 10,000 passwords/second. With ~100 requests per 15 minutes, brute-force is blocked immediately. Also prevents API abuse, scraping, and accidental DDoS.

### Helmet Headers

Defense-in-depth HTTP headers instructing browsers to enable security features:

- **CSP** — Blocks injected scripts (XSS prevention)
- **HSTS** — Forces HTTPS even if user types `http://`
- **X-Frame-Options** — Prevents clickjacking via iframe embedding

---

## 8. Monitoring (Optional)

### Prometheus

**Prometheus** is a **time-series metrics database**. It scrapes `/metrics` endpoints from services every ~15 seconds, collecting:

```
http_requests_total{method="POST", endpoint="/chat", status="200"} 1542
http_request_duration_seconds{endpoint="/chat"} 0.45
```

You can query: "How many 500 errors in the last hour?", "What's the 95th percentile latency?", "Is any service down?". Config: `src/deploy/prometheus.yml`.

### Sentry

**Sentry** is **error tracking**. When an unhandled exception occurs in production, Sentry captures the full stack trace, request context, and environment — then alerts you. It groups duplicate errors, tracks frequency, and shows which release introduced them. Integrated in emotion and crisis services via `sentry-sdk`.

### Grafana

**Grafana** is a **visualization platform** connecting to Prometheus for real-time dashboards with graphs, gauges, and alerts. While Prometheus stores metrics, Grafana makes them visual. Optional next step for MindSafe.

---

## Quick Reference Table

| Layer         | Technology                       | Language    | Purpose                             |
| ------------- | -------------------------------- | ----------- | ----------------------------------- |
| Frontend      | Next.js 16, React 19             | JavaScript  | UI, routing, SSR                    |
| Styling       | Tailwind CSS 3                   | CSS         | Utility-first styling               |
| 3D Avatar     | Three.js, React Three Fiber, VRM | JavaScript  | Animated avatar rendering           |
| Charts        | Recharts                         | JavaScript  | Mood/emotion visualizations         |
| Real-time     | Socket.IO                        | JavaScript  | Anonymous peer chat                 |
| Avatars       | DiceBear                         | JavaScript  | Default avatar generation           |
| API Gateway   | Express.js 5                     | Node.js     | Routing, auth, proxy                |
| Auth          | JWT + bcryptjs                   | Node.js     | Token auth, password hashing        |
| Security      | Helmet, CORS, rate-limit         | Node.js     | Headers, origin control, throttling |
| Email         | Resend + Nodemailer              | Node.js     | Verification & reset emails         |
| DB Driver     | pg + ioredis                     | Node.js     | PostgreSQL & Redis clients          |
| Microservices | FastAPI + Uvicorn + Pydantic     | Python 3.11 | AI/ML service endpoints             |
| AI Chat       | Groq (Llama 3.3 70B)             | Cloud API   | AI companion responses              |
| Emotion ML    | HuggingFace Inference API        | Cloud API   | Sentiment & emotion analysis        |
| HTTP Client   | httpx                            | Python      | Async API calls                     |
| Database      | PostgreSQL (Neon)                | SQL         | User data, encrypted messages       |
| ORM           | SQLAlchemy + psycopg2            | Python      | DB abstraction for mood service     |
| Encryption    | AES-256-GCM + HMAC               | Node.js     | Data at rest encryption             |
| Frontend Host | Vercel                           | —           | CDN, auto-deploy, SSL               |
| Backend Host  | Render                           | —           | Managed services, Blueprint         |
| Containers    | Docker + Compose                 | —           | Local dev environment               |
| Reverse Proxy | Nginx                            | —           | Routing + SSL (local Docker)        |
| IaC           | Terraform                        | HCL         | AWS infrastructure definitions      |
| Metrics       | Prometheus                       | —           | Service metrics collection          |
| Errors        | Sentry                           | Python      | Exception tracking                  |
| Dashboards    | Grafana                          | —           | Metrics visualization               |
