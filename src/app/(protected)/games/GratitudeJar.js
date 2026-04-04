"use client";
import { useState, useEffect, useRef } from "react";

const JAR_COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
];

export default function GratitudeJar({ onBack }) {
  const [entries, setEntries] = useState([]);
  const [input, setInput] = useState("");
  const [dropping, setDropping] = useState(false);
  const [viewMode, setViewMode] = useState("add"); // add | view
  const [selectedEntry, setSelectedEntry] = useState(null);
  const jarRef = useRef(null);

  useEffect(() => {
    const saved = localStorage.getItem("mindsafe_gratitude_jar");
    if (saved) setEntries(JSON.parse(saved));
  }, []);

  const saveEntries = (list) => {
    setEntries(list);
    localStorage.setItem("mindsafe_gratitude_jar", JSON.stringify(list));
  };

  const addEntry = () => {
    const text = input.trim();
    if (!text) return;
    setDropping(true);

    setTimeout(() => {
      const entry = {
        id: Date.now(),
        text,
        date: new Date().toLocaleDateString(),
        color: JAR_COLORS[Math.floor(Math.random() * JAR_COLORS.length)],
      };
      saveEntries([entry, ...entries]);
      setInput("");
      setDropping(false);
    }, 800);
  };

  const deleteEntry = (id) => {
    saveEntries(entries.filter((e) => e.id !== id));
    setSelectedEntry(null);
  };

  const randomEntry = () => {
    if (entries.length === 0) return;
    setSelectedEntry(entries[Math.floor(Math.random() * entries.length)]);
  };

  const fillLevel = Math.min(entries.length * 5, 100);

  return (
    <div className="text-center">
      <button
        onClick={onBack}
        className="mb-6 rounded-xl bg-slate-800 px-4 py-2 text-sm transition hover:bg-slate-700"
      >
        ← Back
      </button>
      <h2 className="mb-2 text-2xl font-bold text-slate-100">
        🫙 Gratitude Jar
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Write what you&apos;re grateful for. Fill your jar with positivity.
      </p>

      {/* Tab toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => {
            setViewMode("add");
            setSelectedEntry(null);
          }}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${viewMode === "add" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          ✍️ Add
        </button>
        <button
          onClick={() => setViewMode("view")}
          className={`rounded-xl px-5 py-2 text-sm font-medium transition ${viewMode === "view" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          📜 View ({entries.length})
        </button>
      </div>

      {viewMode === "add" && (
        <div className="max-w-md mx-auto">
          {/* Jar visualization */}
          <div ref={jarRef} className="relative w-40 h-52 mx-auto mb-6">
            {/* Jar outline */}
            <div className="absolute inset-0 rounded-b-3xl rounded-t-lg border-2 border-slate-600 bg-slate-900/30 overflow-hidden">
              {/* Fill level */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out rounded-b-3xl"
                style={{
                  height: `${fillLevel}%`,
                  background: `linear-gradient(180deg, rgba(6,182,212,0.3) 0%, rgba(139,92,246,0.4) 100%)`,
                }}
              />
              {/* Floating notes */}
              {entries.slice(0, 8).map((e, i) => (
                <div
                  key={e.id}
                  className="absolute w-3 h-3 rounded-full opacity-70"
                  style={{
                    backgroundColor: e.color,
                    bottom: `${10 + ((i * 10) % 70)}%`,
                    left: `${15 + ((i * 17) % 65)}%`,
                  }}
                />
              ))}
            </div>
            {/* Jar lid */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-24 h-5 rounded-lg bg-slate-700 border border-slate-600" />

            {/* Drop animation */}
            {dropping && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-400 animate-bounce" />
            )}
          </div>

          <p className="text-xs text-slate-500 mb-4">
            {entries.length} notes in your jar
          </p>

          {/* Input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value.slice(0, 200))}
            placeholder="I'm grateful for..."
            maxLength={200}
            rows={3}
            className="w-full rounded-xl bg-slate-800 border border-slate-700 p-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-700 resize-none mb-2"
          />
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-slate-600">{input.length}/200</span>
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={addEntry}
              disabled={!input.trim() || dropping}
              className="rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {dropping ? "Adding..." : "Drop in Jar ✨"}
            </button>
            {entries.length > 0 && (
              <button
                onClick={randomEntry}
                className="rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-purple-500"
              >
                🎲 Random
              </button>
            )}
          </div>

          {/* Random entry popup */}
          {selectedEntry && (
            <div
              className="mt-6 rounded-2xl border p-5 max-w-sm mx-auto"
              style={{
                borderColor: selectedEntry.color + "50",
                backgroundColor: selectedEntry.color + "10",
              }}
            >
              <p className="text-slate-200 text-sm mb-2">
                &ldquo;{selectedEntry.text}&rdquo;
              </p>
              <p className="text-xs text-slate-500">{selectedEntry.date}</p>
            </div>
          )}
        </div>
      )}

      {viewMode === "view" && (
        <div className="max-w-md mx-auto">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-8">
              <p className="text-slate-400">
                Your jar is empty. Start adding gratitude notes!
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border bg-slate-900/70 p-4 text-left transition hover:bg-slate-800/70"
                  style={{ borderColor: entry.color + "40" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div
                        className="w-2 h-2 rounded-full inline-block mr-2"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm text-slate-200">
                        {entry.text}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-xs text-slate-600 hover:text-red-400 transition shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 ml-4">
                    {entry.date}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
