"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import AvatarCustomizer from "@/components/avatar/AvatarCustomizer";
import { AVATAR_PRESETS } from "@/components/avatar/avatarPresets";
import { fetchWithAuth } from "@/lib/authClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Map model IDs to VRM file paths
const AVATAR_MODELS = {
  female: "/avatars/ExprAvatar1.vrm",
  male: "/avatars/ExprAvatar2.vrm",
};

// Dynamic import to avoid SSR issues with WebGL / Three.js
const Avatar3D = dynamic(() => import("@/components/Avatar3D"), { ssr: false });

export default function AvatarPage() {
  const [userId, setUserId] = useState(null);
  const [userMessage, setUserMessage] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [saveState, setSaveState] = useState("idle");
  const [chatSessionId, setChatSessionId] = useState(null);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const avatarRef = useRef(null);
  const recognitionRef = useRef(null);

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

  // Avatar state driven by chat
  const [emotion, setEmotion] = useState("neutral");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState("");

  // ✨ PREFERENCES STATE — read localStorage synchronously to avoid flash
  const [preferences, setPreferences] = useState(() => {
    const defaults = {
      avatarModel: "female",
      avatarPreset: "neutral_light",
      background: "soft_blue",
      emotion: "neutral",
      skinTone: "#d4a574",
      hairColor: "#1a1a2e",
      clothingColor: "#7ddc7d",
      accentColor: "#e85eb8",
      voiceSettings: {
        voiceProfile: "ana_friendly",
        pitch: 1.0,
        rate: 1.0,
        volume: 0.8,
      },
    };
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("avatarPreferences");
        if (saved) return { ...defaults, ...JSON.parse(saved) };
      } catch {}
    }
    return defaults;
  });

  // Save preferences to state and localStorage
  const savePreferences = async (newPrefs) => {
    try {
      setSaveState("saving");

      // Resolve preset colors into preferences
      if (newPrefs.avatarPreset && AVATAR_PRESETS[newPrefs.avatarPreset]) {
        const preset = AVATAR_PRESETS[newPrefs.avatarPreset];
        newPrefs.skinTone = preset.skinTone;
        newPrefs.hairColor = preset.hairColor;
      }

      // Update local state immediately
      setPreferences(newPrefs);

      // Save to localStorage for persistence
      localStorage.setItem("avatarPreferences", JSON.stringify(newPrefs));

      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  // Load user on mount - IMMEDIATE DISPLAY
  useEffect(() => {
    // ⚡ INSTANTLY set a user ID so avatar renders immediately
    const id = "user-" + Math.random().toString(36).slice(2, 9);
    setUserId(id);

    // Preferences already loaded synchronously via useState initializer

    // Fire-and-forget wake-up ping so the chatbot is ready by first message
    fetch(`${API_BASE_URL}/api/chatbot/health`, { method: "GET" }).catch(
      () => {},
    );

    // Load persisted avatar chat history
    (async () => {
      try {
        const res = await fetchWithAuth(
          `${API_BASE_URL}/api/chat`,
          { method: "GET" },
          API_BASE_URL,
        );
        const data = await res.json();
        if (res.ok && data.messages?.length) {
          setChatHistory(data.messages);
        }
      } catch {
        // Non-blocking — start with empty chat
      }
    })();
  }, []);

  const clearChat = async () => {
    setChatHistory([]);
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

  // Send message to chatbot
  // ── Voice: speak text aloud via Web Speech API ──
  const speakText = (text) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis)
      return;
    window.speechSynthesis.cancel(); // stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);
    const vs = preferences?.voiceSettings || {};
    utterance.pitch = vs.pitch ?? 1.0;
    utterance.rate = vs.rate ?? 1.0;
    utterance.volume = vs.volume ?? 0.8;

    // Map voice profile ID to an actual browser voice
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0 && vs.voiceProfile) {
      const profileMap = {
        david_english: (v) => /david/i.test(v.name) && /en/i.test(v.lang),
        ana_friendly: (v) =>
          /ana|zira|samantha/i.test(v.name) && /en/i.test(v.lang),
        female_us: (v) =>
          /female|samantha|zira/i.test(v.name) && /en.US/i.test(v.lang),
        male_uk: (v) =>
          /male|daniel|george/i.test(v.name) && /en.GB/i.test(v.lang),
        female_uk: (v) =>
          /female|hazel|kate/i.test(v.name) && /en.GB/i.test(v.lang),
      };
      const matcher = profileMap[vs.voiceProfile];
      const matched = matcher ? voices.find(matcher) : null;
      if (matched) utterance.voice = matched;
    }
    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingText(text);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingText("");
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingText("");
    };
    window.speechSynthesis.speak(utterance);
  };

  // ── Cleanup: cancel speech synthesis on unmount / navigation ──
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // ── Voice Input: Speech-to-text via Web Speech API ──
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserMessage((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const handleSendMessage = async () => {
    if (!userMessage.trim()) return;

    const userInput = userMessage.trim();
    setIsLoading(true);
    setUserMessage("");

    setChatHistory((prev) => [
      ...prev,
      { role: "user", content: userInput, timestamp: new Date() },
    ]);

    let aiResponseText = "I hear you. Could you share a little more?";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000); // 120s for Render free-tier cold starts

      const chatbotPayload = {
        content: userInput,
        session_id: chatSessionId,
        style: "warm",
        use_name: true,
        use_memory: true,
      };
      const chatbotOpts = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatbotPayload),
        signal: controller.signal,
      };

      let chatbotRes = await fetchWithAuth(
        `${API_BASE_URL}/api/chatbot`,
        chatbotOpts,
        API_BASE_URL,
      );

      // Retry once on 502 (chatbot waking up from sleep on free tier)
      if (chatbotRes.status === 502) {
        await new Promise((r) => setTimeout(r, 8000));
        chatbotRes = await fetchWithAuth(
          `${API_BASE_URL}/api/chatbot`,
          { ...chatbotOpts, signal: controller.signal },
          API_BASE_URL,
        );
      }

      clearTimeout(timeoutId);

      let chatbotData = {};
      try {
        chatbotData = await chatbotRes.json();
      } catch {
        chatbotData = {};
      }

      if (chatbotRes.ok) {
        if (chatbotData.session_id) {
          setChatSessionId(chatbotData.session_id);
        }
        aiResponseText =
          chatbotData.response ||
          "I hear you. Thank you for sharing that with me.";
      } else if (chatbotRes.status === 429) {
        aiResponseText =
          "I need a moment to catch my breath — too many messages at once. Please wait a minute and try again.";
      } else if (chatbotRes.status === 502 || chatbotRes.status === 503) {
        aiResponseText =
          "I'm waking up — the service was resting. Please send your message again in a few seconds.";
      } else {
        aiResponseText =
          "I'm having trouble connecting right now. Please try again.";
      }
    } catch {
      aiResponseText =
        "I'm waking up — the service was resting. Please send your message again in a few seconds.";
    } finally {
      setIsLoading(false);
    }

    setChatHistory((prev) => [
      ...prev,
      { role: "assistant", content: aiResponseText, timestamp: new Date() },
    ]);

    // Detect emotion from AI response for avatar expression
    const emotionKeywords = {
      happy: ["happy", "joy", "wonderful", "great", "amazing"],
      calm: ["calm", "relax", "peaceful", "breathe"],
      supportive: ["here", "support", "help", "care", "understand"],
      curious: ["wondering", "interested", "curious"],
    };

    let detectedEmotion = "neutral";
    const lowerText = aiResponseText.toLowerCase();
    for (const [emo, keywords] of Object.entries(emotionKeywords)) {
      if (keywords.some((kw) => lowerText.includes(kw))) {
        detectedEmotion = emo;
        break;
      }
    }
    setEmotion(detectedEmotion);

    // Speak the response aloud (drives lip-sync via utterance events)
    speakText(aiResponseText);

    // Persist both messages to backend
    try {
      await fetchWithAuth(
        `${API_BASE_URL}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", content: userInput }),
        },
        API_BASE_URL,
      );
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
      // Non-blocking persistence failure
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSavePreferences = async (newPrefs) => {
    await savePreferences(newPrefs);
  };

  // Preview preferences and auto-save to localStorage
  const handlePreviewPreferences = (field, value) => {
    setPreferences((prev) => {
      let updated;
      if (field === "avatarPreset" && AVATAR_PRESETS[value]) {
        const preset = AVATAR_PRESETS[value];
        updated = {
          ...prev,
          avatarPreset: value,
          skinTone: preset.skinTone,
          hairColor: preset.hairColor,
          clothingColor: prev.clothingColor,
        };
      } else {
        updated = { ...prev, [field]: value };
      }
      // Persist every change so settings survive navigation
      try {
        localStorage.setItem("avatarPreferences", JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Avatar AI Companion
            </h1>
            <p className="text-gray-600">
              Talk to your personalized AI companion with visual expressions
            </p>
          </div>
          <button
            onClick={() => setShowCustomizer(!showCustomizer)}
            className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-md"
          >
            {showCustomizer ? "✕ Close" : "⚙️ Customize"}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Customizer Panel */}
          {showCustomizer && (
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                <AvatarCustomizer
                  currentPreferences={preferences || {}}
                  onSave={handleSavePreferences}
                  onPreview={handlePreviewPreferences}
                  isSaving={saveState === "saving"}
                  saveState={saveState}
                />
              </div>
            </div>
          )}

          {/* Avatar & Chat */}
          <div className={showCustomizer ? "lg:col-span-2" : "lg:col-span-3"}>
            {/* Avatar */}
            <div className="mb-6 bg-white rounded-xl shadow-lg p-4 min-h-96">
              {userId ? (
                <Avatar3D
                  ref={avatarRef}
                  url={
                    AVATAR_MODELS[preferences?.avatarModel] ||
                    AVATAR_MODELS.female
                  }
                  emotion={preferences?.emotion || emotion}
                  emotionIntensity={0.7}
                  isSpeaking={isSpeaking}
                  speakingText={speakingText}
                  background={preferences?.background || "starfield"}
                  materialOverrides={{
                    hair: preferences?.hairColor,
                    skin: preferences?.skinTone,
                    outfit: preferences?.clothingColor,
                  }}
                  style={{ height: 400 }}
                />
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-500">
                  Loading avatar...
                </div>
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div
            className="lg:col-span-1 bg-white rounded-xl shadow-lg p-6 flex flex-col h-[600px]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">💬 Chat</h2>
              <div className="flex items-center gap-2">
                {showCustomizer && (
                  <span className="text-xs text-amber-600 font-medium">
                    Close customizer to chat
                  </span>
                )}
                <button
                  onClick={clearChat}
                  disabled={showCustomizer}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-500 transition hover:border-rose-400 hover:text-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>

            {/* Chat History */}
            <div className={`flex-1 overflow-y-auto mb-4 space-y-3 bg-gray-50 rounded-lg p-3 ${showCustomizer ? "opacity-50" : ""}`}>
              {chatHistory.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <p className="text-sm">Start a conversation...</p>
                </div>
              ) : (
                chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`text-sm ${msg.role === "user" ? "text-right" : ""}`}
                  >
                    <div
                      className={`inline-block px-3 py-2 rounded-lg max-w-xs ${
                        msg.role === "user"
                          ? "bg-indigo-500 text-white"
                          : "bg-gray-200 text-gray-900"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="border-t pt-3">
              {showEmojiBar && (
                <div className="flex flex-wrap gap-1 mb-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                  {quickEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setUserMessage((prev) => prev + emoji)}
                      className="text-lg transition hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-1 mb-2">
                <button
                  onClick={() => setShowEmojiBar(!showEmojiBar)}
                  disabled={showCustomizer}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-lg transition hover:border-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Emojis"
                >
                  😊
                </button>
                <button
                  onClick={toggleListening}
                  disabled={showCustomizer}
                  className={`rounded-lg border px-2 py-1 text-lg transition ${
                    isListening
                      ? "border-red-500 bg-red-50 text-red-600 animate-pulse"
                      : "border-gray-300 hover:border-indigo-400"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isListening ? "Stop listening" : "Speak"}
                >
                  🎤
                </button>
                <textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={showCustomizer}
                  placeholder={showCustomizer ? "Close customizer to chat..." : "Type your message..."}
                  className="flex-1 p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  rows="2"
                />
              </div>
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !userMessage.trim() || showCustomizer}
                className="w-full bg-indigo-600 text-white p-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
