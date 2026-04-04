"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Onboarding, { useOnboarding } from "@/components/Onboarding";

const CARDS = [
  {
    icon: "🤖",
    title: "Talk to AI",
    link: "/ai-companion",
    description: "Chat with your AI companion anytime",
  },
  {
    icon: "👤",
    title: "Connect Anonymously",
    link: "/anonymous",
    description: "Talk to someone who understands",
  },
  {
    icon: "💙",
    title: "Log Your Mood",
    link: "/mood",
    description: "Track how you feel today",
  },
  {
    icon: "🎮",
    title: "Relax & Play",
    link: "/games",
    description: "10 activities for your mental wellness",
  },
  {
    icon: "🧑‍🎨",
    title: "Manage Avatar",
    link: "/avatar",
    description: "Customize your 3D avatar",
  },
];

const GREETINGS = ["Good morning", "Good afternoon", "Good evening"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return GREETINGS[0];
  if (h < 18) return GREETINGS[1];
  return GREETINGS[2];
}

const TIPS = [
  "Take a deep breath. You're doing great.",
  "Remember: progress, not perfection.",
  "A 5-minute walk can shift your entire mood.",
  "You don't have to have it all figured out.",
  "Be kind to yourself today.",
  "Small steps count. Keep going.",
  "It's okay to rest. You deserve it.",
];

export default function Dashboard() {
  const [moodStreak, setMoodStreak] = useState(0);
  const [lastMood, setLastMood] = useState(null);
  const [loggedToday, setLoggedToday] = useState(false);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [gameTime, setGameTime] = useState("0m");
  const { showOnboarding, completeOnboarding } = useOnboarding();

  useEffect(() => {
    // Check mood streak from localStorage
    const history = localStorage.getItem("mindsafe_mood_history");
    if (history) {
      try {
        const entries = JSON.parse(history);
        if (entries.length > 0) {
          const latest = entries[entries.length - 1];
          setLastMood(latest);

          // Check if logged today
          const today = new Date().toDateString();
          const latestDate = new Date(
            latest.date || latest.timestamp,
          ).toDateString();
          setLoggedToday(latestDate === today);

          // Calculate streak (consecutive days)
          let streak = 0;
          const now = new Date();
          for (let i = entries.length - 1; i >= 0; i--) {
            const entryDate = new Date(entries[i].date || entries[i].timestamp);
            const diff = Math.floor((now - entryDate) / (1000 * 60 * 60 * 24));
            if (diff <= streak + 1) streak++;
            else break;
          }
          setMoodStreak(streak);
        }
      } catch (_) {}
    }

    // Check game time
    const savedTime = localStorage.getItem("mindsafe_game_time");
    if (savedTime) {
      const mins = Math.floor(parseInt(savedTime) / 60);
      setGameTime(
        mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`,
      );
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10">
      {/* Onboarding overlay for first-time users */}
      {showOnboarding && <Onboarding onComplete={completeOnboarding} />}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100">
          {getGreeting()} 👋
        </h1>
        <p className="mt-1 text-slate-400">Welcome to your safe space</p>
      </div>

      {/* Daily Reminder Banner */}
      {!loggedToday && (
        <Link href="/mood">
          <div className="mb-6 rounded-2xl border border-cyan-700/40 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 p-4 flex items-center justify-between cursor-pointer transition hover:border-cyan-600/60">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💙</span>
              <div>
                <p className="text-sm font-medium text-slate-200">
                  You haven&apos;t logged your mood today
                </p>
                <p className="text-xs text-slate-400">
                  Take a moment to check in with yourself
                </p>
              </div>
            </div>
            <span className="text-sm text-cyan-400 font-medium">Log Now →</span>
          </div>
        </Link>
      )}

      {/* Wellness Tip */}
      <div className="mb-6 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4">
        <p className="text-xs text-slate-500 mb-1">💡 Daily Tip</p>
        <p className="text-sm text-slate-300 italic">&ldquo;{tip}&rdquo;</p>
      </div>

      {/* Quick Stats */}
      <div className="mb-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{moodStreak}</p>
          <p className="mt-1 text-xs text-slate-400">Day Streak 🔥</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 text-center">
          <p className="text-2xl font-bold text-slate-100">
            {lastMood ? lastMood.emoji || lastMood.mood || "—" : "—"}
          </p>
          <p className="mt-1 text-xs text-slate-400">Last Mood</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{gameTime}</p>
          <p className="mt-1 text-xs text-slate-400">Wellness Time</p>
        </div>
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-4 text-center">
          <p className="text-2xl font-bold text-slate-100">🔒</p>
          <p className="mt-1 text-xs text-slate-400">Fully Encrypted</p>
        </div>
      </div>

      {/* Quick Log - if already logged today */}
      {loggedToday && lastMood && (
        <div className="mb-6 rounded-2xl border border-emerald-700/40 bg-emerald-900/10 p-4 flex items-center gap-3">
          <span className="text-2xl">{lastMood.emoji || "✅"}</span>
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Mood logged today
            </p>
            <p className="text-xs text-slate-400">
              {lastMood.mood || lastMood.label || "Recorded"} · Keep the streak
              going!
            </p>
          </div>
        </div>
      )}

      {/* Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link key={card.link} href={card.link}>
            <div className="group cursor-pointer rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-xl transition hover:border-cyan-500/60 hover:bg-slate-900 h-full">
              <div className="mb-3 text-3xl">{card.icon}</div>
              <h3 className="mb-1 text-lg font-semibold text-slate-100 group-hover:text-cyan-400 transition">
                {card.title}
              </h3>
              <p className="text-sm text-slate-400">{card.description}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Footer info */}
      <div className="mt-10 flex justify-center gap-6 text-xs text-slate-600">
        <span>✔ 100% Privacy Protected</span>
        <span>24/7 Support Available</span>
        <span>🔒 End-to-End Encrypted</span>
      </div>
    </div>
  );
}
