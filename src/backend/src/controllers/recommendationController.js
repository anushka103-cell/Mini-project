function createRecommendationController({ recommendationServiceUrl }) {
  // Shared retry helper for Render free-tier cold starts (~50s)
  async function fetchWithRetry(url, opts = {}, timeoutMs = 60_000) {
    const maxAttempts = 4;
    const delays = [0, 10_000, 20_000, 25_000];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
      try {
        response = await fetch(url, { ...opts, signal: controller.signal });
        if (response.ok || response.status < 500) break;
        lastError = null;
      } catch (err) {
        lastError = err;
        response = null;
        if (err && err.name === "AbortError") break;
      }
    }
    clearTimeout(timeout);

    if (lastError) {
      const isAbort = lastError.name === "AbortError";
      const err = new Error(isAbort ? "timeout" : "unavailable");
      err.statusCode = isAbort ? 504 : 502;
      throw err;
    }
    return response;
  }

  async function proxyPost(path, body, res) {
    try {
      const response = await fetchWithRetry(
        `${recommendationServiceUrl}${path}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "recommendation service error" });
      }
      return res.json(data);
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        message:
          error.statusCode === 504
            ? "recommendation service request timed out"
            : "recommendation service unavailable",
      });
    }
  }

  async function proxyGet(path, res) {
    try {
      const response = await fetchWithRetry(
        `${recommendationServiceUrl}${path}`,
      );
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "recommendation service error" });
      }
      return res.json(data);
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        message:
          error.statusCode === 504
            ? "recommendation service request timed out"
            : "recommendation service unavailable",
      });
    }
  }

  async function getRecommendations(req, res) {
    const {
      emotion,
      intensity,
      top_k,
      excluded_ids,
      preferred_categories,
      context,
    } = req.body || {};

    if (!emotion) {
      return res.status(400).json({ message: "emotion is required" });
    }

    const payload = {
      emotion,
      intensity: typeof intensity === "number" ? intensity : 0.5,
      top_k: top_k || 5,
      excluded_ids: excluded_ids || [],
      preferred_categories: preferred_categories || null,
      context: context || {},
    };

    return proxyPost("/recommend", payload, res);
  }

  async function submitFeedback(req, res) {
    const { emotion, intensity, strategy_id, helpful } = req.body || {};

    if (!emotion || !strategy_id || typeof helpful !== "boolean") {
      return res.status(400).json({
        message: "emotion, strategy_id, and helpful (boolean) are required",
      });
    }

    return proxyPost(
      "/feedback",
      { emotion, intensity: intensity || 0.5, strategy_id, helpful },
      res,
    );
  }

  async function listStrategies(req, res) {
    const params = new URLSearchParams();
    if (req.query.emotion) params.set("emotion", req.query.emotion);
    if (req.query.category) params.set("category", req.query.category);
    const qs = params.toString();
    return proxyGet(`/strategies${qs ? `?${qs}` : ""}`, res);
  }

  async function getStrategy(req, res) {
    return proxyGet(`/strategies/${encodeURIComponent(req.params.id)}`, res);
  }

  async function getEmotions(req, res) {
    return proxyGet("/emotions", res);
  }

  async function getCategories(req, res) {
    return proxyGet("/categories", res);
  }

  return {
    getRecommendations,
    submitFeedback,
    listStrategies,
    getStrategy,
    getEmotions,
    getCategories,
  };
}

module.exports = { createRecommendationController };
