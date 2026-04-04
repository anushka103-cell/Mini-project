"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clearTokens } from "@/lib/authClient";
import { useTheme } from "@/components/ThemeProvider";

const COPING_TIPS = [
  "Breathe slowly — inhale 4s, hold 4s, exhale 6s",
  "Name 5 things you see around you right now",
  "Drink a glass of cool water",
  "Reach out to someone you trust",
];

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/auth/callback",
]);

const NAV_ICONS = {
  "/dashboard": "🏠",
  "/ai-companion": "🤖",
  "/anonymous": "👤",
  "/avatar": "🧑‍🎨",
  "/mood": "💙",
  "/games": "🎮",
  "/profile": "⚙️",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sosOpen, setSosOpen] = useState(false);

  if (PUBLIC_ROUTES.has(pathname)) {
    return null;
  }

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/ai-companion", label: "AI Companion" },
    { href: "/anonymous", label: "Anonymous Chat" },
    { href: "/avatar", label: "My Avatar" },
    { href: "/mood", label: "Mood Tracker" },
    { href: "/games", label: "Relax & Play" },
    { href: "/profile", label: "Profile & Privacy" },
  ];

  return (
    <aside className="hidden w-64 flex-col justify-between border-r border-slate-700/50 bg-slate-900/80 p-6 backdrop-blur-xl md:flex">
      <div>
        <div className="mb-8 flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <h1 className="text-xl font-bold text-cyan-400">MindSafe</h1>
        </div>

        <nav className="flex flex-col space-y-1 text-sm">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition ${
                  isActive
                    ? "border-l-2 border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "text-slate-300 hover:bg-slate-800/60 hover:text-slate-100"
                }`}
              >
                <span>{NAV_ICONS[link.href]}</span>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-6 space-y-2">
        {/* SOS Button */}
        <div className="relative">
          <button
            onClick={() => setSosOpen(!sosOpen)}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              sosOpen
                ? "bg-rose-700 text-white"
                : "bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600/30"
            }`}
          >
            <span>🆘</span> {sosOpen ? "Close SOS" : "SOS"}
          </button>

          {/* SOS Expandable Panel */}
          {sosOpen && (
            <div className="mt-2 rounded-xl border border-rose-500/30 bg-slate-900 p-3 space-y-3">
              <a
                href="tel:112"
                className="flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-rose-500"
              >
                📞 Call 112
              </a>
              <p className="text-xs text-slate-500 text-center">
                Emergency — police, ambulance, fire
              </p>
              <div className="space-y-1">
                {COPING_TIPS.map((tip, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md bg-slate-800/50 p-2"
                  >
                    <span className="text-xs text-amber-400 font-bold">
                      {i + 1}.
                    </span>
                    <p className="text-xs text-slate-400">{tip}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-200/70 text-center">
                You are not alone.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2.5 text-sm transition hover:bg-slate-700"
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={() => {
            clearTokens();
            localStorage.removeItem("token");
            window.location.href = "/login";
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-700/70 px-3 py-2.5 text-sm transition hover:bg-red-600"
        >
          <span>🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
