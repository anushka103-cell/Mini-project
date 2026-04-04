"use client";
import { useState, useEffect, useCallback, useRef } from "react";

const SIZES = {
  Easy: 7,
  Medium: 11,
  Hard: 15,
};

function generateMaze(size) {
  // Initialize grid: all walls
  const grid = Array.from({ length: size }, () => Array(size).fill(1));

  // Recursive backtracker
  const stack = [[1, 1]];
  grid[1][1] = 0;

  const dirs = [
    [0, -2],
    [0, 2],
    [-2, 0],
    [2, 0],
  ];

  while (stack.length > 0) {
    const [cx, cy] = stack[stack.length - 1];
    const neighbors = dirs
      .map(([dx, dy]) => [cx + dx, cy + dy])
      .filter(
        ([nx, ny]) =>
          nx > 0 &&
          ny > 0 &&
          nx < size - 1 &&
          ny < size - 1 &&
          grid[ny][nx] === 1,
      );

    if (neighbors.length === 0) {
      stack.pop();
      continue;
    }

    const [nx, ny] = neighbors[Math.floor(Math.random() * neighbors.length)];
    grid[(cy + ny) / 2][(cx + nx) / 2] = 0;
    grid[ny][nx] = 0;
    stack.push([nx, ny]);
  }

  return grid;
}

export default function MindfulMaze({ onBack }) {
  const [difficulty, setDifficulty] = useState(null);
  const [maze, setMaze] = useState(null);
  const [pos, setPos] = useState({ x: 1, y: 1 });
  const [end, setEnd] = useState({ x: 1, y: 1 });
  const [moves, setMoves] = useState(0);
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [trail, setTrail] = useState(new Set());
  const timerRef = useRef(null);
  const touchRef = useRef(null);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  const startGame = (diff) => {
    const size = SIZES[diff];
    const g = generateMaze(size);
    setDifficulty(diff);
    setMaze(g);
    setPos({ x: 1, y: 1 });
    setEnd({ x: size - 2, y: size - 2 });
    setMoves(0);
    setTimer(0);
    setRunning(true);
    setWon(false);
    setTrail(new Set(["1,1"]));
  };

  const move = useCallback(
    (dx, dy) => {
      if (!running || !maze) return;
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (nx < 0 || ny < 0 || ny >= maze.length || nx >= maze[0].length) return;
      if (maze[ny][nx] === 1) return;
      const newPos = { x: nx, y: ny };
      setPos(newPos);
      setMoves((m) => m + 1);
      setTrail((prev) => new Set(prev).add(`${nx},${ny}`));
      if (nx === end.x && ny === end.y) {
        setRunning(false);
        setWon(true);
        clearInterval(timerRef.current);
      }
    },
    [running, maze, pos, end],
  );

  useEffect(() => {
    const handler = (e) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          move(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          move(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          move(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          move(1, 0);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move]);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchRef.current.x;
    const dy = t.clientY - touchRef.current.y;
    const threshold = 30;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > threshold) move(dx > 0 ? 1 : -1, 0);
    } else {
      if (Math.abs(dy) > threshold) move(0, dy > 0 ? 1 : -1);
    }
    touchRef.current = null;
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
          🌀 Mindful Maze
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Navigate the maze with arrow keys or swipe. Focus on the journey.
        </p>

        <div className="grid gap-4 max-w-sm mx-auto">
          {Object.entries(SIZES).map(([diff, size]) => (
            <button
              key={diff}
              onClick={() => startGame(diff)}
              className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 transition hover:border-cyan-800/50 hover:bg-slate-800/70"
            >
              <p className="text-lg font-bold text-slate-100">{diff}</p>
              <p className="text-xs text-slate-500">
                {size}×{size} grid
              </p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const cellSize = Math.min(Math.floor(400 / maze[0].length), 32);

  return (
    <div
      className="text-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        onClick={onBack}
        className="mb-4 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>
      <h2 className="mb-2 text-xl font-bold text-slate-100">
        🌀 Mindful Maze — {difficulty}
      </h2>

      <div className="flex justify-center gap-6 mb-4">
        <div>
          <p className="text-lg font-bold text-slate-100">{moves}</p>
          <p className="text-xs text-slate-500">Steps</p>
        </div>
        <div>
          <p className="text-lg font-bold text-slate-100">
            {formatTime(timer)}
          </p>
          <p className="text-xs text-slate-500">Time</p>
        </div>
      </div>

      {won && (
        <div className="rounded-2xl border border-emerald-700/50 bg-emerald-900/20 p-5 mb-4 max-w-sm mx-auto">
          <h3 className="text-lg font-bold text-emerald-300 mb-1">
            🎉 Maze Complete!
          </h3>
          <p className="text-sm text-slate-300">
            {moves} steps in {formatTime(timer)}
          </p>
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={() => startGame(difficulty)}
              className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500 transition"
            >
              New Maze
            </button>
            <button
              onClick={() => setDifficulty(null)}
              className="rounded-xl bg-slate-700 px-5 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition"
            >
              Change Difficulty
            </button>
          </div>
        </div>
      )}

      {/* Maze Grid */}
      <div className="flex justify-center mb-4">
        <div
          className="inline-grid gap-0 rounded-xl overflow-hidden border border-slate-700/50"
          style={{
            gridTemplateColumns: `repeat(${maze[0].length}, ${cellSize}px)`,
          }}
        >
          {maze.map((row, y) =>
            row.map((cell, x) => {
              const isPlayer = pos.x === x && pos.y === y;
              const isEnd = end.x === x && end.y === y;
              const isTrail = trail.has(`${x},${y}`);
              let bg = cell === 1 ? "bg-slate-800" : "bg-slate-950";
              if (isTrail && !isPlayer) bg = "bg-cyan-900/30";
              if (isEnd && !isPlayer) bg = "bg-emerald-900/50";
              if (isPlayer) bg = "bg-cyan-500";

              return (
                <div
                  key={`${x}-${y}`}
                  className={`${bg} transition-colors duration-150`}
                  style={{ width: cellSize, height: cellSize }}
                >
                  {isPlayer && <span className="text-xs leading-none">😊</span>}
                  {isEnd && !isPlayer && (
                    <span className="text-xs leading-none">🏁</span>
                  )}
                </div>
              );
            }),
          )}
        </div>
      </div>

      {/* Mobile controls */}
      <div className="flex justify-center mb-2">
        <button
          onClick={() => move(0, -1)}
          className="rounded-lg bg-slate-800 w-12 h-12 text-lg hover:bg-slate-700 transition"
        >
          ↑
        </button>
      </div>
      <div className="flex justify-center gap-2 mb-2">
        <button
          onClick={() => move(-1, 0)}
          className="rounded-lg bg-slate-800 w-12 h-12 text-lg hover:bg-slate-700 transition"
        >
          ←
        </button>
        <button
          onClick={() => move(1, 0)}
          className="rounded-lg bg-slate-800 w-12 h-12 text-lg hover:bg-slate-700 transition"
        >
          →
        </button>
      </div>
      <div className="flex justify-center">
        <button
          onClick={() => move(0, 1)}
          className="rounded-lg bg-slate-800 w-12 h-12 text-lg hover:bg-slate-700 transition"
        >
          ↓
        </button>
      </div>
      <p className="text-xs text-slate-600 mt-2">
        Arrow keys · WASD · Swipe · Tap buttons
      </p>
    </div>
  );
}
