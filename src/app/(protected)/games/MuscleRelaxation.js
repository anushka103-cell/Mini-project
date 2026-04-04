"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const MUSCLE_GROUPS = [
  {
    name: "Hands & Fists",
    instruction:
      "Clench both fists tightly. Feel the tension in your hands and forearms.",
    icon: "✊",
  },
  {
    name: "Arms & Biceps",
    instruction: "Bend your arms and flex your biceps as hard as you can.",
    icon: "💪",
  },
  {
    name: "Shoulders",
    instruction:
      "Raise your shoulders up to your ears. Hold them high and tight.",
    icon: "🤷",
  },
  {
    name: "Face & Jaw",
    instruction:
      "Scrunch up your face. Clench your jaw, squint your eyes, wrinkle your nose.",
    icon: "😤",
  },
  {
    name: "Chest & Back",
    instruction:
      "Take a deep breath and hold it. Squeeze your shoulder blades together.",
    icon: "🫁",
  },
  {
    name: "Stomach",
    instruction: "Tighten your abdominal muscles as if bracing for a punch.",
    icon: "🏋️",
  },
  {
    name: "Legs & Feet",
    instruction:
      "Press your feet flat and tense your legs. Curl your toes downward.",
    icon: "🦶",
  },
];

const PHASES = {
  IDLE: "idle",
  TENSE: "tense",
  RELEASE: "release",
  REST: "rest",
  DONE: "done",
};

export default function MuscleRelaxation({ onBack }) {
  const [groupIdx, setGroupIdx] = useState(0);
  const [phase, setPhase] = useState(PHASES.IDLE);
  const [countdown, setCountdown] = useState(0);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

  const TENSE_TIME = 7;
  const RELEASE_TIME = 3;
  const REST_TIME = 5;

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startCountdown = useCallback((seconds, onDone) => {
    clearTimer();
    let remaining = seconds;
    setCountdown(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearTimer();
        onDone();
      }
    }, 1000);
  }, []);

  const startTense = useCallback(() => {
    setPhase(PHASES.TENSE);
    startCountdown(TENSE_TIME, () => {
      setPhase(PHASES.RELEASE);
      startCountdown(RELEASE_TIME, () => {
        setPhase(PHASES.REST);
        startCountdown(REST_TIME, () => {
          setGroupIdx((prev) => {
            if (prev + 1 >= MUSCLE_GROUPS.length) {
              setPhase(PHASES.DONE);
              setRunning(false);
              return prev;
            }
            return prev + 1;
          });
        });
      });
    });
  }, [startCountdown]);

  useEffect(() => {
    if (running && phase === PHASES.REST && countdown <= 0) {
      // When rest ends and we've moved to next group, start tense
    }
  }, [groupIdx, running, phase, countdown]);

  // When groupIdx changes and we're running, auto-start tense
  useEffect(() => {
    if (running && phase !== PHASES.DONE) {
      startTense();
    }
  }, [groupIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = () => {
    setRunning(true);
    setGroupIdx(0);
    setPhase(PHASES.TENSE);
    startCountdown(TENSE_TIME, () => {
      setPhase(PHASES.RELEASE);
      startCountdown(RELEASE_TIME, () => {
        setPhase(PHASES.REST);
        startCountdown(REST_TIME, () => {
          setGroupIdx(1);
        });
      });
    });
  };

  const stop = () => {
    clearTimer();
    setRunning(false);
    setPhase(PHASES.IDLE);
    setGroupIdx(0);
  };

  useEffect(() => () => clearTimer(), []);

  const group = MUSCLE_GROUPS[groupIdx];
  const phaseLabel =
    phase === PHASES.TENSE
      ? "TENSE — hold the tension"
      : phase === PHASES.RELEASE
        ? "RELEASE — let it all go"
        : phase === PHASES.REST
          ? "REST — feel the difference"
          : phase === PHASES.DONE
            ? "All done!"
            : "Ready to begin";

  const phaseColor =
    phase === PHASES.TENSE
      ? "#ef4444"
      : phase === PHASES.RELEASE
        ? "#22c55e"
        : phase === PHASES.REST
          ? "#06b6d4"
          : "#64748b";

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>

      <h2 className="mb-2 text-2xl font-bold text-slate-100">
        🧘 Progressive Muscle Relaxation
      </h2>
      <p className="text-sm text-slate-400 mb-6">
        Tense each muscle group for 7 seconds, then release and rest.
      </p>

      {/* Progress bar */}
      <div className="flex gap-1 justify-center mb-6">
        {MUSCLE_GROUPS.map((_, i) => (
          <div
            key={i}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: 40,
              backgroundColor:
                i < groupIdx
                  ? "#22c55e"
                  : i === groupIdx && running
                    ? phaseColor
                    : "#334155",
            }}
          />
        ))}
      </div>

      {/* Main Display */}
      <div className="max-w-md mx-auto rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 mb-6">
        <span className="text-5xl block mb-4">{group.icon}</span>
        <h3 className="text-xl font-bold text-slate-100 mb-2">
          {group.name}{" "}
          <span className="text-sm text-slate-500 font-normal">
            ({groupIdx + 1}/{MUSCLE_GROUPS.length})
          </span>
        </h3>

        {running && phase !== PHASES.DONE && (
          <>
            <p className="text-sm mb-3" style={{ color: phaseColor }}>
              {phaseLabel}
            </p>
            {phase === PHASES.TENSE && (
              <p className="text-slate-400 text-sm mb-4">{group.instruction}</p>
            )}
            {phase === PHASES.RELEASE && (
              <p className="text-slate-400 text-sm mb-4">
                Slowly release the tension. Notice how your muscles feel as they
                relax.
              </p>
            )}
            {phase === PHASES.REST && (
              <p className="text-slate-400 text-sm mb-4">
                Breathe naturally. Notice the difference between tension and
                relaxation.
              </p>
            )}
            <p
              className="text-5xl font-mono font-bold"
              style={{ color: phaseColor }}
            >
              {countdown}
            </p>
          </>
        )}

        {phase === PHASES.DONE && (
          <div className="mt-4">
            <p className="text-emerald-400 text-lg font-semibold mb-2">
              Session Complete! 🎉
            </p>
            <p className="text-slate-400 text-sm">
              Your body should feel noticeably more relaxed. Take a moment to
              enjoy this feeling.
            </p>
          </div>
        )}

        {!running && phase !== PHASES.DONE && (
          <p className="text-slate-400 text-sm">{group.instruction}</p>
        )}
      </div>

      {/* Controls */}
      {phase !== PHASES.DONE ? (
        <button
          onClick={running ? stop : begin}
          className={`rounded-xl px-8 py-3 text-sm font-bold transition ${
            running
              ? "bg-red-600 hover:bg-red-500"
              : "bg-cyan-600 hover:bg-cyan-500"
          } text-white`}
        >
          {running ? "Stop" : "Begin Session"}
        </button>
      ) : (
        <button
          onClick={() => {
            setPhase(PHASES.IDLE);
            setGroupIdx(0);
          }}
          className="rounded-xl px-8 py-3 text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition"
        >
          Start Again
        </button>
      )}
    </div>
  );
}
