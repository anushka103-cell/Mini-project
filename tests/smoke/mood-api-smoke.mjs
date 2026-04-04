/*
  Mood API smoke test through gateway.
  Usage:
    npm run smoke:mood
    API_BASE_URL=http://localhost:5000 npm run smoke:mood
*/

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

function randomEmail(prefix = "mood") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;
}

async function request(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...headers,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  return { status: response.status, payload };
}

function assertStatus(name, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${name} failed: expected ${expected}, got ${actual}`);
  }
}

async function run() {
  console.log(`Running mood smoke test against ${API_BASE_URL}`);

  const email = randomEmail();
  const password = "Password123!";

  const register = await request("/api/register", {
    method: "POST",
    body: { email, password },
  });
  assertStatus("register", register.status, 201);

  const verificationToken = register.payload?.emailVerificationToken;
  if (verificationToken) {
    const verifyEmail = await request("/api/verify-email", {
      method: "POST",
      body: { token: verificationToken },
    });
    assertStatus("verify email", verifyEmail.status, 200);
  } else {
    // Production: token not returned (sent via email).
    // Try admin endpoint; if unavailable, login may fail (expected).
    const verifyDirect = await request("/api/admin/verify-user", {
      method: "POST",
      body: { email },
    });
    if (verifyDirect.status !== 200) {
      console.log(
        "  [WARN] No admin verify — login may fail (email unverified). Expected in production.",
      );
    }
  }

  const login = await request("/api/login", {
    method: "POST",
    body: { email, password },
  });
  assertStatus("login", login.status, 200);

  const token = login.payload && login.payload.token;
  if (!token) {
    throw new Error("login did not return token");
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  const first = await request("/api/moods/log", {
    method: "POST",
    headers: authHeaders,
    body: {
      mood_score: 4,
      mood_label: "Sad",
      notes: "gateway first same-day",
      logged_at: new Date().toISOString(),
    },
  });
  assertStatus("first mood log", first.status, 201);

  const second = await request("/api/moods/log", {
    method: "POST",
    headers: authHeaders,
    body: {
      mood_score: 8,
      mood_label: "Happy",
      notes: "gateway second same-day",
      logged_at: new Date().toISOString(),
    },
  });
  assertStatus("second mood log", second.status, 201);

  const logs = await request("/api/moods/logs?days=1", {
    method: "GET",
    headers: authHeaders,
  });
  assertStatus("mood logs", logs.status, 200);

  if (!Array.isArray(logs.payload)) {
    throw new Error("logs payload is not an array");
  }

  if (logs.payload.length < 2) {
    throw new Error(`expected at least 2 logs, got ${logs.payload.length}`);
  }

  const notes = logs.payload.map((x) => x.notes);
  if (
    !notes.includes("gateway first same-day") ||
    !notes.includes("gateway second same-day")
  ) {
    throw new Error("same-day logs were not both returned");
  }

  if ((logs.payload[0]?.id ?? 0) < (logs.payload[1]?.id ?? 0)) {
    throw new Error("logs are not returned newest-first");
  }

  console.log("PASS | mood same-day append via gateway");
}

run().catch((err) => {
  console.error("FAIL | mood smoke test", err.message || err);
  process.exitCode = 1;
});
