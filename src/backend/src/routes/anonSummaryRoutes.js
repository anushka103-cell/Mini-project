const express = require("express");

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are a compassionate mental-health assistant writing a brief post-chat summary for an anonymous peer-support conversation.

Given the conversation transcript, produce a short summary (3-5 sentences) that:
1. Highlights the main topics discussed
2. Notes the emotional tone and any shifts in mood
3. Mentions any helpful moments or breakthroughs
4. Ends with a gentle, encouraging reflection

Rules:
- Use warm, non-clinical language
- Never reveal names; use "you" and "your chat partner"
- Keep it concise and uplifting
- Do NOT give medical advice
- Write in second person addressing the user`;

function createAnonSummaryRoutes() {
  const router = express.Router();

  router.post("/anon/summary", async (req, res) => {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ error: "Summary service unavailable" });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Messages array required" });
    }

    // Sanitize: take only user/partner messages, cap at 50, truncate each
    const cleaned = messages
      .filter((m) => m.sender === "me" || m.sender === "partner")
      .slice(-50)
      .map((m) => ({
        role: m.sender === "me" ? "user" : "assistant",
        content: String(m.text || "").slice(0, 500),
      }))
      .filter((m) => m.content.length > 0);

    if (cleaned.length === 0) {
      return res.status(400).json({ error: "No valid messages to summarise" });
    }

    // Build transcript string for the LLM
    const transcript = cleaned
      .map((m) => `${m.role === "user" ? "You" : "Partner"}: ${m.content}`)
      .join("\n");

    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Summarise this anonymous peer-support conversation:\n\n${transcript}`,
            },
          ],
          max_tokens: 250,
          temperature: 0.6,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Groq API error:", response.status, errText);
        return res.status(502).json({ error: "Summary generation failed" });
      }

      const data = await response.json();
      const summary =
        data.choices?.[0]?.message?.content?.trim() || "Unable to generate summary.";

      return res.json({ summary });
    } catch (err) {
      console.error("Groq summary request failed:", err.message);
      return res.status(502).json({ error: "Summary generation failed" });
    }
  });

  return router;
}

module.exports = { createAnonSummaryRoutes };
