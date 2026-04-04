"use client";
import { useState, useEffect, useRef, useCallback } from "react";

const COLORS_LIST = [
  { name: "Red", color: "#ef4444", text: "text-red-500" },
  { name: "Blue", color: "#3b82f6", text: "text-blue-500" },
  { name: "Green", color: "#22c55e", text: "text-green-500" },
  { name: "Yellow", color: "#eab308", text: "text-yellow-500" },
  { name: "Purple", color: "#a855f7", text: "text-purple-500" },
  { name: "Orange", color: "#f97316", text: "text-orange-500" },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateRound(level) {
  const count = Math.min(3 + Math.floor(level / 3), 6);
  const word = COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)];
  let ink;
  do {
    ink = COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)];
  } while (ink.name === word.name);

  // Generate options: correct answer (ink color) + distractors
  const optionSet = new Set([ink.name]);
  while (optionSet.size < count) {
    optionSet.add(
      COLORS_LIST[Math.floor(Math.random() * COLORS_LIST.length)].name,
    );
  }

  return {
    word: word.name,
    inkColor: ink.color,
    correctAnswer: ink.name,
    options: shuffle([...optionSet]),
  };
}

export default function ColorMatch({ onBack }) {
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedback, setFeedback] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("mindsafe_colormatch_high");
    if (saved) setHighScore(parseInt(saved));
  }, []);

  const startGame = () => {
    setPlaying(true);
    setGameOver(false);
    setScore(0);
    setStreak(0);
    setLives(3);
    setLevel(1);
    setTimeLeft(30);
    setRound(generateRound(1));
    setFeedback(null);

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setGameOver(true);
          setPlaying(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const endGame = useCallback(() => {
    clearInterval(timerRef.current);
    setGameOver(true);
    setPlaying(false);
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem("mindsafe_colormatch_high", score.toString());
    }
  }, [score, highScore]);

  useEffect(() => {
    if (lives <= 0) endGame();
  }, [lives, endGame]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const handleAnswer = (answer) => {
    if (!round) return;
    if (answer === round.correctAnswer) {
      const points = 10 + streak * 2;
      setScore((s) => s + points);
      setStreak((s) => s + 1);
      setFeedback({ correct: true, points });
      const newLevel = Math.floor((score + points) / 50) + 1;
      setLevel(newLevel);
      // Bonus time
      setTimeLeft((t) => Math.min(t + 2, 60));
    } else {
      setLives((l) => l - 1);
      setStreak(0);
      setFeedback({ correct: false });
    }
    setTimeout(() => {
      setFeedback(null);
      setRound(generateRound(level));
    }, 400);
  };

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>

      <h2 className="mb-2 text-2xl font-bold text-slate-100">🎨 Color Match</h2>
      <p className="text-sm text-slate-400 mb-6">
        Tap the <strong>ink color</strong> of the word, not what it says!
      </p>

      {!playing && !gameOver && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8">
          <p className="text-slate-300 mb-4">
            A Stroop-effect game that trains focus and attention. The word says
            one color but is displayed in another — pick the <em>ink color</em>.
          </p>
          <p className="text-sm text-slate-500 mb-2">High Score: {highScore}</p>
          <button
            onClick={startGame}
            className="rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white hover:bg-cyan-500 transition"
          >
            Start Game
          </button>
        </div>
      )}

      {playing && round && (
        <>
          {/* HUD */}
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-100">{score}</p>
              <p className="text-xs text-slate-500">Score</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-slate-100">{streak}🔥</p>
              <p className="text-xs text-slate-500">Streak</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-slate-100">
                {"❤️".repeat(lives)}
              </p>
              <p className="text-xs text-slate-500">Lives</p>
            </div>
            <div className="text-center">
              <p
                className={`text-xl font-bold ${timeLeft <= 10 ? "text-red-400" : "text-slate-100"}`}
              >
                {timeLeft}s
              </p>
              <p className="text-xs text-slate-500">Time</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-slate-100">Lv{level}</p>
              <p className="text-xs text-slate-500">Level</p>
            </div>
          </div>

          {/* Word Display */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 mb-6 max-w-md mx-auto">
            <p
              className="text-5xl font-extrabold select-none"
              style={{ color: round.inkColor }}
            >
              {round.word}
            </p>
            <p className="text-xs text-slate-600 mt-2">
              What color is this text?
            </p>
          </div>

          {/* Feedback flash */}
          {feedback && (
            <p
              className={`text-sm font-bold mb-2 ${feedback.correct ? "text-emerald-400" : "text-red-400"}`}
            >
              {feedback.correct ? `+${feedback.points}!` : "Wrong!"}
            </p>
          )}

          {/* Options */}
          <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
            {round.options.map((opt) => {
              const c = COLORS_LIST.find((cl) => cl.name === opt);
              return (
                <button
                  key={opt}
                  onClick={() => handleAnswer(opt)}
                  className="rounded-xl py-3 text-sm font-bold text-white transition hover:scale-105 active:scale-95"
                  style={{ backgroundColor: c?.color || "#475569" }}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}

      {gameOver && (
        <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8 max-w-md mx-auto">
          <h3 className="text-xl font-bold text-slate-100 mb-2">Game Over!</h3>
          <p className="text-3xl font-bold text-cyan-400 mb-1">{score}</p>
          <p className="text-sm text-slate-400 mb-1">Level reached: {level}</p>
          {score >= highScore && score > 0 && (
            <p className="text-emerald-400 text-sm font-medium mb-3">
              🏆 New High Score!
            </p>
          )}
          <p className="text-xs text-slate-500 mb-4">Best: {highScore}</p>
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
