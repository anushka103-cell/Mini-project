"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import { createAvatar } from "@dicebear/core";
import { bottts } from "@dicebear/collection";

// ---- DiceBear Avatar Component ----
function AnonAvatar({ seed, size = 32, className = "" }) {
  const svg = useMemo(() => {
    if (!seed) return "";
    const avatar = createAvatar(bottts, {
      seed,
      size,
      backgroundColor: ["0ea5e9", "6366f1", "8b5cf6", "ec4899", "f59e0b", "10b981"],
      backgroundType: ["solid"],
    });
    return avatar.toDataUri();
  }, [seed, size]);

  if (!svg) return null;
  return (
    <img
      src={svg}
      alt="Avatar"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
    />
  );
}

// ---- Ambient Soundscape Component ----
const SOUNDSCAPES = [
  { id: "rain", emoji: "\u{1F327}\uFE0F", label: "Rain" },
  { id: "ocean", emoji: "\u{1F30A}", label: "Ocean" },
  { id: "forest", emoji: "\u{1F33F}", label: "Forest" },
  { id: "night", emoji: "\u{1F319}", label: "Night" },
  { id: "whitenoise", emoji: "\u{1F4FB}", label: "White Noise" },
];

function AmbientSoundscape() {
  const [active, setActive] = useState(false);
  const [soundType, setSoundType] = useState("rain");
  const [volume, setVolume] = useState(0.3);
  const [panelOpen, setPanelOpen] = useState(false);
  const ctxRef = useRef(null);
  const nodesRef = useRef({ sources: [], gain: null });

  const stopSound = useCallback(() => {
    nodesRef.current.sources.forEach((s) => {
      try { s.stop(); } catch (e) { /* already stopped */ }
    });
    nodesRef.current = { sources: [], gain: null };
    if (ctxRef.current) {
      ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
  }, []);

  const buildNoise = useCallback((ctx, noiseType) => {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      if (noiseType === "brown") {
        let last = 0;
        for (let i = 0; i < len; i++) {
          const w = Math.random() * 2 - 1;
          d[i] = (last + 0.02 * w) / 1.02;
          last = d[i];
          d[i] *= 3.5;
        }
      } else {
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
    }
    return buf;
  }, []);

  const startSound = useCallback(
    (sType, vol) => {
      stopSound();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctxRef.current = ctx;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.3);
      gain.connect(ctx.destination);
      nodesRef.current.gain = gain;
      const sources = [];

      if (sType === "rain") {
        const src = ctx.createBufferSource();
        src.buffer = buildNoise(ctx, "brown");
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 800;
        bp.Q.value = 0.5;
        src.connect(bp);
        bp.connect(gain);
        src.start();
        sources.push(src);
        const src2 = ctx.createBufferSource();
        src2.buffer = buildNoise(ctx, "white");
        src2.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.value = 4000;
        const g2 = ctx.createGain();
        g2.gain.value = 0.15;
        src2.connect(hp);
        hp.connect(g2);
        g2.connect(gain);
        src2.start();
        sources.push(src2);
      } else if (sType === "ocean") {
        const src = ctx.createBufferSource();
        src.buffer = buildNoise(ctx, "brown");
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 500;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.08;
        lfoGain.gain.value = 400;
        lfo.connect(lfoGain);
        lfoGain.connect(lp.frequency);
        lfo.start();
        src.connect(lp);
        lp.connect(gain);
        src.start();
        sources.push(src, lfo);
      } else if (sType === "forest") {
        const src = ctx.createBufferSource();
        src.buffer = buildNoise(ctx, "white");
        src.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 3000;
        bp.Q.value = 0.3;
        const g1 = ctx.createGain();
        g1.gain.value = 0.08;
        src.connect(bp);
        bp.connect(g1);
        g1.connect(gain);
        src.start();
        sources.push(src);
        [1800, 2400, 3200].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq;
          const og = ctx.createGain();
          og.gain.value = 0;
          const now = ctx.currentTime;
          for (let t = idx * 1.5; t < 120; t += 3 + idx * 2) {
            og.gain.setValueAtTime(0, now + t);
            og.gain.linearRampToValueAtTime(0.03, now + t + 0.05);
            og.gain.linearRampToValueAtTime(0, now + t + 0.15);
            og.gain.setValueAtTime(0, now + t + 0.3);
            og.gain.linearRampToValueAtTime(0.02, now + t + 0.35);
            og.gain.linearRampToValueAtTime(0, now + t + 0.45);
          }
          osc.connect(og);
          og.connect(gain);
          osc.start();
          sources.push(osc);
        });
      } else if (sType === "night") {
        const src = ctx.createBufferSource();
        src.buffer = buildNoise(ctx, "brown");
        src.loop = true;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 200;
        const g1 = ctx.createGain();
        g1.gain.value = 0.6;
        src.connect(lp);
        lp.connect(g1);
        g1.connect(gain);
        src.start();
        sources.push(src);
        [4200, 4800].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          osc.type = "sine";
          osc.frequency.value = freq;
          const og = ctx.createGain();
          og.gain.value = 0;
          const now = ctx.currentTime;
          for (let t = idx * 0.4; t < 120; t += 0.8 + idx * 0.3) {
            og.gain.setValueAtTime(0, now + t);
            og.gain.linearRampToValueAtTime(0.015, now + t + 0.02);
            og.gain.linearRampToValueAtTime(0, now + t + 0.06);
          }
          osc.connect(og);
          og.connect(gain);
          osc.start();
          sources.push(osc);
        });
      } else {
        const src = ctx.createBufferSource();
        src.buffer = buildNoise(ctx, "white");
        src.loop = true;
        src.connect(gain);
        src.start();
        sources.push(src);
      }

      nodesRef.current.sources = sources;
    },
    [stopSound, buildNoise],
  );

  useEffect(() => {
    if (nodesRef.current.gain && ctxRef.current) {
      nodesRef.current.gain.gain.linearRampToValueAtTime(
        volume,
        ctxRef.current.currentTime + 0.1,
      );
    }
  }, [volume]);

  useEffect(() => () => stopSound(), [stopSound]);

  const toggle = () => {
    if (active) {
      stopSound();
      setActive(false);
    } else {
      startSound(soundType, volume);
      setActive(true);
    }
  };

  const changeType = (id) => {
    setSoundType(id);
    if (active) startSound(id, volume);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setPanelOpen((p) => !p)}
        className={`rounded-lg px-3 py-1.5 text-xs transition ${
          active
            ? "bg-cyan-600/30 text-cyan-300 ring-1 ring-cyan-500/50"
            : "bg-slate-800 text-slate-400 hover:text-slate-200"
        }`}
        aria-label="Ambient sounds"
        title="Ambient sounds"
      >
        {active ? "\u{1F3B5}" : "\u{1F507}"}
      </button>
      {panelOpen && (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-300">
              Ambient Soundscape
            </span>
            <button
              onClick={toggle}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                active
                  ? "bg-cyan-600 text-white hover:bg-cyan-500"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {active ? "On" : "Off"}
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SOUNDSCAPES.map((s) => (
              <button
                key={s.id}
                onClick={() => changeType(s.id)}
                className={`rounded-lg border px-2 py-1 text-xs transition ${
                  soundType === s.id
                    ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                    : "border-slate-600 text-slate-400 hover:border-slate-500"
                }`}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
          <div>
            <label className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Volume</span>
              <span>{Math.round(volume * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Constants (mirrored from backend for UI) ----
const TOPICS = [
  "anxiety",
  "loneliness",
  "stress",
  "relationships",
  "self-esteem",
  "grief",
  "motivation",
  "sleep",
  "academic",
  "general",
];
const LOOKING_FOR = ["casual", "deep_talk", "listener", "advice", "vent"];
const COMM_STYLES = ["talker", "listener", "balanced"];
const AVAILABILITY = ["5min", "15min", "30min"];
const AGE_BRACKETS = ["under18", "18-24", "25-34", "35+"];
const WARMUP_OPTIONS = ["off", "1min", "2min", "5min", "untilReady"];
const EMOJI_REACTIONS = ["❤️", "😂", "🤗", "💪", "🙏", "😢", "👍", "✨"];
const QUICK_EMOJIS = ["😊", "😢", "😰", "😡", "😴", "🤗", "💪", "🙏", "❤️", "😔"];
const GRATITUDE_CARDS = [
  "Thank you for listening. It meant more than you know. 💙",
  "I'm glad we talked. You made my day a little brighter. ✨",
  "Your kindness today reminded me that good people exist. 🤗",
  "I felt heard for the first time in a while. Thank you. 🙏",
  "You gave me something to smile about today. 😊",
];

// ---- Phases ----
// consent → questionnaire → queue → chat → feedback
const PHASE = { CONSENT: 0, QUESTIONNAIRE: 1, QUEUE: 2, CHAT: 3, FEEDBACK: 4 };

// ---- Chat Themes ----
const THEMES = {
  dark: {
    id: "dark",
    label: "Dark",
    emoji: "🌑",
    pageBg: "bg-slate-950",
    cardBg: "bg-slate-900/70",
    cardBorder: "border-slate-700/50",
    headerText: "text-slate-100",
    bodyText: "text-slate-200",
    mutedText: "text-slate-400",
    dimText: "text-slate-500",
    bubbleMe: "bg-cyan-700 text-white",
    bubblePartner: "bg-slate-800 text-slate-200",
    inputBg: "bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-400 focus:border-cyan-500 focus:ring-cyan-500",
    btnPrimary: "bg-cyan-600 hover:bg-cyan-500 text-white focus:ring-cyan-500",
    btnSecondary: "bg-slate-800 text-slate-400 hover:text-slate-200",
    popoverBg: "bg-slate-800 border-slate-700",
    accentText: "text-cyan-400",
    accentBorder: "border-cyan-500",
    accentBg: "bg-cyan-600/20",
    topicBadge: "bg-slate-800 text-slate-400",
    partnerBar: "bg-slate-900/70 border-slate-700/50",
    actionHover: "hover:bg-slate-800",
  },
  warm: {
    id: "warm",
    label: "Warm",
    emoji: "🌅",
    pageBg: "bg-stone-950",
    cardBg: "bg-stone-900/70",
    cardBorder: "border-amber-800/30",
    headerText: "text-amber-50",
    bodyText: "text-stone-200",
    mutedText: "text-stone-400",
    dimText: "text-stone-500",
    bubbleMe: "bg-amber-700 text-white",
    bubblePartner: "bg-stone-800 text-stone-200",
    inputBg: "bg-stone-800 border-stone-600 text-stone-100 placeholder-stone-400 focus:border-amber-500 focus:ring-amber-500",
    btnPrimary: "bg-amber-600 hover:bg-amber-500 text-white focus:ring-amber-500",
    btnSecondary: "bg-stone-800 text-stone-400 hover:text-stone-200",
    popoverBg: "bg-stone-800 border-stone-700",
    accentText: "text-amber-400",
    accentBorder: "border-amber-500",
    accentBg: "bg-amber-600/20",
    topicBadge: "bg-stone-800 text-stone-400",
    partnerBar: "bg-stone-900/70 border-amber-800/30",
    actionHover: "hover:bg-stone-800",
  },
  ocean: {
    id: "ocean",
    label: "Ocean",
    emoji: "🌊",
    pageBg: "bg-sky-950",
    cardBg: "bg-sky-900/50",
    cardBorder: "border-sky-700/40",
    headerText: "text-sky-50",
    bodyText: "text-sky-100",
    mutedText: "text-sky-300",
    dimText: "text-sky-400",
    bubbleMe: "bg-teal-600 text-white",
    bubblePartner: "bg-sky-800/80 text-sky-100",
    inputBg: "bg-sky-800/60 border-sky-600 text-sky-50 placeholder-sky-400 focus:border-teal-400 focus:ring-teal-400",
    btnPrimary: "bg-teal-600 hover:bg-teal-500 text-white focus:ring-teal-500",
    btnSecondary: "bg-sky-800/60 text-sky-300 hover:text-sky-100",
    popoverBg: "bg-sky-800 border-sky-700",
    accentText: "text-teal-400",
    accentBorder: "border-teal-500",
    accentBg: "bg-teal-600/20",
    topicBadge: "bg-sky-800/60 text-sky-300",
    partnerBar: "bg-sky-900/50 border-sky-700/40",
    actionHover: "hover:bg-sky-800",
  },
};

export default function AnonymousChat() {
  // ---- Core state ----
  const [phase, setPhase] = useState(PHASE.CONSENT);
  const socketRef = useRef(null);
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ---- Identity ----
  const [myName, setMyName] = useState("");
  const [myAvatar, setMyAvatar] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [partnerAvatar, setPartnerAvatar] = useState("");

  // ---- Questionnaire ----
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [lookingFor, setLookingFor] = useState("casual");
  const [commStyle, setCommStyle] = useState("balanced");
  const [mood, setMood] = useState(3);
  const [availability, setAvailability] = useState("15min");
  const [warmup, setWarmup] = useState("off");
  const [ageBracket, setAgeBracket] = useState("");
  const [isListener, setIsListener] = useState(false);
  const [triggerWarnings, setTriggerWarnings] = useState([]);
  const [reconnectCode, setReconnectCode] = useState("");

  // ---- Queue ----
  const [queuePosition, setQueuePosition] = useState(null);
  const [queueTotal, setQueueTotal] = useState(null);

  // ---- Chat ----
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [sharedTopic, setSharedTopic] = useState("");
  const [warmupActive, setWarmupActive] = useState(false);
  const [warmupSeconds, setWarmupSeconds] = useState(0);
  const [warmupMode, setWarmupMode] = useState("off");
  const [showCrisisBanner, setShowCrisisBanner] = useState(false);
  const [crisisMessage, setCrisisMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickEmojis, setShowQuickEmojis] = useState(false);
  const [showGratitude, setShowGratitude] = useState(false);
  const [reconnectCodeResult, setReconnectCodeResult] = useState("");
  const [chatEndReason, setChatEndReason] = useState("");

  // ---- Feedback ----
  const [feedbackPositive, setFeedbackPositive] = useState(null);
  const [chatSummary, setChatSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // ---- Settings ----
  const [textSize, setTextSize] = useState("base"); // sm, base, lg
  const [theme, setTheme] = useState("dark");
  const [themePanelOpen, setThemePanelOpen] = useState(false);
  const t = THEMES[theme] || THEMES.dark;

  // ---- Auto-scroll ----
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, partnerTyping]);

  // ---- Fetch Groq summary when entering feedback ----
  useEffect(() => {
    if (phase !== PHASE.FEEDBACK) return;
    const chatMsgs = messages.filter(
      (m) => m.sender === "me" || m.sender === "partner",
    );
    if (chatMsgs.length < 2) return;
    setSummaryLoading(true);
    setChatSummary("");
    const ctrl = new AbortController();
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/anon/summary`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatMsgs }),
        signal: ctrl.signal,
      },
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setChatSummary(d.summary || ""))
      .catch((e) => {
        if (e !== "AbortError") console.warn("Summary fetch failed:", e);
      })
      .finally(() => setSummaryLoading(false));
    return () => ctrl.abort();
  }, [phase]);

  // ---- Warm-up timer ----
  useEffect(() => {
    if (!warmupActive) return;
    const interval = setInterval(() => {
      setWarmupSeconds((s) => {
        if (warmupMode === "untilReady") return s + 1;
        const limitMap = { "1min": 60, "2min": 120, "5min": 300 };
        const limit = limitMap[warmupMode] || 0;
        if (s + 1 >= limit) {
          setWarmupActive(false);
          return 0;
        }
        return s + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [warmupActive, warmupMode]);

  // ---- Socket setup ----
  const initSocket = useCallback(() => {
    if (socketRef.current) return;
    const newSocket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000",
      { transports: ["websocket", "polling"] },
    );
    socketRef.current = newSocket;

    // Identity
    newSocket.on("anonIdentity", ({ name, avatarSeed }) => {
      setMyName(name);
      setMyAvatar(avatarSeed);
    });

    // Queue position
    newSocket.on("queuePosition", ({ position, total }) => {
      setQueuePosition(position);
      setQueueTotal(total);
    });

    // Matched
    newSocket.on("matched", (data) => {
      setPartnerName(data.partnerName);
      setPartnerAvatar(data.partnerAvatar || "");
      setSharedTopic(data.sharedTopic || "");
      const wd = data.warmupDuration || "off";
      setWarmupMode(wd);
      if (wd !== "off") {
        setWarmupActive(true);
        setWarmupSeconds(0);
      }
      setMessages([]);
      setPhase(PHASE.CHAT);
    });

    // Messages
    newSocket.on("receiveMessage", (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          text: msg.text,
          sender: "partner",
          senderName: msg.senderName,
          ts: msg.timestamp,
        },
      ]);
      setPartnerTyping(false);
    });

    // System messages
    newSocket.on("systemMessage", (msg) => {
      setMessages((prev) => [
        ...prev,
        {
          text: msg.text,
          sender: "system",
          showCrisisLink: msg.showCrisisLink,
        },
      ]);
    });

    // Typing
    newSocket.on("partnerTyping", () => {
      setPartnerTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(
        () => setPartnerTyping(false),
        2500,
      );
    });
    newSocket.on("partnerStopTyping", () => setPartnerTyping(false));

    // Partner warmup ready
    newSocket.on("partnerWarmupReady", () => {
      setMessages((prev) => [
        ...prev,
        { text: "Your partner is ready to chat!", sender: "system" },
      ]);
    });

    // Emoji reactions
    newSocket.on("emojiReaction", ({ emoji, senderName }) => {
      setMessages((prev) => [
        ...prev,
        { text: `${senderName} reacted: ${emoji}`, sender: "reaction" },
      ]);
    });

    // Gratitude cards
    newSocket.on("gratitudeCard", ({ text, senderName }) => {
      setMessages((prev) => [
        ...prev,
        { text: `💌 ${senderName}: ${text}`, sender: "gratitude" },
      ]);
    });

    // Crisis resources
    newSocket.on("crisisResources", ({ message }) => {
      setCrisisMessage(message);
      setShowCrisisBanner(true);
    });

    // Reconnect code
    newSocket.on("reconnectCode", ({ code }) => {
      setReconnectCodeResult(code);
    });

    // Reconnect request from partner
    newSocket.on("reconnectRequest", () => {
      setMessages((prev) => [
        ...prev,
        {
          text: "Your partner wants to exchange a reconnect code. Click 🔗 to agree.",
          sender: "system",
        },
      ]);
    });

    // Chat ended
    newSocket.on("chatEnded", ({ reason }) => {
      setChatEndReason(reason);
      setPhase(PHASE.FEEDBACK);
    });

    // Partner disconnected
    newSocket.on("partnerDisconnected", ({ reason }) => {
      setChatEndReason(reason || "disconnected");
      setPhase(PHASE.FEEDBACK);
    });

    return newSocket;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // ---- Actions ----
  const acceptConsent = () => setPhase(PHASE.QUESTIONNAIRE);

  const joinQueue = () => {
    const sock = initSocket();
    if (!sock && !socketRef.current) return;
    const s = socketRef.current;
    s.emit("joinQueue", {
      topics: selectedTopics.length ? selectedTopics : ["general"],
      lookingFor,
      commStyle,
      mood,
      availability,
      warmup,
      ageBracket: ageBracket || null,
      isListener,
      triggerWarnings,
      reconnectCode: reconnectCode.trim() || null,
    });
    setPhase(PHASE.QUEUE);
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit("sendMessage", text);
    setMessages((prev) => [...prev, { text, sender: "me", ts: Date.now() }]);
    setInput("");
    socketRef.current.emit("stopTyping");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else {
      socketRef.current?.emit("typing");
    }
  };

  const sendEmoji = (emoji) => {
    socketRef.current?.emit("emojiReaction", emoji);
    setMessages((prev) => [
      ...prev,
      { text: `You reacted: ${emoji}`, sender: "reaction" },
    ]);
    setShowEmojiPicker(false);
  };

  const sendGratitude = (idx) => {
    socketRef.current?.emit("sendGratitude", idx);
    setMessages((prev) => [
      ...prev,
      { text: `💌 You: ${GRATITUDE_CARDS[idx]}`, sender: "gratitude" },
    ]);
    setShowGratitude(false);
  };

  const requestReconnect = () => {
    socketRef.current?.emit("requestReconnect");
  };

  const reportPartner = () => {
    if (
      confirm(
        "Are you sure you want to report this user? This will end the chat.",
      )
    ) {
      socketRef.current?.emit("reportPartner", { reason: "inappropriate" });
    }
  };

  const blockPartner = () => {
    socketRef.current?.emit("blockPartner");
  };

  const leaveChat = () => {
    socketRef.current?.emit("leaveChat");
    setChatEndReason("left");
    setPhase(PHASE.FEEDBACK);
  };

  const endWarmup = () => {
    setWarmupActive(false);
    socketRef.current?.emit("warmupReady");
  };

  const submitFeedback = (positive) => {
    setFeedbackPositive(positive);
    socketRef.current?.emit("feedback", { positive });
  };

  const startOver = () => {
    setPhase(PHASE.CONSENT);
    setMessages([]);
    setPartnerName("");
    setPartnerAvatar("");
    setReconnectCodeResult("");
    setChatEndReason("");
    setFeedbackPositive(null);
    setChatSummary("");
    setShowCrisisBanner(false);
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const findNewPartner = () => {
    setMessages([]);
    setPartnerName("");
    setPartnerAvatar("");
    setReconnectCodeResult("");
    setChatEndReason("");
    setFeedbackPositive(null);
    setChatSummary("");
    setShowCrisisBanner(false);
    setPhase(PHASE.QUESTIONNAIRE);
  };

  // ---- Toggle helpers ----
  const toggleTopic = (t) =>
    setSelectedTopics((prev) =>
      prev.includes(t)
        ? prev.filter((x) => x !== t)
        : prev.length < 6
          ? [...prev, t]
          : prev,
    );
  const toggleTrigger = (t) =>
    setTriggerWarnings((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  // ---- Text size class ----
  const textCls =
    textSize === "sm" ? "text-xs" : textSize === "lg" ? "text-lg" : "text-sm";

  // =================================================================
  //  RENDER
  // =================================================================
  return (
    <div className={`min-h-screen ${t.pageBg} p-6 md:p-10 transition-colors duration-300`}>
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className={`text-2xl font-bold ${t.headerText}`}>
            👤 Anonymous Chat
          </h1>
          <div className="flex gap-2">
            {/* Theme picker */}
            {(phase === PHASE.QUEUE || phase === PHASE.CHAT) && (
              <div className="relative">
                <button
                  onClick={() => setThemePanelOpen((p) => !p)}
                  className={`rounded-lg px-3 py-1.5 text-xs transition ${t.btnSecondary}`}
                  aria-label="Change theme"
                  title="Chat theme"
                >
                  {THEMES[theme].emoji}
                </button>
                {themePanelOpen && (
                  <div className={`absolute right-0 top-full z-20 mt-2 w-36 rounded-xl border p-2 shadow-xl backdrop-blur-xl ${t.popoverBg}`}>
                    {Object.values(THEMES).map((th) => (
                      <button
                        key={th.id}
                        onClick={() => { setTheme(th.id); setThemePanelOpen(false); }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs transition ${
                          theme === th.id
                            ? `${t.accentBg} ${t.accentText}`
                            : `${t.mutedText} ${t.actionHover}`
                        }`}
                      >
                        <span>{th.emoji}</span> {th.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Ambient soundscape */}
            {(phase === PHASE.QUEUE || phase === PHASE.CHAT) && (
              <AmbientSoundscape />
            )}
            {/* Text size toggle */}
            {phase === PHASE.CHAT && (
              <button
                onClick={() =>
                  setTextSize((s) =>
                    s === "sm" ? "base" : s === "base" ? "lg" : "sm",
                  )
                }
                className={`rounded-lg px-3 py-1.5 text-xs transition ${t.btnSecondary}`}
                aria-label="Toggle text size"
              >
                Aa
              </button>
            )}
          </div>
        </div>

        {/* =================== CONSENT =================== */}
        {phase === PHASE.CONSENT && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-semibold text-cyan-400">
              Community Guidelines
            </h2>
            <div className="mb-6 space-y-3 text-sm leading-relaxed text-slate-300">
              <p>
                Welcome to MindSafe Anonymous Chat — a safe space to connect
                with another person who understands.
              </p>
              <ul className="list-inside list-disc space-y-1 text-slate-400">
                <li>Be kind, respectful, and supportive</li>
                <li>Never share personal identifying information</li>
                <li>No harassment, hate speech, or explicit content</li>
                <li>
                  If you or your partner are in crisis, resources will be
                  provided
                </li>
                <li>
                  You can leave or report at any time — your safety comes first
                </li>
                <li>
                  Messages are not stored and disappear when the chat ends
                </li>
              </ul>
              <p className="text-xs text-slate-500">
                By continuing, you agree to these guidelines. Violations may
                result in temporary or permanent restrictions.
              </p>
            </div>

            {/* Reconnect code entry */}
            <div className="mb-6">
              <label className="mb-1 block text-xs font-medium text-slate-400">
                Have a reconnect code? (optional)
              </label>
              <input
                value={reconnectCode}
                onChange={(e) => setReconnectCode(e.target.value)}
                placeholder="e.g. Calm-Owl-4821"
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>

            <button
              onClick={acceptConsent}
              className="w-full rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              I Agree — Continue
            </button>
          </div>
        )}

        {/* =================== QUESTIONNAIRE =================== */}
        {phase === PHASE.QUESTIONNAIRE && (
          <div className="space-y-6 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 backdrop-blur-xl">
            <h2 className="text-xl font-semibold text-cyan-400">
              Match Preferences
            </h2>
            <p className="text-sm text-slate-400">
              Help us find the best match for you. All fields are optional.
            </p>

            {/* Topics */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                What would you like to talk about?
              </legend>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTopic(t)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selectedTopics.includes(t)
                        ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Looking for */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                What are you looking for?
              </legend>
              <div className="flex flex-wrap gap-2">
                {LOOKING_FOR.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLookingFor(l)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      lookingFor === l
                        ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {l.replace("_", " ")}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Communication style */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                Communication style
              </legend>
              <div className="flex gap-2">
                {COMM_STYLES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setCommStyle(s)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      commStyle === s
                        ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Mood slider */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Current mood: {["😢", "😟", "😐", "🙂", "😊"][mood - 1]}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={mood}
                onChange={(e) => setMood(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Very low</span>
                <span>Great</span>
              </div>
            </div>

            {/* Availability */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                Available for
              </legend>
              <div className="flex gap-2">
                {AVAILABILITY.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAvailability(a)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      availability === a
                        ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Warm-up */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                Warm-up period (optional)
              </legend>
              <p className="mb-2 text-xs text-slate-500">
                A gentle warm-up before free chatting begins.
              </p>
              <div className="flex flex-wrap gap-2">
                {WARMUP_OPTIONS.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWarmup(w)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      warmup === w
                        ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {w === "untilReady" ? "until I'm ready" : w}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Age bracket */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                Age range (optional)
              </legend>
              <div className="flex gap-2">
                {AGE_BRACKETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAgeBracket(ageBracket === a ? "" : a)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      ageBracket === a
                        ? "border-cyan-500 bg-cyan-600/20 text-cyan-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Trigger warnings */}
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-300">
                Topics to avoid
              </legend>
              <p className="mb-2 text-xs text-slate-500">
                You won&apos;t be matched with someone wanting to discuss these.
              </p>
              <div className="flex flex-wrap gap-2">
                {TOPICS.filter((t) => t !== "general").map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTrigger(t)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      triggerWarnings.includes(t)
                        ? "border-red-500 bg-red-600/20 text-red-300"
                        : "border-slate-600 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Peer listener */}
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={isListener}
                onChange={(e) => setIsListener(e.target.checked)}
                className="h-4 w-4 rounded accent-cyan-500"
              />
              I&apos;m here to listen and support others
            </label>

            <button
              onClick={joinQueue}
              className="w-full rounded-xl bg-cyan-600 px-6 py-3 font-semibold text-white transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              Find a Match
            </button>
          </div>
        )}

        {/* =================== QUEUE =================== */}
        {phase === PHASE.QUEUE && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 text-center backdrop-blur-xl">
            {myAvatar ? (
              <div className="mb-4 flex justify-center">
                <AnonAvatar seed={myAvatar} size={64} />
              </div>
            ) : (
              <div className="mb-4 text-5xl">⏳</div>
            )}
            {myName && (
              <p className="mb-2 text-sm text-slate-400">
                Your name:{" "}
                <span className="font-medium text-cyan-400">{myName}</span>
              </p>
            )}
            <p className="text-lg text-slate-200">
              Looking for the best match...
            </p>
            {queuePosition !== null && (
              <p className="mt-2 text-sm text-slate-400">
                Position:{" "}
                <span className="font-medium text-cyan-400">
                  {queuePosition}
                </span>
                {queueTotal ? ` of ${queueTotal}` : ""}
              </p>
            )}
            <span className="mt-4 inline-flex items-center gap-2 text-sm text-cyan-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
              Searching...
            </span>
            <button
              onClick={startOver}
              className="mt-6 block w-full rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        )}

        {/* =================== CHAT =================== */}
        {phase === PHASE.CHAT && (
          <div className="space-y-3">
            {/* Partner info bar */}
            <div className={`flex items-center justify-between rounded-xl border ${t.partnerBar} px-4 py-2 backdrop-blur-xl`}>
              <div className="flex items-center gap-2">
                {partnerAvatar ? (
                  <AnonAvatar seed={partnerAvatar} size={32} />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600/30 text-sm font-bold text-cyan-300">
                    {partnerName?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <span className={`text-sm font-medium ${t.bodyText}`}>
                    {partnerName}
                  </span>
                  {sharedTopic && sharedTopic !== "general" && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${t.topicBadge}`}>
                      {sharedTopic}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={requestReconnect}
                  title="Request reconnect code"
                  className={`rounded-lg p-1.5 ${t.mutedText} ${t.actionHover} hover:${t.accentText.replace('text-', 'text-')}`}
                >
                  🔗
                </button>
                <button
                  onClick={reportPartner}
                  title="Report"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  🚩
                </button>
                <button
                  onClick={blockPartner}
                  title="Block & find new"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  🚫
                </button>
                <button
                  onClick={leaveChat}
                  title="Leave chat"
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-red-400"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Crisis banner */}
            {showCrisisBanner && (
              <div className="rounded-xl border border-red-700/50 bg-red-900/30 px-4 py-3 text-sm text-red-200">
                <button
                  onClick={() => setShowCrisisBanner(false)}
                  className="float-right text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
                <p className="font-medium">🆘 Crisis Resources</p>
                <p className="mt-1 whitespace-pre-line text-xs text-red-300">
                  {crisisMessage}
                </p>
              </div>
            )}

            {/* Warm-up banner */}
            {warmupActive && (
              <div className="rounded-xl border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-center text-sm text-amber-200">
                <p>
                  🌱 Warm-up period — take a moment to settle in (
                  {warmupSeconds}s)
                </p>
                {warmupMode === "untilReady" && (
                  <button
                    onClick={endWarmup}
                    className="mt-2 rounded-lg bg-amber-600/30 px-4 py-1 text-xs font-medium hover:bg-amber-600/50"
                  >
                    I&apos;m Ready
                  </button>
                )}
              </div>
            )}

            {/* Reconnect code display */}
            {reconnectCodeResult && (
              <div className="rounded-xl border border-cyan-700/50 bg-cyan-900/20 px-4 py-3 text-center text-sm text-cyan-200">
                <p className="font-medium">🔗 Reconnect Code</p>
                <p className="mt-1 font-mono text-lg text-cyan-300">
                  {reconnectCodeResult}
                </p>
                <p className="mt-1 text-xs text-cyan-400">
                  Both of you can use this code within 7 days to match again.
                </p>
              </div>
            )}

            {/* Messages area */}
            <div className={`h-[28rem] overflow-y-auto rounded-2xl border ${t.cardBorder} ${t.cardBg} p-4 backdrop-blur-xl transition-colors duration-300`}>
              {messages.map((msg, i) => {
                if (msg.sender === "system") {
                  return (
                    <div
                      key={i}
                      className={`mx-auto my-2 max-w-md text-center text-xs ${t.mutedText}`}
                    >
                      {msg.text}
                    </div>
                  );
                }
                if (msg.sender === "reaction" || msg.sender === "gratitude") {
                  return (
                    <div
                      key={i}
                      className={`mx-auto my-1 text-center text-xs ${t.dimText}`}
                    >
                      {msg.text}
                    </div>
                  );
                }
                const isMe = msg.sender === "me";
                return (
                  <div
                    key={i}
                    className={`mb-2 flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}
                  >
                    {!isMe && (
                      <AnonAvatar seed={partnerAvatar} size={24} className="mb-0.5 shrink-0" />
                    )}
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2 ${textCls} ${
                        isMe ? t.bubbleMe : t.bubblePartner
                      }`}
                    >
                      {msg.text}
                    </div>
                    {isMe && (
                      <AnonAvatar seed={myAvatar} size={24} className="mb-0.5 shrink-0" />
                    )}
                  </div>
                );
              })}

              {partnerTyping && (
                <div className={`flex items-center gap-1 text-xs ${t.mutedText}`}>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  <span className="animation-delay-100 h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  <span className="animation-delay-200 h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                  <span className="ml-1">{partnerName} is typing...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input bar */}
            {showQuickEmojis && (
              <div className="mb-2 flex flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2">
                {QUICK_EMOJIS.map((emoji) => (
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
            <div className="flex gap-2">
              {/* Quick emoji toggle */}
              <button
                onClick={() => {
                  setShowQuickEmojis(!showQuickEmojis);
                  setShowEmojiPicker(false);
                  setShowGratitude(false);
                }}
                className={`rounded-xl border px-3 py-2.5 text-sm transition ${t.inputBg.split(' ').slice(0,2).join(' ')} hover:opacity-80`}
                aria-label="Quick emojis"
              >
                😊
              </button>
              {/* Emoji reaction picker toggle */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowGratitude(false);
                    setShowQuickEmojis(false);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-sm transition ${t.inputBg.split(' ').slice(0,2).join(' ')} hover:opacity-80`}
                  aria-label="Emoji reactions"
                >
                  🎉
                </button>
                {showEmojiPicker && (
                  <div className={`absolute bottom-12 left-0 z-10 flex gap-1 rounded-xl border p-2 shadow-lg ${t.popoverBg}`}>
                    {EMOJI_REACTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => sendEmoji(e)}
                        className="rounded p-1 text-lg hover:bg-slate-700"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Gratitude picker toggle */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowGratitude(!showGratitude);
                    setShowEmojiPicker(false);
                    setShowQuickEmojis(false);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-sm transition ${t.inputBg.split(' ').slice(0,2).join(' ')} hover:opacity-80`}
                  aria-label="Send gratitude card"
                >
                  💌
                </button>
                {showGratitude && (
                  <div className={`absolute bottom-12 left-0 z-10 w-72 space-y-1 rounded-xl border p-3 shadow-lg ${t.popoverBg}`}>
                    {GRATITUDE_CARDS.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => sendGratitude(i)}
                        className={`block w-full rounded-lg px-3 py-2 text-left text-xs ${t.mutedText} ${t.actionHover}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm outline-none focus:ring-1 ${t.inputBg}`}
                placeholder="Type a message..."
                aria-label="Message input"
              />
              <button
                onClick={sendMessage}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 ${t.btnPrimary}`}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {/* =================== FEEDBACK =================== */}
        {phase === PHASE.FEEDBACK && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 text-center backdrop-blur-xl">
            <p className="mb-2 text-sm text-slate-400">
              Chat ended
              {chatEndReason ? ` (${chatEndReason.replace("_", " ")})` : ""}
            </p>

            {feedbackPositive === null ? (
              <>
                <p className="mb-6 text-lg text-slate-200">
                  How was your experience?
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => submitFeedback(true)}
                    className="rounded-xl border border-green-600 bg-green-600/20 px-8 py-3 text-2xl transition hover:bg-green-600/40"
                  >
                    👍
                  </button>
                  <button
                    onClick={() => submitFeedback(false)}
                    className="rounded-xl border border-red-600 bg-red-600/20 px-8 py-3 text-2xl transition hover:bg-red-600/40"
                  >
                    👎
                  </button>
                </div>
              </>
            ) : (
              <p className="mb-6 text-slate-300">
                Thank you for your feedback! 💙
              </p>
            )}

            {reconnectCodeResult && (
              <div className="mt-4 rounded-xl border border-cyan-700/50 bg-cyan-900/20 p-4">
                <p className="text-sm text-cyan-300">Your reconnect code:</p>
                <p className="mt-1 font-mono text-xl text-cyan-200">
                  {reconnectCodeResult}
                </p>
              </div>
            )}

            {/* AI conversation summary */}
            {summaryLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                Generating conversation summary...
              </div>
            )}
            {chatSummary && (
              <div className="mt-4 rounded-xl border border-indigo-700/40 bg-indigo-900/20 px-5 py-4 text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  ✨ Conversation Summary
                </p>
                <p className="text-sm leading-relaxed text-slate-300">
                  {chatSummary}
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3 justify-center">
              <button
                onClick={findNewPartner}
                className="rounded-xl bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
              >
                Find New Partner
              </button>
              <button
                onClick={startOver}
                className="rounded-xl border border-slate-600 px-6 py-2.5 text-sm text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
              >
                Exit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
