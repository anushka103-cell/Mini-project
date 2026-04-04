"use client";
import { useState, useEffect, useRef } from "react";

const ICONS = ["🌸", "🌿", "🦋", "🌙", "⭐", "🌊", "🍃", "🌺", "🐚", "☁️"];

const DIFFICULTIES = {
  Easy: { cols: 4, rows: 3, pairs: 6 },
  Medium: { cols: 4, rows: 4, pairs: 8 },
  Hard: { cols: 5, rows: 4, pairs: 10 },
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryCards({ onBack }) {
  const [difficulty, setDifficulty] = useState(null);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [bestScores, setBestScores] = useState({});
  const intervalRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem("mindsafe_memory_best");
    if (saved) setBestScores(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const startGame = (diff) => {
    const { pairs } = DIFFICULTIES[diff];
    const selected = ICONS.slice(0, pairs);
    const deck = shuffleArray([...selected, ...selected]).map((icon, i) => ({
      id: i,
      icon,
    }));
    setDifficulty(diff);
    setCards(deck);
    setFlipped([]);
    setMatched(new Set());
    setMoves(0);
    setTimer(0);
    setRunning(true);
    setComplete(false);
    lockRef.current = false;
  };

  const handleFlip = (index) => {
    if (lockRef.current) return;
    if (flipped.includes(index) || matched.has(index)) return;

    const newFlipped = [...flipped, index];
    setFlipped(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      lockRef.current = true;
      const [a, b] = newFlipped;
      if (cards[a].icon === cards[b].icon) {
        const newMatched = new Set(matched);
        newMatched.add(a);
        newMatched.add(b);
        setMatched(newMatched);
        setFlipped([]);
        lockRef.current = false;

        if (newMatched.size === cards.length) {
          setRunning(false);
          setComplete(true);
          clearInterval(intervalRef.current);
          const key = difficulty;
          const best = bestScores[key];
          if (!best || moves + 1 < best.moves) {
            const updated = {
              ...bestScores,
              [key]: { moves: moves + 1, time: timer },
            };
            setBestScores(updated);
            localStorage.setItem(
              "mindsafe_memory_best",
              JSON.stringify(updated),
            );
          }
        }
      } else {
        setTimeout(() => {
          setFlipped([]);
          lockRef.current = false;
        }, 700);
      }
    }
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!difficulty) {
    return (
      <div className="text-center">
        <button
          onClick={onBack}
          className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
        >
          ← Back
        </button>
        <h2 className="mb-2 text-2xl font-bold text-slate-100">
          🧠 Memory Cards
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Match pairs of calming icons. Train your memory mindfully.
        </p>

        <div className="grid gap-4 max-w-md mx-auto">
          {Object.keys(DIFFICULTIES).map((diff) => {
            const { cols, rows, pairs } = DIFFICULTIES[diff];
            const best = bestScores[diff];
            return (
              <button
                key={diff}
                onClick={() => startGame(diff)}
                className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 text-left transition hover:border-cyan-800/50 hover:bg-slate-800/70"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-100">{diff}</p>
                    <p className="text-xs text-slate-500">
                      {cols}×{rows} grid · {pairs} pairs
                    </p>
                  </div>
                  {best && (
                    <p className="text-xs text-slate-500">
                      Best: {best.moves} moves
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const { cols } = DIFFICULTIES[difficulty];

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-4 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>
      <h2 className="mb-2 text-xl font-bold text-slate-100">
        🧠 Memory Cards — {difficulty}
      </h2>

      <div className="flex justify-center gap-6 mb-4">
        <div>
          <p className="text-lg font-bold text-slate-100">{moves}</p>
          <p className="text-xs text-slate-500">Moves</p>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-100">
            {formatTime(timer)}
          </p>
          <p className="text-xs text-slate-500">Time</p>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-100">
            {matched.size / 2}/{cards.length / 2}
          </p>
          <p className="text-xs text-slate-500">Pairs</p>
        </div>
      </div>

      {complete && (
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-900/20 p-6 mb-4 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-emerald-300 mb-1">
            ✨ Complete!
          </h3>
          <p className="text-sm text-slate-300">
            {moves} moves in {formatTime(timer)}
          </p>
          <div className="flex justify-center gap-3 mt-4">
            <button
              onClick={() => startGame(difficulty)}
              className="rounded-xl bg-emerald-600 px-6 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition"
            >
              Play Again
            </button>
            <button
              onClick={() => setDifficulty(null)}
              className="rounded-xl bg-slate-700 px-6 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition"
            >
              Change Difficulty
            </button>
          </div>
        </div>
      )}

      <div
        className="grid gap-2 max-w-md mx-auto"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {cards.map((card, i) => {
          const isFlipped = flipped.includes(i) || matched.has(i);
          const isMatched = matched.has(i);
          return (
            <button
              key={card.id}
              onClick={() => handleFlip(i)}
              className={`aspect-square rounded-xl text-2xl font-bold transition-all duration-300 ${
                isMatched
                  ? "bg-emerald-900/40 border border-emerald-700/50 scale-95"
                  : isFlipped
                    ? "bg-slate-700 border border-cyan-700/50 scale-105"
                    : "bg-slate-800 border border-slate-700/50 hover:border-slate-600 hover:bg-slate-750"
              }`}
            >
              {isFlipped ? card.icon : "?"}
            </button>
          );
        })}
      </div>
    </div>
  );
}
