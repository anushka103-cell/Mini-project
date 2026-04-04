function createChatController(userDataService, { chatbotServiceUrl }) {
  async function askChatbot(req, res) {
    const { content, session_id, style, use_name, use_memory } = req.body || {};

    if (typeof content !== "string" || !content.trim()) {
      return res.status(400).json({ message: "content is required" });
    }

    const allowedStyles = new Set(["warm", "balanced", "concise"]);
    const normalizedStyle =
      typeof style === "string" && allowedStyles.has(style.toLowerCase())
        ? style.toLowerCase()
        : "balanced";

    let userName = "friend";
    try {
      const profileResult = await userDataService.getProfile(
        req.user.id,
        req.user.email,
      );
      const profileName =
        profileResult &&
        profileResult.profile &&
        typeof profileResult.profile.anonymousName === "string"
          ? profileResult.profile.anonymousName.trim()
          : "";
      const fallbackEmailName =
        typeof req.user.email === "string" && req.user.email.includes("@")
          ? req.user.email.split("@")[0]
          : "";
      userName = profileName || fallbackEmailName || "friend";
    } catch {
      // Profile lookup failed (e.g. DB cold start); continue with default name
    }
    const useName = use_name !== false;
    const useMemory = use_memory !== false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const response = await fetch(`${chatbotServiceUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: content.trim(),
          session_id: session_id || null,
          style: normalizedStyle,
          user_name: useName ? userName : "friend",
          use_name: useName,
          use_memory: useMemory,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "chatbot request failed" });
      }

      return res.json(data);
    } catch (error) {
      const isAbort = error && error.name === "AbortError";
      return res.status(isAbort ? 504 : 502).json({
        message: isAbort
          ? "chatbot request timed out"
          : "chatbot service unavailable",
      });
    }
  }

  return {
    async addMessage(req, res) {
      const result = await userDataService.addChatMessage(
        req.user.id,
        req.body || {},
      );
      return res.json(result);
    },

    async getMessages(req, res) {
      const result = await userDataService.getChatMessages(req.user.id);
      return res.json(result);
    },

    async chatbotHealth(_req, res) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);
        const response = await fetch(`${chatbotServiceUrl}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const data = await response.json();
        return res.json(data);
      } catch {
        return res.status(502).json({ status: "unavailable" });
      }
    },

    askChatbot,
  };
}

module.exports = {
  createChatController,
};
