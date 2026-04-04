"use client";
import { useState, useEffect } from "react";

const AFFIRMATIONS = [
  { text: "I am worthy of love and kindness.", category: "Self-Love" },
  {
    text: "My feelings are valid, and it's okay to feel them.",
    category: "Emotions",
  },
  { text: "I am stronger than I think.", category: "Strength" },
  { text: "I choose peace over worry.", category: "Peace" },
  { text: "I deserve rest and recovery.", category: "Self-Care" },
  {
    text: "I am making progress every day, even when I can't see it.",
    category: "Growth",
  },
  { text: "My past does not define my future.", category: "Strength" },
  {
    text: "I trust myself to handle whatever comes my way.",
    category: "Confidence",
  },
  { text: "I release what I cannot control.", category: "Peace" },
  { text: "I am enough, exactly as I am right now.", category: "Self-Love" },
  { text: "It's okay to ask for help.", category: "Self-Care" },
  { text: "I choose to focus on what I can change.", category: "Growth" },
  {
    text: "I give myself permission to take things one step at a time.",
    category: "Peace",
  },
  {
    text: "My mental health matters, and I prioritize it.",
    category: "Self-Care",
  },
  { text: "Every breath I take calms my mind.", category: "Peace" },
  {
    text: "I am resilient and capable of overcoming challenges.",
    category: "Strength",
  },
  { text: "I celebrate my small victories.", category: "Growth" },
  {
    text: "I radiate positivity and attract good energy.",
    category: "Confidence",
  },
  { text: "I forgive myself for past mistakes.", category: "Self-Love" },
  { text: "Today, I choose joy.", category: "Emotions" },
  { text: "I am grateful for this moment.", category: "Peace" },
  { text: "My journey is unique and I honor it.", category: "Self-Love" },
  { text: "I let go of thoughts that don't serve me.", category: "Emotions" },
  {
    text: "I am surrounded by love, even when I can't feel it.",
    category: "Self-Love",
  },
  {
    text: "I have the courage to set healthy boundaries.",
    category: "Strength",
  },
];

const CATEGORIES = [
  "All",
  "Self-Love",
  "Strength",
  "Peace",
  "Self-Care",
  "Growth",
  "Emotions",
  "Confidence",
];

const CAT_COLORS = {
  "Self-Love": "from-pink-500/20 to-rose-500/20 border-pink-700/40",
  Strength: "from-orange-500/20 to-amber-500/20 border-orange-700/40",
  Peace: "from-cyan-500/20 to-blue-500/20 border-cyan-700/40",
  "Self-Care": "from-emerald-500/20 to-green-500/20 border-emerald-700/40",
  Growth: "from-violet-500/20 to-purple-500/20 border-violet-700/40",
  Emotions: "from-yellow-500/20 to-amber-500/20 border-yellow-700/40",
  Confidence: "from-indigo-500/20 to-blue-500/20 border-indigo-700/40",
};

export default function Affirmations({ onBack }) {
  const [index, setIndex] = useState(0);
  const [favorites, setFavorites] = useState([]);
  const [showFavs, setShowFavs] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("mindsafe_affirmation_favs");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const filtered =
    activeCategory === "All"
      ? AFFIRMATIONS
      : AFFIRMATIONS.filter((a) => a.category === activeCategory);

  const current = filtered[index % filtered.length];

  const saveFavs = (list) => {
    setFavorites(list);
    localStorage.setItem("mindsafe_affirmation_favs", JSON.stringify(list));
  };

  const toggleFav = (text) => {
    if (favorites.includes(text)) {
      saveFavs(favorites.filter((f) => f !== text));
    } else {
      saveFavs([...favorites, text]);
    }
  };

  const navigate = (dir) => {
    setTransitioning(true);
    setTimeout(() => {
      setIndex((i) => {
        const next = i + dir;
        if (next < 0) return filtered.length - 1;
        return next % filtered.length;
      });
      setTransitioning(false);
    }, 200);
  };

  const isFav = current && favorites.includes(current.text);
  const colorClass = current
    ? CAT_COLORS[current.category] ||
      "from-slate-500/20 to-slate-500/20 border-slate-700/40"
    : "";

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>
      <h2 className="mb-2 text-2xl font-bold text-slate-100">
        💜 Affirmations
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Swipe through affirmations. Save the ones that resonate.
      </p>

      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => {
            setShowFavs(false);
            setIndex(0);
          }}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${!showFavs ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          Browse
        </button>
        <button
          onClick={() => setShowFavs(true)}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${showFavs ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          ❤️ Favorites ({favorites.length})
        </button>
      </div>

      {!showFavs && (
        <>
          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-lg mx-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setIndex(0);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  activeCategory === cat
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <p className="text-slate-500">No affirmations in this category.</p>
          ) : (
            <>
              {/* Card */}
              <div
                className={`rounded-2xl border bg-gradient-to-br p-8 mx-auto max-w-md transition-all duration-200 ${colorClass} ${transitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
              >
                <p className="text-xs text-slate-500 mb-4">
                  {current.category}
                </p>
                <p className="text-xl font-medium text-slate-100 leading-relaxed mb-6">
                  &ldquo;{current.text}&rdquo;
                </p>
                <button
                  onClick={() => toggleFav(current.text)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    isFav
                      ? "bg-pink-600/30 text-pink-300"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {isFav ? "❤️ Saved" : "🤍 Save"}
                </button>
              </div>

              {/* Navigation */}
              <div className="flex justify-center items-center gap-6 mt-6">
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-full bg-slate-800 w-12 h-12 text-lg transition hover:bg-slate-700"
                >
                  ←
                </button>
                <span className="text-xs text-slate-500">
                  {(index % filtered.length) + 1} / {filtered.length}
                </span>
                <button
                  onClick={() => navigate(1)}
                  className="rounded-full bg-slate-800 w-12 h-12 text-lg transition hover:bg-slate-700"
                >
                  →
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Arrow buttons to browse
              </p>
            </>
          )}
        </>
      )}

      {showFavs && (
        <div className="max-w-md mx-auto">
          {favorites.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8">
              <p className="text-slate-400">
                No favorites yet. Browse and save affirmations that resonate
                with you.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {favorites.map((text) => {
                const aff = AFFIRMATIONS.find((a) => a.text === text);
                const catColor = aff ? CAT_COLORS[aff.category] : "";
                return (
                  <div
                    key={text}
                    className={`rounded-xl border bg-gradient-to-br p-4 text-left ${catColor}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">
                          {aff?.category}
                        </p>
                        <p className="text-sm text-slate-200">
                          &ldquo;{text}&rdquo;
                        </p>
                      </div>
                      <button
                        onClick={() => toggleFav(text)}
                        className="text-xs text-slate-600 hover:text-red-400 transition shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
