"use client";
import { useState, useEffect, useRef, useCallback } from "react";

function randomPos(areaW, areaH, size) {
  return {
    x: Math.random() * (areaW - size),
    y: Math.random() * (areaH - size),
  };
}

export default function FocusTap({ onBack }) {
  const [playing, setPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targetSize, setTargetSize] = useState(60);
  const [target, setTarget] = useState(null);
  const [missed, setMissed] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [ripples, setRipples] = useState([]);
  const [duration, setDuration] = useState(30);
  const areaRef = useRef(null);
  const timerRef = useRef(null);
  const targetTimerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("mindsafe_focustrap_high");
    if (saved) setHighScore(parseInt(saved));
  }, []);

  const spawnTarget = useCallback(() => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const size = Math.max(20, 60 - score * 0.8);
    setTargetSize(size);
    setTarget(randomPos(rect.width, rect.height, size));

    clearTimeout(targetTimerRef.current);
    const timeout = Math.max(1200, 2500 - score * 30);
    targetTimerRef.current = setTimeout(() => {
      setMissed((m) => m + 1);
      setCombo(0);
      spawnTarget();
    }, timeout);
  }, [score]);

  const startGame = () => {
    setPlaying(true);
    setGameOver(false);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setMissed(0);
    setTimeLeft(duration);
    setRipples([]);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          clearTimeout(targetTimerRef.current);
          setPlaying(false);
          setGameOver(true);
          setTarget(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    setTimeout(() => spawnTarget(), 300);
  };

  useEffect(() => {
    if (gameOver && score > highScore) {
      setHighScore(score);
      localStorage.setItem("mindsafe_focustrap_high", score.toString());
    }
  }, [gameOver, score, highScore]);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      clearTimeout(targetTimerRef.current);
    },
    [],
  );

  const handleTap = (e) => {
    e.stopPropagation();
    clearTimeout(targetTimerRef.current);
    const newCombo = combo + 1;
    const points = 1 + Math.floor(newCombo / 3);
    setScore((s) => s + points);
    setCombo(newCombo);
    setMaxCombo((m) => Math.max(m, newCombo));

    const rect = areaRef.current.getBoundingClientRect();
    const rx = e.clientX - rect.left;
    const ry = e.clientY - rect.top;
    const id = Date.now();
    setRipples((r) => [...r, { id, x: rx, y: ry, points }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 600);

    spawnTarget();
  };

  const accuracy =
    score + missed > 0 ? Math.round((score / (score + missed)) * 100) : 0;

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>
      <h2 className="mb-2 text-2xl font-bold text-slate-100">🎯 Focus Tap</h2>
      <p className="text-sm text-slate-400 mb-4">
        Tap targets before they vanish. Targets shrink as you score!
      </p>

      {!playing && !gameOver && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 max-w-md mx-auto">
          <p className="text-slate-300 mb-4">
            Train your focus and reaction time. Build combos for bonus points!
          </p>
          <div className="flex justify-center gap-3 mb-4">
            {[15, 30, 60].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  duration === d
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mb-4">High Score: {highScore}</p>
          <button
            onClick={startGame}
            className="rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition"
          >
            Start
          </button>
        </div>
      )}

      {playing && (
        <>
          <div className="flex justify-center gap-6 mb-4">
            <div>
              <p className="text-xl font-bold text-slate-100">{score}</p>
              <p className="text-xs text-slate-500">Score</p>
            </div>
            <div>
              <p className="text-xl font-bold text-orange-400">{combo}🔥</p>
              <p className="text-xs text-slate-500">Combo</p>
            </div>
            <div>
              <p
                className={`text-xl font-bold ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-slate-100"}`}
              >
                {timeLeft}s
              </p>
              <p className="text-xs text-slate-500">Time</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-100">{accuracy}%</p>
              <p className="text-xs text-slate-500">Accuracy</p>
            </div>
          </div>

          <div
            ref={areaRef}
            className="relative mx-auto w-full max-w-lg h-80 rounded-2xl border border-slate-700/50 bg-slate-950 overflow-hidden cursor-crosshair"
          >
            {target && (
              <div
                onClick={handleTap}
                className="absolute rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/30 transition-all duration-200 hover:scale-110 active:scale-90 cursor-pointer"
                style={{
                  left: target.x,
                  top: target.y,
                  width: targetSize,
                  height: targetSize,
                }}
              />
            )}
            {ripples.map((r) => (
              <div
                key={r.id}
                className="absolute pointer-events-none text-xs font-bold text-cyan-300 animate-ping"
                style={{ left: r.x - 10, top: r.y - 20 }}
              >
                +{r.points}
              </div>
            ))}
          </div>
        </>
      )}

      {gameOver && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-slate-100 mb-3">
            Round Complete!
          </h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-cyan-400">{score}</p>
              <p className="text-xs text-slate-500">Score</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-orange-400">{maxCombo}</p>
              <p className="text-xs text-slate-500">Best Combo</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-emerald-400">{accuracy}%</p>
              <p className="text-xs text-slate-500">Accuracy</p>
            </div>
            <div className="rounded-xl bg-slate-800 p-3">
              <p className="text-2xl font-bold text-slate-300">{missed}</p>
              <p className="text-xs text-slate-500">Missed</p>
            </div>
          </div>
          {score >= highScore && score > 0 && (
            <p className="text-emerald-400 text-sm font-medium mb-3">
              🏆 New High Score!
            </p>
          )}
          <button
            onClick={startGame}
            className="rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}
