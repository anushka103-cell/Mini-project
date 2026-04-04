/*
  MindSafe API smoke test matrix.
  Usage:
    npm run smoke:api
    API_BASE_URL=http://localhost:5000 npm run smoke:api
*/

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

const results = [];

function randomEmail(prefix = "smoke") {
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

  return {
    status: response.status,
    payload,
  };
}

function record(name, expected, actual, details = "") {
  const pass = expected === actual;
  results.push({ name, expected, actual, pass, details });
  const marker = pass ? "PASS" : "FAIL";
  console.log(`${marker} | ${name} | expected=${expected} actual=${actual}`);
  if (!pass && details) {
    console.log(`  details: ${details}`);
  }
}

function stringifyPayload(payload) {
  try {
    return typeof payload === "string" ? payload : JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function expectStructuredError(name, payload) {
  const ok =
    payload &&
    typeof payload === "object" &&
    typeof payload.message === "string" &&
    payload.error &&
    typeof payload.error.status === "number";

  record(
    `${name} structured error payload`,
    true,
    ok,
    stringifyPayload(payload),
  );
}

async function run() {
  console.log(`Running smoke tests against ${API_BASE_URL}`);

  const health = await request("/health");
  record("api /health", 200, health.status, stringifyPayload(health.payload));

  const email = randomEmail("smoke");
  const password = "Password123!";
  const mobile = `+1555${String(Date.now()).slice(-7)}`;

  const register = await request("/api/register", {
    method: "POST",
    body: { email, password },
  });
  record(
    "auth register valid",
    201,
    register.status,
    stringifyPayload(register.payload),
  );

  const verificationToken = register.payload?.emailVerificationToken;

  // In production, verification tokens are not returned (sent via email only).
  // The smoke test adapts: if token is present (dev), verify via API;
  // otherwise, verify directly in the database.
  const isProd = !verificationToken;
  record(
    "auth register returns verification token (dev) or message (prod)",
    true,
    isProd
      ? typeof register.payload?.message === "string"
      : typeof verificationToken === "string" && verificationToken.length > 0,
    stringifyPayload(register.payload),
  );

  if (verificationToken) {
    const verifyEmail = await request("/api/verify-email", {
      method: "POST",
      body: { token: verificationToken },
    });
    record(
      "auth verify email valid",
      200,
      verifyEmail.status,
      stringifyPayload(verifyEmail.payload),
    );
  } else {
    // Production fallback: verify user directly via DB admin endpoint or
    // accept that login will return 403 ("Verify your email").
    // We attempt verification via a direct API call if available.
    const verifyDirect = await request("/api/admin/verify-user", {
      method: "POST",
      body: { email },
    });
    if (verifyDirect.status === 200) {
      record("auth prod verify email (admin)", 200, verifyDirect.status, "");
    } else {
      console.log(
        "  [INFO] No admin verify endpoint — login may fail (email unverified). This is expected in production.",
      );
    }
  }

  const login = await request("/api/login", {
    method: "POST",
    body: { email, password },
  });
  record(
    "auth login valid",
    200,
    login.status,
    stringifyPayload(login.payload),
  );

  const token = login.payload && login.payload.token;
  if (!token) {
    record("auth token issued", true, false, stringifyPayload(login.payload));
    finish();
    return;
  }

  record("auth token issued", true, true, `token_len=${token.length}`);
  const authHeaders = { Authorization: `Bearer ${token}` };

  const profilePost = await request("/api/profile", {
    method: "POST",
    headers: authHeaders,
    body: {
      fullName: "Smoke User",
      email,
      mobile,
      anonymousName: "Smoke User",
      anonymousMode: true,
    },
  });
  record(
    "profile post valid",
    200,
    profilePost.status,
    stringifyPayload(profilePost.payload),
  );

  const profileGet = await request("/api/profile", {
    method: "GET",
    headers: authHeaders,
  });
  record(
    "profile get valid",
    200,
    profileGet.status,
    stringifyPayload(profileGet.payload),
  );

  const chatPost = await request("/api/chat", {
    method: "POST",
    headers: authHeaders,
    body: { role: "user", content: "smoke hello" },
  });
  record(
    "chat post valid",
    200,
    chatPost.status,
    stringifyPayload(chatPost.payload),
  );

  const moodLogFirst = await request("/api/moods/log", {
    method: "POST",
    headers: authHeaders,
    body: {
      mood_score: 4,
      mood_label: "Sad",
      notes: "smoke first same-day",
      logged_at: new Date().toISOString(),
    },
  });
  record(
    "mood first log valid",
    201,
    moodLogFirst.status,
    stringifyPayload(moodLogFirst.payload),
  );

  const moodLogSecond = await request("/api/moods/log", {
    method: "POST",
    headers: authHeaders,
    body: {
      mood_score: 8,
      mood_label: "Happy",
      notes: "smoke second same-day",
      logged_at: new Date().toISOString(),
    },
  });
  record(
    "mood second log valid",
    201,
    moodLogSecond.status,
    stringifyPayload(moodLogSecond.payload),
  );

  const moodLogs = await request("/api/moods/logs?days=1", {
    method: "GET",
    headers: authHeaders,
  });
  record(
    "mood logs read valid",
    200,
    moodLogs.status,
    stringifyPayload(moodLogs.payload),
  );

  const moodLogsIsArray = Array.isArray(moodLogs.payload);
  record(
    "mood logs payload array",
    true,
    moodLogsIsArray,
    stringifyPayload(moodLogs.payload),
  );

  const moodLogsHasTwoEntries = moodLogsIsArray && moodLogs.payload.length >= 2;
  record(
    "mood same-day append",
    true,
    moodLogsHasTwoEntries,
    stringifyPayload(moodLogs.payload),
  );

  const moodNotes = moodLogsIsArray ? moodLogs.payload.map((x) => x.notes) : [];
  const moodBothNotesPresent =
    moodNotes.includes("smoke first same-day") &&
    moodNotes.includes("smoke second same-day");
  record(
    "mood logs include both same-day notes",
    true,
    moodBothNotesPresent,
    stringifyPayload(moodLogs.payload),
  );

  const moodNewestFirst =
    moodLogsIsArray &&
    moodLogs.payload.length >= 2 &&
    (moodLogs.payload[0]?.id ?? 0) >= (moodLogs.payload[1]?.id ?? 0);
  record(
    "mood logs newest first",
    true,
    moodNewestFirst,
    stringifyPayload(moodLogs.payload),
  );

  const avatarPost = await request("/api/avatar", {
    method: "POST",
    headers: authHeaders,
    body: { avatar3D: "https://example.com/avatar.glb" },
  });
  record(
    "avatar post valid",
    200,
    avatarPost.status,
    stringifyPayload(avatarPost.payload),
  );

  const badEmail = await request("/api/register", {
    method: "POST",
    body: { email: "bad", password: "Password123!" },
  });
  record(
    "auth register bad email",
    400,
    badEmail.status,
    stringifyPayload(badEmail.payload),
  );
  expectStructuredError("auth register bad email", badEmail.payload);

  const badPassword = await request("/api/register", {
    method: "POST",
    body: { email: randomEmail("shortpass"), password: "123" },
  });
  record(
    "auth register short password",
    400,
    badPassword.status,
    stringifyPayload(badPassword.payload),
  );
  expectStructuredError("auth register short password", badPassword.payload);

  const wrongPass = await request("/api/login", {
    method: "POST",
    body: { email, password: "WrongPass!" },
  });
  record(
    "auth login wrong password",
    400,
    wrongPass.status,
    stringifyPayload(wrongPass.payload),
  );

  const profileBadMode = await request("/api/profile", {
    method: "POST",
    headers: authHeaders,
    body: { anonymousMode: "yes" },
  });
  record(
    "profile invalid anonymousMode",
    400,
    profileBadMode.status,
    stringifyPayload(profileBadMode.payload),
  );
  expectStructuredError(
    "profile invalid anonymousMode",
    profileBadMode.payload,
  );

  const chatBadRole = await request("/api/chat", {
    method: "POST",
    headers: authHeaders,
    body: { role: "bot", content: "hello" },
  });
  record(
    "chat invalid role",
    400,
    chatBadRole.status,
    stringifyPayload(chatBadRole.payload),
  );
  expectStructuredError("chat invalid role", chatBadRole.payload);

  const moodBadValue = await request("/api/moods/log", {
    method: "POST",
    headers: authHeaders,
    body: { mood_score: 11, mood_label: "Excited" },
  });
  record(
    "mood invalid score",
    400,
    moodBadValue.status,
    stringifyPayload(moodBadValue.payload),
  );
  record(
    "mood invalid score has message",
    true,
    typeof moodBadValue.payload?.message === "string",
    stringifyPayload(moodBadValue.payload),
  );

  const avatarBadUrl = await request("/api/avatar", {
    method: "POST",
    headers: authHeaders,
    body: { avatar3D: "not-a-url" },
  });
  record(
    "avatar invalid url",
    400,
    avatarBadUrl.status,
    stringifyPayload(avatarBadUrl.payload),
  );
  expectStructuredError("avatar invalid url", avatarBadUrl.payload);

  const malformedHeader = await request("/api/profile", {
    method: "GET",
    headers: { Authorization: "Token abc" },
  });
  record(
    "auth malformed header",
    401,
    malformedHeader.status,
    stringifyPayload(malformedHeader.payload),
  );
  expectStructuredError("auth malformed header", malformedHeader.payload);

  const missingHeader = await request("/api/profile", {
    method: "GET",
  });
  record(
    "auth missing header",
    401,
    missingHeader.status,
    stringifyPayload(missingHeader.payload),
  );
  expectStructuredError("auth missing header", missingHeader.payload);

  finish();
}

function finish() {
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;

  console.log("\n--- Smoke Test Summary ---");
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error("Smoke test runner error:", error);
  process.exit(1);
});
