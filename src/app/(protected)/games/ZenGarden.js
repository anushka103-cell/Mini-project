"use client";
import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = [
  { name: "Sand", value: "#c2b280" },
  { name: "Stone", value: "#8b8680" },
  { name: "Water", value: "#5b9bd5" },
  { name: "Moss", value: "#7db07e" },
  { name: "Eraser", value: null },
];

export default function ZenGarden({ onBack }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(4);
  const [color, setColor] = useState(COLORS[0].value);
  const lastPos = useRef(null);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Sand background
    ctx.fillStyle = "#d4c5a0";
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Subtle sand texture
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * rect.width;
      const y = Math.random() * rect.height;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`;
      ctx.fillRect(x, y, 1, 1);
    }

    // Pre-placed stones
    const stones = [
      { x: rect.width * 0.25, y: rect.height * 0.35, r: 18 },
      { x: rect.width * 0.7, y: rect.height * 0.6, r: 14 },
      { x: rect.width * 0.5, y: rect.height * 0.2, r: 10 },
    ];
    stones.forEach((s) => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "#8b8680";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(s.x - s.r * 0.2, s.y - s.r * 0.2, s.r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fill();
    });
  }, []);

  useEffect(() => {
    initCanvas();
    const handleResize = () => initCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    setDrawing(true);
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e);
    const prev = lastPos.current;

    if (color === null) {
      // Eraser: draw sand color
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#d4c5a0";
      ctx.lineWidth = brushSize * 4;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    // Rake lines effect for sand color
    if (color === COLORS[0].value || color === null) {
      ctx.globalCompositeOperation = "source-over";
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        ctx.beginPath();
        ctx.moveTo(prev.x + i * 3, prev.y);
        ctx.lineTo(pos.x + i * 3, pos.y);
        ctx.strokeStyle = `rgba(0,0,0,${0.04})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    lastPos.current = pos;
  };

  const stopDraw = () => {
    setDrawing(false);
    lastPos.current = null;
  };

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>

      <h2 className="mb-2 text-2xl font-bold text-slate-100">🪨 Zen Garden</h2>
      <p className="text-sm text-slate-400 mb-4">
        Draw patterns in the sand. No goals, no score — just peace.
      </p>

      {/* Tools */}
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
        {COLORS.map((c) => (
          <button
            key={c.name}
            onClick={() => setColor(c.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              color === c.value ? "ring-2 ring-cyan-400" : ""
            }`}
            style={{
              backgroundColor: c.value || "#475569",
              color: c.value ? "#1e293b" : "#e2e8f0",
            }}
          >
            {c.name}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-4">
          <span className="text-xs text-slate-500">Size:</span>
          <input
            type="range"
            min="1"
            max="12"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-20 accent-cyan-500"
          />
        </div>

        <button
          onClick={initCanvas}
          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 transition"
        >
          Reset Garden
        </button>
      </div>

      {/* Canvas */}
      <div
        className="rounded-2xl border border-slate-700/50 overflow-hidden mx-auto"
        style={{ maxWidth: 640 }}
      >
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair touch-none"
          style={{ height: 400 }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Drag to rake patterns in the sand
      </p>
    </div>
  );
}
