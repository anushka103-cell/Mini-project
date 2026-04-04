"use client";

import { useState, useEffect } from "react";
import GuidedBreathing from "./GuidedBreathing";
import MuscleRelaxation from "./MuscleRelaxation";
import Grounding from "./Grounding";
import ZenGarden from "./ZenGarden";
import ColorMatch from "./ColorMatch";
import MemoryCards from "./MemoryCards";
import MindfulMaze from "./MindfulMaze";
import FocusTap from "./FocusTap";
import GratitudeJar from "./GratitudeJar";
import Affirmations from "./Affirmations";

const CATEGORIES = ["All", "Relaxation", "Games", "Wellness"];

const ACTIVITIES = [
  {
    id: "breathing",
    name: "Guided Breathing",
    icon: "🌬️",
    category: "Relaxation",
    difficulty: "Easy",
    description:
      "Box breathing, 4-7-8, and more calming patterns with visual guidance.",
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-700/40",
    component: GuidedBreathing,
  },
  {
    id: "muscle",
    name: "Muscle Relaxation",
    icon: "💆",
    category: "Relaxation",
    difficulty: "Easy",
    description: "Progressive muscle relaxation through 7 body groups.",
    color: "from-emerald-500/20 to-teal-500/20 border-emerald-700/40",
    component: MuscleRelaxation,
  },
  {
    id: "grounding",
    name: "5-4-3-2-1 Grounding",
    icon: "🌿",
    category: "Relaxation",
    difficulty: "Easy",
    description:
      "Engage all 5 senses to ground yourself in the present moment.",
    color: "from-green-500/20 to-emerald-500/20 border-green-700/40",
    component: Grounding,
  },
  {
    id: "zen",
    name: "Zen Garden",
    icon: "🏯",
    category: "Relaxation",
    difficulty: "Free Play",
    description: "Draw peaceful patterns in a virtual sand garden.",
    color: "from-amber-500/20 to-yellow-500/20 border-amber-700/40",
    component: ZenGarden,
  },
  {
    id: "colormatch",
    name: "Color Match",
    icon: "🎨",
    category: "Games",
    difficulty: "Medium",
    description: "Stroop-effect challenge — tap the ink color, not the word!",
    color: "from-violet-500/20 to-purple-500/20 border-violet-700/40",
    component: ColorMatch,
  },
  {
    id: "memory",
    name: "Memory Cards",
    icon: "🧠",
    category: "Games",
    difficulty: "Medium",
    description: "Flip and match calming icons. Train your memory mindfully.",
    color: "from-blue-500/20 to-indigo-500/20 border-blue-700/40",
    component: MemoryCards,
  },
  {
    id: "maze",
    name: "Mindful Maze",
    icon: "🌀",
    category: "Games",
    difficulty: "Hard",
    description:
      "Navigate procedurally generated mazes with focus and patience.",
    color: "from-indigo-500/20 to-violet-500/20 border-indigo-700/40",
    component: MindfulMaze,
  },
  {
    id: "focustrap",
    name: "Focus Tap",
    icon: "🎯",
    category: "Games",
    difficulty: "Medium",
    description: "Tap shrinking targets under time pressure. Build combos!",
    color: "from-orange-500/20 to-red-500/20 border-orange-700/40",
    component: FocusTap,
  },
  {
    id: "gratitude",
    name: "Gratitude Jar",
    icon: "🫙",
    category: "Wellness",
    difficulty: "Easy",
    description: "Write gratitude notes and fill your jar with positivity.",
    color: "from-pink-500/20 to-rose-500/20 border-pink-700/40",
    component: GratitudeJar,
  },
  {
    id: "affirmations",
    name: "Affirmations",
    icon: "💜",
    category: "Wellness",
    difficulty: "Easy",
    description:
      "Browse and save positive affirmations that resonate with you.",
    color: "from-fuchsia-500/20 to-pink-500/20 border-fuchsia-700/40",
    component: Affirmations,
  },
];

const DIFF_BADGES = {
  Easy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  Hard: "border-red-500/30 bg-red-500/10 text-red-400",
  "Free Play": "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
};

export default function GamesPage() {
  const [activeGame, setActiveGame] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [totalTime, setTotalTime] = useState(0);
  const [sessionStart, setSessionStart] = useState(null);

  useEffect(() => {
    const savedFavs = localStorage.getItem("mindsafe_game_favorites");
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    const savedTime = localStorage.getItem("mindsafe_game_time");
    if (savedTime) setTotalTime(parseInt(savedTime));
  }, []);

  useEffect(() => {
    if (activeGame) {
      setSessionStart(Date.now());
    } else if (sessionStart) {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      const newTotal = totalTime + elapsed;
      setTotalTime(newTotal);
      localStorage.setItem("mindsafe_game_time", newTotal.toString());
      setSessionStart(null);
    }
  }, [activeGame]);

  const toggleFavorite = (id) => {
    const updated = favorites.includes(id)
      ? favorites.filter((f) => f !== id)
      : [...favorites, id];
    setFavorites(updated);
    localStorage.setItem("mindsafe_game_favorites", JSON.stringify(updated));
  };

  const filtered =
    activeCategory === "All"
      ? ACTIVITIES
      : ACTIVITIES.filter((a) => a.category === activeCategory);

  const formatTotalTime = () => {
    const mins = Math.floor(totalTime / 60);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  // Render active game
  if (activeGame) {
    const activity = ACTIVITIES.find((a) => a.id === activeGame);
    if (activity) {
      const Component = activity.component;
      return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10">
          <Component onBack={() => setActiveGame(null)} />
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">🎮 Relax & Play</h1>
          <p className="text-sm text-slate-400 mt-1">
            Activities designed for your mental wellness
          </p>
        </div>
        <div className="flex gap-4">
          <div className="rounded-xl bg-slate-900/70 border border-slate-700/50 px-4 py-2 text-center">
            <p className="text-lg font-bold text-cyan-400">
              {ACTIVITIES.length}
            </p>
            <p className="text-xs text-slate-500">Activities</p>
          </div>
          <div className="rounded-xl bg-slate-900/70 border border-slate-700/50 px-4 py-2 text-center">
            <p className="text-lg font-bold text-emerald-400">
              {formatTotalTime()}
            </p>
            <p className="text-xs text-slate-500">Total Time</p>
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count =
            cat === "All"
              ? ACTIVITIES.length
              : ACTIVITIES.filter((a) => a.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
                activeCategory === cat
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-900/70 border border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
              }`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Favorites Section */}
      {favorites.length > 0 && activeCategory === "All" && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-500 mb-3">
            ⭐ Your Favorites
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {ACTIVITIES.filter((a) => favorites.includes(a.id)).map(
              (activity) => (
                <button
                  key={activity.id}
                  onClick={() => setActiveGame(activity.id)}
                  className="flex-shrink-0 rounded-xl border border-slate-700/50 bg-slate-900/70 px-4 py-3 flex items-center gap-3 transition hover:border-cyan-800/50 hover:bg-slate-800/70"
                >
                  <span className="text-2xl">{activity.icon}</span>
                  <span className="text-sm font-medium text-slate-200">
                    {activity.name}
                  </span>
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {/* Activity Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((activity) => (
          <div
            key={activity.id}
            className={`group relative rounded-2xl border bg-gradient-to-br p-6 backdrop-blur-xl transition cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${activity.color}`}
            onClick={() => setActiveGame(activity.id)}
          >
            {/* Favorite toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(activity.id);
              }}
              className="absolute top-4 right-4 text-lg transition hover:scale-125"
            >
              {favorites.includes(activity.id) ? "⭐" : "☆"}
            </button>

            <div className="mb-3 text-4xl">{activity.icon}</div>
            <h2 className="mb-1 text-lg font-semibold text-slate-100">
              {activity.name}
            </h2>
            <p className="mb-3 text-xs text-slate-400 leading-relaxed">
              {activity.description}
            </p>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-3 py-0.5 text-xs font-medium ${DIFF_BADGES[activity.difficulty]}`}
              >
                {activity.difficulty}
              </span>
              <span className="rounded-full border border-slate-600/30 bg-slate-800/50 px-3 py-0.5 text-xs text-slate-500">
                {activity.category}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
