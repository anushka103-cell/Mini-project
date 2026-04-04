"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import AvatarCustomizer from "@/components/avatar/AvatarCustomizer";
import { fetchWithAuth } from "@/lib/authClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

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
  const avatarRef = useRef(null);

  // Avatar state driven by chat
  const [emotion, setEmotion] = useState("neutral");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState("");

  // ✨ PREFERENCES STATE
  const [preferences, setPreferences] = useState({
    avatarPreset: "neutral_light",
    background: "living_room",
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
  });

  // Save preferences to state and localStorage
  const savePreferences = async (newPrefs) => {
    try {
      setSaveState("saving");

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

    // Load saved preferences from localStorage
    try {
      const savedPrefs = localStorage.getItem("avatarPreferences");
      if (savedPrefs) {
        const parsedPrefs = JSON.parse(savedPrefs);
        setPreferences(parsedPrefs);
      }
    } catch (e) {
      console.log("Could not load saved preferences:", e);
    }
  }, []);

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
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const chatbotRes = await fetchWithAuth(
        `${API_BASE_URL}/api/chatbot`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: userInput,
            session_id: chatSessionId,
            style: "warm",
            use_name: true,
            use_memory: true,
          }),
          signal: controller.signal,
        },
        API_BASE_URL,
      );

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
      } else {
        aiResponseText =
          "I'm having trouble connecting right now. Please try again.";
      }
    } catch {
      aiResponseText =
        "I'm having trouble connecting right now. Please try again.";
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

  // Preview preferences without saving (for real-time customizer updates)
  const handlePreviewPreferences = (field, value) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: value,
    }));
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
                  url="/avatars/AvatarSample.vrm"
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
          <div className="lg:col-span-1 bg-white rounded-xl shadow-lg p-6 flex flex-col h-[600px]">
            <h2 className="text-xl font-bold text-gray-900 mb-4">💬 Chat</h2>

            {/* Chat History */}
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 bg-gray-50 rounded-lg p-3">
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
              <textarea
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full p-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                rows="3"
              />
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !userMessage.trim() || !userId}
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
