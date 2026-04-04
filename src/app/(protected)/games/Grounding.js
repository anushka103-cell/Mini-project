"use client";
import { useState } from "react";

const SENSES = [
  {
    sense: "SEE",
    count: 5,
    emoji: "👁️",
    color: "#06b6d4",
    prompt: "Look around you. Name 5 things you can see.",
  },
  {
    sense: "HEAR",
    count: 4,
    emoji: "👂",
    color: "#8b5cf6",
    prompt: "Be still and listen. Name 4 things you can hear.",
  },
  {
    sense: "TOUCH",
    count: 3,
    emoji: "✋",
    color: "#22c55e",
    prompt: "Reach out. Name 3 things you can physically feel.",
  },
  {
    sense: "SMELL",
    count: 2,
    emoji: "👃",
    color: "#f59e0b",
    prompt: "Breathe in. Name 2 things you can smell.",
  },
  {
    sense: "TASTE",
    count: 1,
    emoji: "👅",
    color: "#ef4444",
    prompt: "Focus on your mouth. Name 1 thing you can taste.",
  },
];

export default function Grounding({ onBack }) {
  const [senseIdx, setSenseIdx] = useState(0);
  const [inputs, setInputs] = useState(
    SENSES.map((s) => Array(s.count).fill("")),
  );
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  const current = SENSES[senseIdx];
  const currentInputs = inputs[senseIdx];
  const filledCount = currentInputs.filter((v) => v.trim()).length;
  const canProceed = filledCount >= current.count;

  const updateInput = (i, value) => {
    const copy = inputs.map((arr) => [...arr]);
    copy[senseIdx][i] = value;
    setInputs(copy);
  };

  const next = () => {
    if (senseIdx + 1 >= SENSES.length) {
      setDone(true);
    } else {
      setSenseIdx(senseIdx + 1);
    }
  };

  const restart = () => {
    setSenseIdx(0);
    setInputs(SENSES.map((s) => Array(s.count).fill("")));
    setStarted(false);
    setDone(false);
  };

  return (
    <div className="text-center max-w-lg mx-auto">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>

      <h2 className="mb-2 text-2xl font-bold text-slate-100">
        🌍 5-4-3-2-1 Grounding
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        An evidence-based technique to ground yourself when feeling anxious.
      </p>

      {!started && !done && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8">
          <p className="text-slate-300 mb-4">
            This exercise uses your five senses to bring you back to the present
            moment. It works by shifting your focus from anxious thoughts to
            your immediate surroundings.
          </p>
          <div className="flex justify-center gap-3 mb-6">
            {SENSES.map((s, i) => (
              <div key={i} className="text-center">
                <span className="text-2xl">{s.emoji}</span>
                <p className="text-xs text-slate-500 mt-1">{s.count}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setStarted(true)}
            className="rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition"
          >
            Begin Grounding
          </button>
        </div>
      )}

      {started && !done && (
        <>
          {/* Progress */}
          <div className="flex gap-2 justify-center mb-6">
            {SENSES.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-center w-10 h-10 rounded-full text-lg transition-all duration-300"
                style={{
                  backgroundColor:
                    i < senseIdx
                      ? s.color + "30"
                      : i === senseIdx
                        ? s.color + "40"
                        : "#1e293b",
                  border:
                    i === senseIdx
                      ? `2px solid ${s.color}`
                      : "2px solid transparent",
                  transform: i === senseIdx ? "scale(1.2)" : "scale(1)",
                }}
              >
                {s.emoji}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 text-left">
            <div className="text-center mb-4">
              <span className="text-4xl">{current.emoji}</span>
              <h3
                className="text-lg font-bold mt-2"
                style={{ color: current.color }}
              >
                {current.sense}: Name {current.count}
              </h3>
              <p className="text-sm text-slate-400 mt-1">{current.prompt}</p>
            </div>

            <div className="space-y-3">
              {currentInputs.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  value={val}
                  onChange={(e) => updateInput(i, e.target.value)}
                  placeholder={`${current.sense.toLowerCase()} #${i + 1}...`}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-cyan-500"
                  autoFocus={i === 0}
                />
              ))}
            </div>

            <button
              onClick={next}
              disabled={!canProceed}
              className="mt-4 w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canProceed ? current.color : "#475569",
              }}
            >
              {senseIdx + 1 >= SENSES.length
                ? "Complete Exercise"
                : "Next Sense →"}
            </button>
          </div>
        </>
      )}

      {done && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8">
          <span className="text-5xl block mb-4">✨</span>
          <h3 className="text-xl font-bold text-emerald-300 mb-2">
            You&apos;re Grounded
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            Great job! You&apos;ve reconnected with the present moment through
            all five senses. Notice how you feel right now compared to when you
            started.
          </p>
          <div className="grid gap-2 text-left max-w-sm mx-auto mb-6">
            {SENSES.map((s, si) => (
              <div key={si} className="rounded-lg bg-slate-800/60 px-3 py-2">
                <span className="text-sm">
                  {s.emoji} {s.sense}:{" "}
                </span>
                <span className="text-xs text-slate-400">
                  {inputs[si].filter(Boolean).join(", ")}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={restart}
            className="rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition"
          >
            Do It Again
          </button>
        </div>
      )}
    </div>
  );
}
