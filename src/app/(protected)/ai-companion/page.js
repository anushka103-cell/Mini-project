"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/authClient";
import { useVoicePlayback } from "@/hooks/useVoicePlayback";
import { usePreferencesManager } from "@/hooks/usePreferencesManager";
import VoiceSettings from "@/components/avatar/VoiceSettings";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function AICompanion() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [chatSessionId, setChatSessionId] = useState(null);
  const [responseStyle, setResponseStyle] = useState("warm");
  const [useName, setUseName] = useState(true);
  const [useMemory, setUseMemory] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [prefsSaveState, setPrefsSaveState] = useState("idle");
  const [showEmojiBar, setShowEmojiBar] = useState(false);

  const quickEmojis = [
    "😊",
    "😢",
    "😰",
    "😡",
    "😴",
    "🤗",
    "💪",
    "🙏",
    "❤️",
    "😔",
  ];

  // Voice & Audio States
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [mouthShape, setMouthShape] = useState(0);
  const [currentPhoneme, setCurrentPhoneme] = useState("");

  const { speak, stop, isPlaying } = useVoicePlayback((data) => {
    setMouthShape(data.mouthShape || 0);
    setCurrentPhoneme(data.phoneme || "");
  });

  // Preferences manager
  const { preferences, getPreference, updatePreferences } =
    usePreferencesManager();

  const messagesEndRef = useRef(null);
  const hasLoadedPreferences = useRef(false);
  const router = useRouter();

  // Load data on mount and warm up chatbot service (Render free-tier sleeps)
  useEffect(() => {
    loadChatHistory();
    // Fire-and-forget wake-up ping so the chatbot is ready by first message
    fetch(`${API_BASE_URL}/api/chatbot/health`, { method: "GET" }).catch(
      () => {},
    );
  }, []);

  // Apply loaded preferences
  useEffect(() => {
    if (preferences && !hasLoadedPreferences.current) {
      hasLoadedPreferences.current = true;

      // Apply chat preferences
      if (preferences.responseStyle) {
        setResponseStyle(preferences.responseStyle);
      }
      if (typeof preferences.useName === "boolean") {
        setUseName(preferences.useName);
      }
      if (typeof preferences.useMemory === "boolean") {
        setUseMemory(preferences.useMemory);
      }

      // Apply voice preferences
      if (preferences.autoPlayVoice !== undefined) {
        setVoiceEnabled(preferences.autoPlayVoice);
      }
    }
  }, [preferences]);

  // Save chat preferences when they change
  useEffect(() => {
    if (!hasLoadedPreferences.current) return;

    const timer = setTimeout(async () => {
      // Update preferences manager
      await updatePreferences({
        responseStyle,
        useName,
        useMemory,
        autoPlayVoice: voiceEnabled,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [responseStyle, useName, useMemory, voiceEnabled, updatePreferences]);

  // Load chat history from backend
  const loadChatHistory = async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE_URL}/api/chat`,
        { method: "GET" },
        API_BASE_URL,
      );

      const data = await res.json();

      if (res.ok) {
        setMessages(
          data.messages.length
            ? data.messages
            : [
                {
                  role: "ai",
                  content: "Hi, I'm here for you. How are you feeling today?",
                },
              ],
        );
      } else {
        // Show welcome message if history load fails (e.g. expired session)
        setMessages([
          {
            role: "ai",
            content: "Hi, I'm here for you. How are you feeling today?",
          },
        ]);
      }
    } catch {
      console.log("Error loading chat");
    }
  };

  const clearChat = async () => {
    setMessages([
      {
        role: "ai",
        content: "Hi, I'm here for you. How are you feeling today?",
      },
    ]);
    setChatSessionId(null);
    try {
      await fetchWithAuth(
        `${API_BASE_URL}/api/chat`,
        { method: "DELETE" },
        API_BASE_URL,
      );
    } catch {
      // Non-blocking
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;

    const userInput = input.trim();
    const pendingId = `pending-${Date.now()}`;
    setIsSending(true);
    setInput("");

    const userMessage = { role: "user", content: userInput };
    setMessages((prev) => [
      ...prev,
      userMessage,
      { role: "ai", content: "Thinking...", _pendingId: pendingId },
    ]);

    let aiResponseText = "I am here with you. Could you share a little more?";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000); // 120s for Render free-tier cold starts

      // Send plaintext to chatbot — it needs raw text for emotion detection.
      // Chat history is encrypted separately when persisted below.
      const chatbotPayload = {
        content: userInput,
        session_id: chatSessionId,
        style: responseStyle,
        use_name: useName,
        use_memory: useMemory,
      };
      const chatbotOpts = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatbotPayload),
        signal: controller.signal,
      };

      // Continuous retry loop: retry every 5 s for up to 120 s.
      // Covers cascading cold starts where BOTH the API gateway (~50 s)
      // and chatbot microservice (~50 s) need to wake up sequentially.
      const RETRY_BUDGET_MS = 120_000;
      const RETRY_INTERVAL_MS = 5_000;
      const retryStart = Date.now();
      let chatbotRes;

      while (Date.now() - retryStart < RETRY_BUDGET_MS) {
        try {
          chatbotRes = await fetchWithAuth(
            `${API_BASE_URL}/api/chatbot`,
            { ...chatbotOpts, signal: controller.signal },
            API_BASE_URL,
          );
          if (chatbotRes.status !== 502 && chatbotRes.status !== 503) break;
        } catch (err) {
          if (err && err.name === "AbortError") break;
          chatbotRes = null; // network error — gateway still waking
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg._pendingId === pendingId
              ? { ...msg, content: "Services warming up, please wait\u2026" }
              : msg,
          ),
        );
        await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
      }

      clearTimeout(timeoutId);

      let chatbotData = {};
      try {
        chatbotData = chatbotRes ? await chatbotRes.json() : {};
      } catch {
        chatbotData = {};
      }

      if (chatbotRes && chatbotRes.ok) {
        if (chatbotData.session_id) {
          setChatSessionId(chatbotData.session_id);
        }
        aiResponseText =
          chatbotData.response ||
          "I hear you. Thank you for sharing that with me.";
      } else if (chatbotRes && chatbotRes.status === 429) {
        aiResponseText =
          "I need a moment to catch my breath — too many messages at once. Please wait a minute and try again.";
      } else {
        aiResponseText =
          "The AI service is temporarily unavailable. Please try again in a minute or two.";
      }
    } catch {
      aiResponseText =
        "The AI service is temporarily unavailable. Please try again in a minute or two.";
    }

    const aiResponse = { role: "ai", content: aiResponseText };
    setMessages((prev) =>
      prev.map((msg) =>
        msg._pendingId === pendingId
          ? { role: "ai", content: aiResponseText }
          : msg,
      ),
    );

    // Speak AI response if voice is enabled
    if (voiceEnabled) {
      try {
        // Detect emotion from AI response for prosody
        const emotionKeywords = {
          happy: ["happy", "joy", "wonderful", "great", "amazing"],
          calm: ["calm", "relax", "peaceful", "breathe", "here"],
          supportive: ["here", "support", "help", "care", "understand"],
          curious: ["wondering", "interested", "curious"],
        };

        let detectedEmotion = "neutral";
        const lowerText = aiResponseText.toLowerCase();

        for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
          if (keywords.some((kw) => lowerText.includes(kw))) {
            detectedEmotion = emotion;
            break;
          }
        }

        await speak(aiResponseText, detectedEmotion);
      } catch (voiceErr) {
        console.error("Voice synthesis error:", voiceErr);
        // Continue without voice - non-blocking
      }
    }

    try {
      // Persist user message
      await fetchWithAuth(
        `${API_BASE_URL}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: userMessage.role,
            content: userMessage.content,
          }),
        },
        API_BASE_URL,
      );

      // Persist AI response
      await fetchWithAuth(
        `${API_BASE_URL}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "ai", content: aiResponseText }),
        },
        API_BASE_URL,
      );
    } catch {
      // Non-blocking persistence failure; keep UI responsive
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-1px)] flex-col bg-slate-950 p-8 md:p-10">
      <h1 className="mb-6 text-3xl font-bold text-slate-100">
        🤖 AI Companion
      </h1>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Response Style
        </label>
        <select
          value={responseStyle}
          onChange={(e) => setResponseStyle(e.target.value)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500"
        >
          <option value="warm">Warm</option>
          <option value="balanced">Balanced</option>
          <option value="concise">Concise</option>
        </select>

        <label className="ml-3 flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={useName}
            onChange={(e) => setUseName(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-cyan-500"
          />
          Use my name
        </label>

        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={useMemory}
            onChange={(e) => setUseMemory(e.target.checked)}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-cyan-500"
          />
          Use memory cues
        </label>

        {/* Voice Controls */}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={voiceEnabled}
            onChange={(e) => {
              setVoiceEnabled(e.target.checked);
              if (!e.target.checked) stop();
            }}
            className="h-4 w-4 rounded border-slate-500 bg-slate-800 accent-cyan-500"
          />
          🔊 Voice
        </label>

        <button
          onClick={() => setShowVoiceSettings(!showVoiceSettings)}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-500 hover:text-cyan-400"
        >
          ⚙️ Voice Settings
        </button>

        <button
          onClick={clearChat}
          className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-rose-500 hover:text-rose-400"
        >
          🗑️ Clear Chat
        </button>

        <span
          className={`text-xs font-medium ${
            prefsSaveState === "saving"
              ? "text-cyan-300"
              : prefsSaveState === "saved"
                ? "text-emerald-300"
                : prefsSaveState === "error"
                  ? "text-rose-300"
                  : "text-slate-500"
          }`}
        >
          {prefsSaveState === "saving"
            ? "Saving..."
            : prefsSaveState === "saved"
              ? "Saved"
              : prefsSaveState === "error"
                ? "Save failed"
                : ""}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-xl space-y-4">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`max-w-xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-cyan-700 text-white"
                : "bg-slate-800 text-slate-200"
            }`}
          >
            {msg.content}
            {msg.role === "ai" && isPlaying && currentPhoneme && (
              <div className="mt-2 text-xs text-cyan-400">
                🎤 Speaking... ({currentPhoneme})
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {showEmojiBar && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setInput((prev) => prev + emoji)}
                className="text-xl transition hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => setShowEmojiBar(!showEmojiBar)}
            className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-3 text-lg transition hover:border-cyan-500"
            title="Emojis"
          >
            😊
          </button>
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={isSending}
            className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {/* Voice Settings Modal */}
      {showVoiceSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">
                Voice Settings
              </h2>
              <button
                onClick={() => setShowVoiceSettings(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <VoiceSettings
              showPreview={true}
              onSettingsChange={(settings) => {
                // Settings are applied in real-time by VoicePlayback hook
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
