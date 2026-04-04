"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const PATTERNS = {
  box: {
    name: "Box Breathing",
    steps: [
      { label: "Breathe In", duration: 4 },
      { label: "Hold", duration: 4 },
      { label: "Breathe Out", duration: 4 },
      { label: "Hold", duration: 4 },
    ],
  },
  relaxing: {
    name: "4-7-8 Relaxing",
    steps: [
      { label: "Breathe In", duration: 4 },
      { label: "Hold", duration: 7 },
      { label: "Breathe Out", duration: 8 },
    ],
  },
  calm: {
    name: "Calm Breath",
    steps: [
      { label: "Breathe In", duration: 5 },
      { label: "Breathe Out", duration: 5 },
    ],
  },
  energize: {
    name: "Energize",
    steps: [
      { label: "Breathe In", duration: 2 },
      { label: "Breathe Out", duration: 2 },
    ],
  },
};

export default function GuidedBreathing({ onBack }) {
  const [pattern, setPattern] = useState("box");
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [cycles, setCycles] = useState(0);
  const [targetCycles, setTargetCycles] = useState(5);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const timerRef = useRef(null);

  const steps = PATTERNS[pattern].steps;

  const stop = useCallback(() => {
    setRunning(false);
    clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!running) return;
    setStepIdx(0);
    setCountdown(steps[0].duration);
    setCycles(0);
    setTotalSeconds(0);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStepIdx((si) => {
            const next = si + 1;
            if (next >= steps.length) {
              setCycles((c) => c + 1);
              return 0;
            }
            return next;
          });
          return 0; // will be set below
        }
        return prev - 1;
      });
      setTotalSeconds((t) => t + 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [running, pattern, steps]);

  // Set countdown when stepIdx changes
  useEffect(() => {
    if (running) {
      setCountdown(steps[stepIdx].duration);
    }
  }, [stepIdx, running, steps]);

  // Auto-stop when target reached
  useEffect(() => {
    if (cycles >= targetCycles && running) stop();
  }, [cycles, targetCycles, running, stop]);

  const current = steps[stepIdx];
  const progress = running ? 1 - countdown / current.duration : 0;

  // Circle size based on step
  const isInhale = current.label.includes("In");
  const isExhale = current.label.includes("Out");
  const circleSize = running
    ? isInhale
      ? 200 + progress * 80
      : isExhale
        ? 280 - progress * 80
        : 240
    : 200;

  const circleColor = isInhale ? "#06b6d4" : isExhale ? "#8b5cf6" : "#f59e0b";

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>

      <h2 className="mb-2 text-2xl font-bold text-slate-100">
        🌬️ Guided Breathing
      </h2>

      {/* Pattern Selector */}
      {!running && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap justify-center gap-2">
            {Object.entries(PATTERNS).map(([key, val]) => (
              <button
                key={key}
                onClick={() => setPattern(key)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  pattern === key
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {val.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <label className="text-sm text-slate-400">Cycles:</label>
            <select
              value={targetCycles}
              onChange={(e) => setTargetCycles(parseInt(e.target.value))}
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm text-slate-200"
            >
              {[3, 5, 10, 15, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center gap-2 text-xs text-slate-500">
            {steps.map((s, i) => (
              <span key={i} className="rounded bg-slate-800 px-2 py-1">
                {s.label} {s.duration}s
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Breathing Circle */}
      <div
        className="flex justify-center items-center my-8"
        style={{ minHeight: 320 }}
      >
        <div
          className="rounded-full flex items-center justify-center transition-all duration-1000 ease-in-out"
          style={{
            width: circleSize,
            height: circleSize,
            backgroundColor: circleColor + "30",
            border: `3px solid ${circleColor}`,
            boxShadow: running ? `0 0 60px ${circleColor}40` : "none",
          }}
        >
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">
              {running ? current.label : "Ready"}
            </p>
            {running && (
              <p className="text-4xl font-mono text-cyan-400 mt-1">
                {countdown}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {running && (
        <div className="flex justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-100">
              {cycles}/{targetCycles}
            </p>
            <p className="text-xs text-slate-500">Cycles</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-100">
              {formatTime(totalSeconds)}
            </p>
            <p className="text-xs text-slate-500">Time</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <button
        onClick={() => (running ? stop() : setRunning(true))}
        className={`rounded-xl px-8 py-3 text-sm font-bold transition ${
          running
            ? "bg-red-600 hover:bg-red-500 text-white"
            : "bg-cyan-600 hover:bg-cyan-500 text-white"
        }`}
      >
        {running ? "Stop" : "Start Breathing"}
      </button>

      {!running && cycles > 0 && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 max-w-sm mx-auto">
          <p className="text-emerald-300 font-medium">Session Complete! 🎉</p>
          <p className="text-sm text-slate-400 mt-1">
            {cycles} cycles · {formatTime(totalSeconds)}
          </p>
        </div>
      )}
    </div>
  );
}
