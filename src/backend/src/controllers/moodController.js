function createMoodController({ moodAnalyticsUrl }) {
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

  async function proxyGet(path, res) {
    try {
      const response = await fetchWithRetry(`${moodAnalyticsUrl}${path}`);
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "mood service error" });
      }
      return res.json(data);
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        message:
          error.statusCode === 504
            ? "mood service request timed out"
            : "mood service unavailable",
      });
    }
  }

  async function logMood(req, res) {
    const {
      mood_score,
      mood_label,
      notes,
      emotion_scores,
      activities,
      triggers,
      sleep_hours,
      exercise_minutes,
      time_of_day,
      logged_at,
    } = req.body || {};

    if (typeof mood_score !== "number" || mood_score < 1 || mood_score > 10) {
      return res
        .status(400)
        .json({ message: "mood_score must be a number between 1 and 10" });
    }

    try {
      const response = await fetchWithRetry(`${moodAnalyticsUrl}/moods/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: req.user.analyticsSubjectId,
          mood_score,
          mood_label: mood_label || null,
          notes: notes || null,
          emotion_scores: emotion_scores || null,
          activities: activities || null,
          triggers: triggers || null,
          sleep_hours: sleep_hours != null ? sleep_hours : null,
          exercise_minutes: exercise_minutes != null ? exercise_minutes : null,
          time_of_day: time_of_day || null,
          logged_at: logged_at || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "mood service error" });
      }
      return res.status(201).json(data);
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        message:
          error.statusCode === 504
            ? "mood service request timed out"
            : "mood service unavailable",
      });
    }
  }

  function getLogs(req, res) {
    const days = Number(req.query.days) || 30;
    return proxyGet(
      `/moods/${req.user.analyticsSubjectId}/logs?days=${days}`,
      res,
    );
  }

  function getTrends(req, res) {
    const days = Number(req.query.days) || 30;
    return proxyGet(
      `/moods/${req.user.analyticsSubjectId}/trends?days=${days}`,
      res,
    );
  }

  function getWeeklyScore(req, res) {
    return proxyGet(`/moods/${req.user.analyticsSubjectId}/weekly-score`, res);
  }

  function getVisualization(req, res) {
    const days = Number(req.query.days) || 90;
    return proxyGet(
      `/moods/${req.user.analyticsSubjectId}/visualization?days=${days}`,
      res,
    );
  }

  function getPatterns(req, res) {
    const days = Number(req.query.days) || 90;
    return proxyGet(
      `/moods/${req.user.analyticsSubjectId}/patterns?days=${days}`,
      res,
    );
  }

  function getStreaks(req, res) {
    return proxyGet(`/moods/${req.user.analyticsSubjectId}/streaks`, res);
  }

  async function deleteMood(req, res) {
    const moodId = req.params.id;
    try {
      const response = await fetchWithRetry(
        `${moodAnalyticsUrl}/moods/${moodId}?user_id=${encodeURIComponent(req.user.analyticsSubjectId)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "mood service error" });
      }
      return res.json(data);
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        message:
          error.statusCode === 504
            ? "mood service request timed out"
            : "mood service unavailable",
      });
    }
  }

  async function updateMood(req, res) {
    const moodId = req.params.id;
    try {
      const response = await fetchWithRetry(
        `${moodAnalyticsUrl}/moods/${moodId}?user_id=${encodeURIComponent(req.user.analyticsSubjectId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req.body),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        return res
          .status(response.status)
          .json({ message: data?.detail || "mood service error" });
      }
      return res.json(data);
    } catch (error) {
      return res.status(error.statusCode || 502).json({
        message:
          error.statusCode === 504
            ? "mood service request timed out"
            : "mood service unavailable",
      });
    }
  }

  async function getAiReflection(req, res) {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return res.status(503).json({ message: "AI reflection not configured" });
    }
    try {
      // Fetch last 7 days of mood data
      const logsRes = await fetchWithRetry(
        `${moodAnalyticsUrl}/moods/${req.user.analyticsSubjectId}/logs?days=7`,
      );
      if (!logsRes.ok) {
        return res.status(404).json({ message: "no mood data for reflection" });
      }
      const logs = await logsRes.json();
      if (!logs.length) {
        return res.status(404).json({ message: "no mood data for reflection" });
      }

      const moodSummary = logs
        .map(
          (l) =>
            `${l.logged_date}: mood=${l.mood_score}/10 (${l.mood_label || "N/A"})${l.activities ? " activities=[" + l.activities.join(",") + "]" : ""}${l.sleep_hours != null ? " sleep=" + l.sleep_hours + "h" : ""}`,
        )
        .join("\n");

      const ctrl2 = new AbortController();
      const t2 = setTimeout(() => ctrl2.abort(), 30000);
      const groqRes = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "You are a compassionate mental health wellness assistant. Provide a brief, supportive weekly mood reflection (3-4 sentences). Highlight positive patterns, gently acknowledge challenges, and offer one actionable suggestion. Keep the tone warm and encouraging. Do not diagnose or prescribe.",
              },
              {
                role: "user",
                content: `Here is my mood data for the past week:\n${moodSummary}\n\nPlease provide a brief weekly reflection.`,
              },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
          signal: ctrl2.signal,
        },
      );
      clearTimeout(t2);

      if (!groqRes.ok) {
        return res.status(502).json({ message: "AI service error" });
      }

      const groqData = await groqRes.json();
      const reflection =
        groqData.choices?.[0]?.message?.content ||
        "Unable to generate reflection.";

      return res.json({ reflection, entries_used: logs.length });
    } catch (error) {
      const isAbort = error && error.name === "AbortError";
      return res.status(isAbort ? 504 : 502).json({
        message: isAbort ? "AI reflection timed out" : "AI service unavailable",
      });
    }
  }

  return {
    logMood,
    getLogs,
    getTrends,
    getWeeklyScore,
    getVisualization,
    getPatterns,
    getStreaks,
    deleteMood,
    updateMood,
    getAiReflection,
  };
}

module.exports = {
  createMoodController,
};
