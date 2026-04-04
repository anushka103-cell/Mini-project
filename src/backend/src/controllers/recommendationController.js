function createRecommendationController({ recommendationServiceUrl }) {
  async function proxyPost(path, body, res) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${recommendationServiceUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "recommendation service error" });
      }
      return res.json(data);
    } catch (error) {
      const isAbort = error && error.name === "AbortError";
      return res.status(isAbort ? 504 : 502).json({
        message: isAbort
          ? "recommendation service request timed out"
          : "recommendation service unavailable",
      });
    }
  }

  async function proxyGet(path, res) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${recommendationServiceUrl}${path}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "recommendation service error" });
      }
      return res.json(data);
    } catch (error) {
      const isAbort = error && error.name === "AbortError";
      return res.status(isAbort ? 504 : 502).json({
        message: isAbort
          ? "recommendation service request timed out"
          : "recommendation service unavailable",
      });
    }
  }

  async function getRecommendations(req, res) {
    const { emotion, intensity, top_k, excluded_ids, preferred_categories, context } =
      req.body || {};

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
