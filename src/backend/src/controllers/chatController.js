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
        typeof profileResult.profile.fullName === "string"
          ? profileResult.profile.fullName.trim()
          : "";
      const anonName =
        profileResult &&
        profileResult.profile &&
        typeof profileResult.profile.anonymousName === "string" &&
        profileResult.profile.anonymousName.trim().toLowerCase() !== "anonymous"
          ? profileResult.profile.anonymousName.trim()
          : "";
      // Only use the email prefix as a name if it looks like a real first name
      // (alphabetic only, no dots/numbers/underscores, 2-20 chars)
      let fallbackEmailName = "";
      if (typeof req.user.email === "string" && req.user.email.includes("@")) {
        const prefix = req.user.email.split("@")[0];
        if (/^[a-zA-Z]{2,20}$/.test(prefix)) {
          fallbackEmailName = prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase();
        }
      }
      userName = profileName || anonName || fallbackEmailName || "friend";
    } catch {
      // Profile lookup failed (e.g. DB cold start); continue with default name
    }
    const useName = use_name !== false;
    const useMemory = use_memory !== false;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const payload = {
        content: content.trim(),
        session_id: session_id || null,
        style: normalizedStyle,
        user_name: useName ? userName : "friend",
        use_name: useName,
        use_memory: useMemory,
      };

      let response = await fetch(`${chatbotServiceUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      // Retry once if chatbot is waking up (Render free-tier cold start)
      if (!response.ok && (response.status >= 500 || response.status === 0)) {
        await new Promise((r) => setTimeout(r, 15000));
        response = await fetch(`${chatbotServiceUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
      }

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
      if (isAbort) {
        return res.status(504).json({ message: "chatbot request timed out" });
      }

      // Retry once on network error (chatbot may be waking from sleep)
      try {
        await new Promise((r) => setTimeout(r, 15000));
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 60_000);
        const retryRes = await fetch(`${chatbotServiceUrl}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: content.trim(),
            session_id: session_id || null,
            style: normalizedStyle,
            user_name: useName ? userName : "friend",
            use_name: useName,
            use_memory: useMemory,
          }),
          signal: retryController.signal,
        });
        clearTimeout(retryTimeout);
        const retryData = await retryRes.json();
        if (retryRes.ok) return res.json(retryData);
        return res.status(retryRes.status).json({ message: retryData?.detail || "chatbot request failed" });
      } catch {
        return res.status(502).json({ message: "chatbot service unavailable" });
      }
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

    async clearMessages(req, res) {
      const result = await userDataService.clearChatMessages(req.user.id);
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
