const {
  CHATBOT_SERVICE_URL,
  MOOD_ANALYTICS_URL,
  RECOMMENDATION_SERVICE_URL,
} = require("../config/env");

function getRoot(_req, res) {
  res.json({ message: "MindSafe Backend Running" });
}

function getHealth(_req, res) {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Ping all Render-hosted microservices and wait (with retries) until each
 * one responds.  Returns the actual readiness status so the frontend knows
 * whether a cold start is still in progress.
 */
async function warmup(_req, res) {
  const services = [
    { name: "chatbot", url: `${CHATBOT_SERVICE_URL}/health` },
    { name: "mood", url: `${MOOD_ANALYTICS_URL}/health` },
    { name: "recommendation", url: `${RECOMMENDATION_SERVICE_URL}/health` },
  ];

  const TIMEOUT = 60_000; // per-service timeout
  const INTERVAL = 5_000; // retry interval
  const BUDGET = 90_000; // total retry budget per service

  async function pingUntilReady(url) {
    const start = Date.now();
    while (Date.now() - start < BUDGET) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
        if (r.ok) return "ready";
      } catch {
        // still waking
      }
      await new Promise((r) => setTimeout(r, INTERVAL));
    }
    return "starting";
  }

  // Ping all in parallel
  const results = await Promise.all(
    services.map(async (svc) => ({
      name: svc.name,
      status: await pingUntilReady(svc.url),
    })),
  );

  const allReady = results.every((r) => r.status === "ready");
  res.json({ status: allReady ? "ready" : "warming up", services: results });
}

module.exports = {
  getRoot,
  getHealth,
  warmup,
};
