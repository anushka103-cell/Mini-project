"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/authClient";
import {
  createEncryptedEnvelope,
  getEncryptionKey,
} from "@/lib/encryptionClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const API =
  process.env.NEXT_PUBLIC_API_URL || "https://mindsafe-api.onrender.com";

/* ─── constants ─── */
const MOODS = [
  {
    emoji: "😢",
    label: "Terrible",
    score: 2,
    color: "#ef4444",
    bg: "from-red-900/30",
  },
  {
    emoji: "😟",
    label: "Bad",
    score: 4,
    color: "#f97316",
    bg: "from-orange-900/30",
  },
  {
    emoji: "😐",
    label: "Okay",
    score: 5,
    color: "#eab308",
    bg: "from-yellow-900/30",
  },
  {
    emoji: "🙂",
    label: "Good",
    score: 7,
    color: "#22c55e",
    bg: "from-green-900/30",
  },
  {
    emoji: "😊",
    label: "Great",
    score: 9,
    color: "#06b6d4",
    bg: "from-cyan-900/30",
  },
];

const EMOTIONS = [
  "Happy",
  "Calm",
  "Grateful",
  "Excited",
  "Hopeful",
  "Anxious",
  "Sad",
  "Angry",
  "Stressed",
  "Lonely",
  "Tired",
  "Confused",
  "Motivated",
  "Peaceful",
  "Frustrated",
];

const ACTIVITIES = [
  "🏃 Exercise",
  "🧘 Meditation",
  "📖 Reading",
  "🎵 Music",
  "👫 Socializing",
  "🎮 Gaming",
  "🍳 Cooking",
  "🌳 Nature Walk",
  "💼 Work",
  "📱 Screen Time",
  "🎨 Creative",
  "📝 Journaling",
  "😴 Nap",
  "☕ Coffee",
  "🏋️ Gym",
  "🐕 Pet Time",
];

const TRIGGERS = [
  "Work stress",
  "Relationship",
  "Health",
  "Financial",
  "Sleep quality",
  "Weather",
  "News",
  "Family",
  "Achievement",
  "Conflict",
  "Loneliness",
  "Exercise",
];

const PROMPTS = [
  "What made you smile today?",
  "What are you grateful for right now?",
  "What's one thing you accomplished today?",
  "How did you take care of yourself today?",
  "What's weighing on your mind?",
  "What would make tomorrow better?",
  "Who made a positive impact on your day?",
  "What's something you're looking forward to?",
  "What did you learn about yourself today?",
  "What boundary did you set or need to set?",
];

const RECS = {
  low: [
    "Try a 5-minute breathing exercise — breathe in for 4, hold for 4, out for 6.",
    "Reach out to someone you trust. Connection helps more than we think.",
    "Go for a gentle walk outside, even just 10 minutes can shift your mood.",
    "Write down 3 small things that went okay today, no matter how tiny.",
  ],
  mid: [
    "Your mood is steady — try adding one new activity you enjoy this week.",
    "Consider a 10-minute mindfulness session to stay centered.",
    "Celebrate small wins! Consistency in logging is a strength.",
    "Try going to bed 30 minutes earlier tonight for better rest.",
  ],
  high: [
    "You're doing great! Share your positive energy with someone today.",
    "This is a good time to set a new challenge or goal.",
    "Write about what's working well — you can revisit this on harder days.",
    "Consider helping someone else; kindness boosts mood too.",
  ],
};

const PIE_COLORS = [
  "#06b6d4",
  "#8b5cf6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

const TABS = ["Log", "Charts", "History", "Insights"];

export default function MoodPage() {
  const router = useRouter();

  /* --- state --- */
  const [tab, setTab] = useState("Log");
  const [selectedMood, setSelectedMood] = useState(null);
  const [customScore, setCustomScore] = useState(5);
  const [selectedEmotions, setSelectedEmotions] = useState([]);
  const [selectedActivities, setSelectedActivities] = useState([]);
  const [selectedTriggers, setSelectedTriggers] = useState([]);
  const [sleepHours, setSleepHours] = useState("");
  const [exerciseMin, setExerciseMin] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");

  // data
  const [logs, setLogs] = useState([]);
  const [trends, setTrends] = useState(null);
  const [weeklyScore, setWeeklyScore] = useState(null);
  const [visualization, setVisualization] = useState(null);
  const [patterns, setPatterns] = useState(null);
  const [streaks, setStreaks] = useState(null);
  const [aiReflection, setAiReflection] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // filters (History tab)
  const [filterDays, setFilterDays] = useState(30);
  const [filterMood, setFilterMood] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editNote, setEditNote] = useState("");

  // chart range
  const [chartDays, setChartDays] = useState(30);

  /* --- journal prompt (rotating daily) --- */
  const todayPrompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  /* --- time of day auto-tag --- */
  const getTimeOfDay = () => {
    const h = new Date().getHours();
    if (h < 6) return "night";
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    if (h < 21) return "evening";
    return "night";
  };

  /* --- ambient background gradient --- */
  const ambientBg = selectedMood
    ? `bg-gradient-to-br ${selectedMood.bg} to-slate-950`
    : "bg-slate-950";

  /* --- data fetching --- */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [logsR, trendsR, weekR, vizR, patR, strR] = await Promise.all([
        fetchWithAuth(`${API}/api/moods/logs?days=90`, { method: "GET" }, API),
        fetchWithAuth(
          `${API}/api/moods/trends?days=${chartDays}`,
          { method: "GET" },
          API,
        ).catch(() => null),
        fetchWithAuth(
          `${API}/api/moods/weekly-score`,
          { method: "GET" },
          API,
        ).catch(() => null),
        fetchWithAuth(
          `${API}/api/moods/visualization?days=${chartDays}`,
          { method: "GET" },
          API,
        ).catch(() => null),
        fetchWithAuth(
          `${API}/api/moods/patterns?days=90`,
          { method: "GET" },
          API,
        ).catch(() => null),
        fetchWithAuth(`${API}/api/moods/streaks`, { method: "GET" }, API).catch(
          () => null,
        ),
      ]);

      if (logsR?.ok) setLogs(await logsR.json());
      else if (logsR?.status === 401) {
        router.replace("/login");
        return;
      }

      if (trendsR?.ok) setTrends(await trendsR.json());
      if (weekR?.ok) setWeeklyScore(await weekR.json());
      if (vizR?.ok) setVisualization(await vizR.json());
      if (patR?.ok) setPatterns(await patR.json());
      if (strR?.ok) setStreaks(await strR.json());
    } catch (e) {
      console.error("fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [router, chartDays]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* --- save mood --- */
  const handleSave = async () => {
    if (!selectedMood) {
      setError("Please select a mood");
      return;
    }
    setSaving(true);
    setError("");

    try {
      let encryptedNotes = note;
      if (note.trim()) {
        try {
          const key = await getEncryptionKey("mindsafe:mood");
          const envelope = await createEncryptedEnvelope(
            note,
            key,
            "mindsafe:mood",
          );
          encryptedNotes =
            typeof envelope === "string" ? envelope : JSON.stringify(envelope);
        } catch {
          /* fallback to plaintext */
        }
      }

      const emotionScores = {};
      selectedEmotions.forEach((e) => {
        emotionScores[e] = 1.0;
      });

      const body = {
        mood_score: customScore,
        mood_label: selectedMood.emoji + " " + selectedMood.label,
        notes: encryptedNotes || null,
        emotion_scores: Object.keys(emotionScores).length
          ? emotionScores
          : null,
        activities: selectedActivities.length ? selectedActivities : null,
        triggers: selectedTriggers.length ? selectedTriggers : null,
        sleep_hours: sleepHours !== "" ? parseFloat(sleepHours) : null,
        exercise_minutes: exerciseMin !== "" ? parseInt(exerciseMin) : null,
        time_of_day: getTimeOfDay(),
      };

      const res = await fetchWithAuth(
        `${API}/api/moods/log`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        API,
      );

      if (res.ok) {
        setSelectedMood(null);
        setCustomScore(5);
        setSelectedEmotions([]);
        setSelectedActivities([]);
        setSelectedTriggers([]);
        setSleepHours("");
        setExerciseMin("");
        setNote("");
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
        await fetchAll();
      } else if (res.status === 401) {
        router.replace("/login");
      } else {
        const err = await res.json();
        setError(err.message || "Failed to save");
      }
    } catch (e) {
      setError("Failed to save mood entry");
    } finally {
      setSaving(false);
    }
  };

  /* --- delete --- */
  const handleDelete = async (id) => {
    if (!confirm("Delete this mood entry?")) return;
    try {
      const res = await fetchWithAuth(
        `${API}/api/moods/${id}`,
        { method: "DELETE" },
        API,
      );
      if (res.ok) await fetchAll();
    } catch {}
  };

  /* --- edit --- */
  const handleEdit = async (id) => {
    try {
      const res = await fetchWithAuth(
        `${API}/api/moods/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: editNote }),
        },
        API,
      );
      if (res.ok) {
        setEditingId(null);
        setEditNote("");
        await fetchAll();
      }
    } catch {}
  };

  /* --- AI reflection --- */
  const fetchAiReflection = async () => {
    setAiLoading(true);
    try {
      const res = await fetchWithAuth(
        `${API}/api/moods/ai-reflection`,
        { method: "GET" },
        API,
      );
      if (res.ok) {
        const data = await res.json();
        setAiReflection(data.reflection);
      } else {
        setAiReflection(
          "Unable to generate reflection. Log more moods and try again.",
        );
      }
    } catch {
      setAiReflection("AI reflection service is currently unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  /* --- export CSV --- */
  const exportCSV = () => {
    if (!logs.length) return;
    const header =
      "Date,Score,Label,Activities,Triggers,Sleep,Exercise,Time,Notes\n";
    const rows = logs
      .map((l) =>
        [
          l.logged_date,
          l.mood_score,
          `"${(l.mood_label || "").replace(/"/g, '""')}"`,
          `"${(l.activities || []).join("; ")}"`,
          `"${(l.triggers || []).join("; ")}"`,
          l.sleep_hours ?? "",
          l.exercise_minutes ?? "",
          l.time_of_day ?? "",
          `"${(l.notes || "").replace(/"/g, '""')}"`,
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mood-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  /* --- crisis check: 3+ consecutive low mood days --- */
  const crisisAlert = useMemo(() => {
    if (logs.length < 3) return false;
    const recent = logs.slice(0, 3);
    return recent.every((l) => l.mood_score <= 3);
  }, [logs]);

  /* --- filtered history --- */
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (filterDays !== 999) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filterDays);
      result = result.filter((l) => new Date(l.logged_date) >= cutoff);
    }
    if (filterMood !== "all") {
      result = result.filter((l) => l.mood_score <= parseInt(filterMood));
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (l) =>
          (l.notes && l.notes.toLowerCase().includes(q)) ||
          (l.mood_label && l.mood_label.toLowerCase().includes(q)),
      );
    }
    return result;
  }, [logs, filterDays, filterMood, searchText]);

  /* --- grouped by date --- */
  const groupedLogs = useMemo(() => {
    const groups = {};
    filteredLogs.forEach((l) => {
      const d = l.logged_date;
      if (!groups[d]) groups[d] = [];
      groups[d].push(l);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredLogs]);

  /* --- recommendations --- */
  const recommendation = useMemo(() => {
    if (!logs.length) return null;
    const avg =
      logs.slice(0, 7).reduce((s, l) => s + l.mood_score, 0) /
      Math.min(logs.length, 7);
    const bucket = avg <= 4 ? "low" : avg <= 6 ? "mid" : "high";
    return RECS[bucket][Math.floor(Math.random() * RECS[bucket].length)];
  }, [logs]);

  /* --- chart data --- */
  const moodChartData = useMemo(() => {
    if (!visualization) return [];
    return visualization.labels.map((l, i) => ({
      date: l.slice(5),
      score: visualization.mood_scores[i],
      avg: visualization.moving_avg_7d[i],
    }));
  }, [visualization]);

  const emotionPieData = useMemo(() => {
    if (!visualization?.emotion_series) return [];
    return Object.entries(visualization.emotion_series)
      .map(([name, vals]) => ({
        name,
        value: Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100,
      }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [visualization]);

  const activityBarData = useMemo(() => {
    if (!patterns?.activity_correlation) return [];
    return patterns.activity_correlation.slice(0, 8);
  }, [patterns]);

  /* --- calendar heatmap (last 12 weeks) --- */
  const calendarData = useMemo(() => {
    const map = {};
    logs.forEach((l) => {
      map[l.logged_date] = l.mood_score;
    });
    const weeks = [];
    const today = new Date();
    for (let w = 11; w >= 0; w--) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const dt = new Date(today);
        dt.setDate(today.getDate() - w * 7 - (6 - d));
        const key = dt.toISOString().slice(0, 10);
        week.push({ date: key, score: map[key] || 0 });
      }
      weeks.push(week);
    }
    return weeks;
  }, [logs]);

  const heatColor = (score) => {
    if (!score) return "bg-slate-800";
    if (score <= 2) return "bg-red-600";
    if (score <= 4) return "bg-orange-500";
    if (score <= 6) return "bg-yellow-500";
    if (score <= 8) return "bg-green-500";
    return "bg-cyan-400";
  };

  /* --- render --- */
  return (
    <div
      className={`min-h-screen ${ambientBg} p-4 md:p-8 transition-colors duration-700`}
    >
      {/* Success animation overlay */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-bounce text-6xl">✨</div>
          <div className="absolute animate-ping text-4xl opacity-50">🎉</div>
        </div>
      )}

      {/* Crisis Alert Banner */}
      {crisisAlert && (
        <div className="mb-6 rounded-xl border border-red-500/50 bg-red-950/60 p-4 text-center">
          <p className="text-red-300 font-semibold">
            💛 We noticed your mood has been low for several days. You&apos;re
            not alone.
          </p>
          <button
            onClick={() => router.push("/emergency")}
            className="mt-2 rounded-lg bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500 transition"
          >
            Get Support Now →
          </button>
        </div>
      )}

      {/* Header + Stats Bar */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h1 className="text-3xl font-bold text-slate-100">💙 Mood Tracker</h1>
        <div className="flex flex-wrap gap-3">
          <StatPill
            label="Streak"
            value={`🔥 ${streaks?.current_streak ?? 0}d`}
          />
          <StatPill
            label="Weekly"
            value={
              weeklyScore
                ? `${weeklyScore.weekly_mental_health_score.toFixed(0)}/100`
                : "—"
            }
          />
          <StatPill
            label="Trend"
            value={
              trends?.trend_direction === "improving"
                ? "📈 Improving"
                : trends?.trend_direction === "declining"
                  ? "📉 Declining"
                  : "➡️ Stable"
            }
          />
          <StatPill
            label="Total"
            value={streaks?.total_entries ?? logs.length}
          />
          <button
            onClick={exportCSV}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition"
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-slate-900/60 p-1 border border-slate-700/50">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              tab === t
                ? "bg-cyan-600 text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ═══════════════ LOG TAB ═══════════════ */}
      {tab === "Log" && (
        <div className="space-y-6">
          {/* Mood Picker */}
          <Card title="How are you feeling?">
            <div className="grid grid-cols-5 gap-3">
              {MOODS.map((m) => (
                <button
                  key={m.label}
                  onClick={() => {
                    setSelectedMood(m);
                    setCustomScore(m.score);
                  }}
                  className={`rounded-xl p-4 text-center transition-all duration-200 ${
                    selectedMood?.label === m.label
                      ? "ring-2 ring-cyan-400 scale-105 shadow-lg"
                      : "hover:scale-102"
                  }`}
                  style={{
                    backgroundColor:
                      selectedMood?.label === m.label
                        ? m.color + "30"
                        : "rgb(30 41 59 / 0.6)",
                    borderColor:
                      selectedMood?.label === m.label
                        ? m.color
                        : "rgb(51 65 85 / 0.5)",
                    borderWidth: "1px",
                  }}
                >
                  <span className="text-3xl block mb-1">{m.emoji}</span>
                  <span className="text-xs font-medium text-slate-300">
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            {selectedMood && (
              <div className="mt-4">
                <label className="text-sm text-slate-400 mb-1 block">
                  Fine-tune: {customScore}/10
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={customScore}
                  onChange={(e) => setCustomScore(parseInt(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            )}
          </Card>

          {/* Emotion Tags */}
          <Card title="What emotions are you feeling?">
            <div className="flex flex-wrap gap-2">
              {EMOTIONS.map((e) => (
                <Chip
                  key={e}
                  label={e}
                  active={selectedEmotions.includes(e)}
                  onClick={() =>
                    setSelectedEmotions((prev) =>
                      prev.includes(e)
                        ? prev.filter((x) => x !== e)
                        : [...prev, e],
                    )
                  }
                />
              ))}
            </div>
          </Card>

          {/* Activities */}
          <Card title="What have you been doing?">
            <div className="flex flex-wrap gap-2">
              {ACTIVITIES.map((a) => (
                <Chip
                  key={a}
                  label={a}
                  active={selectedActivities.includes(a)}
                  onClick={() =>
                    setSelectedActivities((prev) =>
                      prev.includes(a)
                        ? prev.filter((x) => x !== a)
                        : [...prev, a],
                    )
                  }
                />
              ))}
            </div>
          </Card>

          {/* Triggers */}
          <Card title="Any triggers today?">
            <div className="flex flex-wrap gap-2">
              {TRIGGERS.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  active={selectedTriggers.includes(t)}
                  onClick={() =>
                    setSelectedTriggers((prev) =>
                      prev.includes(t)
                        ? prev.filter((x) => x !== t)
                        : [...prev, t],
                    )
                  }
                />
              ))}
            </div>
          </Card>

          {/* Sleep & Exercise */}
          <Card title="Wellness Check">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1 block">
                  😴 Sleep (hours)
                </label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  placeholder="e.g. 7.5"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1 block">
                  🏃 Exercise (minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={exerciseMin}
                  onChange={(e) => setExerciseMin(e.target.value)}
                  placeholder="e.g. 30"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              ⏰ Auto-tagged:{" "}
              <span className="text-cyan-400">{getTimeOfDay()}</span>
            </p>
          </Card>

          {/* Journal Prompt + Notes */}
          <Card title="Journal">
            <p className="text-sm text-cyan-400 italic mb-3">
              💡 {todayPrompt}
            </p>
            <textarea
              placeholder="Write about your feelings..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-sm text-slate-100 placeholder-slate-400 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              rows={4}
            />
          </Card>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleSave}
            disabled={!selectedMood || saving}
            className="w-full rounded-xl bg-cyan-600 py-3 text-sm font-bold transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            {saving ? "Saving…" : "Save Mood Entry ✨"}
          </button>
        </div>
      )}

      {/* ═══════════════ CHARTS TAB ═══════════════ */}
      {tab === "Charts" && (
        <div className="space-y-6">
          {/* Range Toggle */}
          <div className="flex gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setChartDays(d)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  chartDays === d
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          {/* Mood Line Chart */}
          <Card title="Mood Over Time">
            {moodChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={moodChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "#e2e8f0" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    name="Mood Score"
                  />
                  <Line
                    type="monotone"
                    dataKey="avg"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="7-Day Avg"
                  />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">
                Log moods to see your chart
              </p>
            )}
          </Card>

          {/* Emotion Donut */}
          <Card title="Emotion Breakdown">
            {emotionPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={emotionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {emotionPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">
                Tag emotions to see breakdown
              </p>
            )}
          </Card>

          {/* Weekly Heatmap Calendar */}
          <Card title="Mood Calendar (12 Weeks)">
            <div className="flex gap-1 justify-center">
              <div className="flex flex-col gap-1 mr-1 text-[10px] text-slate-500 pt-0">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <div key={i} className="h-4 flex items-center">
                    {d}
                  </div>
                ))}
              </div>
              {calendarData.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={day.date}
                      className={`w-4 h-4 rounded-sm ${heatColor(day.score)} transition-colors`}
                      title={`${day.date}: ${day.score || "no entry"}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-slate-500">
              <span>Less</span>
              {[
                "bg-slate-800",
                "bg-red-600",
                "bg-orange-500",
                "bg-yellow-500",
                "bg-green-500",
                "bg-cyan-400",
              ].map((c) => (
                <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
              ))}
              <span>More</span>
            </div>
          </Card>

          {/* Activity Correlation */}
          <Card title="Activity & Mood Correlation">
            {activityBarData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={activityBarData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    type="number"
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    dataKey="activity"
                    type="category"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="avg_mood"
                    fill="#06b6d4"
                    radius={[0, 4, 4, 0]}
                    name="Avg Mood"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-500 text-sm text-center py-8">
                Tag activities to see correlations
              </p>
            )}
          </Card>

          {/* Day-of-Week Pattern */}
          {patterns?.day_of_week?.length > 0 && (
            <Card title="Mood by Day of Week">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={patterns.day_of_week}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <YAxis
                    domain={[0, 10]}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #475569",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="avg_mood"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                    name="Avg Mood"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════════ HISTORY TAB ═══════════════ */}
      {tab === "History" && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={filterDays}
                onChange={(e) => setFilterDays(parseInt(e.target.value))}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
                <option value={999}>All time</option>
              </select>

              <select
                value={filterMood}
                onChange={(e) => setFilterMood(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 outline-none"
              >
                <option value="all">All moods</option>
                <option value="3">Low (≤3)</option>
                <option value="5">Medium (≤5)</option>
                <option value="7">Good (≤7)</option>
              </select>

              <input
                type="text"
                placeholder="🔍 Search notes..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="flex-1 min-w-[200px] rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500"
              />
            </div>
          </Card>

          <p className="text-xs text-slate-500">
            {filteredLogs.length} entries
          </p>

          {/* Grouped entries */}
          {groupedLogs.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-8">
              No mood entries found.
            </p>
          ) : (
            groupedLogs.map(([dateStr, entries]) => (
              <div key={dateStr}>
                <h3 className="text-xs font-semibold text-slate-500 mb-2 pl-1">
                  {new Date(dateStr + "T00:00:00").toLocaleDateString(
                    undefined,
                    {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </h3>
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="mb-2 rounded-xl border border-slate-700/40 bg-slate-900/70 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {entry.mood_label?.split(" ")[0] || "😐"}
                        </span>
                        <span className="font-semibold text-slate-100">
                          {entry.mood_score}/10
                        </span>
                        <span className="text-xs text-slate-500">
                          {entry.mood_label?.split(" ").slice(1).join(" ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">
                          {entry.time_of_day && `${entry.time_of_day} · `}
                          {new Date(entry.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <button
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditNote(entry.notes || "");
                          }}
                          className="text-xs text-slate-500 hover:text-cyan-400 transition"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="text-xs text-slate-500 hover:text-red-400 transition"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Meta tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.activities?.map((a) => (
                        <span
                          key={a}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-cyan-400"
                        >
                          {a}
                        </span>
                      ))}
                      {entry.triggers?.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-orange-400"
                        >
                          {t}
                        </span>
                      ))}
                      {entry.sleep_hours != null && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-purple-400">
                          😴 {entry.sleep_hours}h
                        </span>
                      )}
                      {entry.exercise_minutes != null && (
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-green-400">
                          🏃 {entry.exercise_minutes}m
                        </span>
                      )}
                    </div>

                    {/* Emotion tags */}
                    {entry.emotion_scores && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.keys(entry.emotion_scores).map((e) => (
                          <span
                            key={e}
                            className="rounded-full bg-cyan-900/30 px-2 py-0.5 text-[10px] text-cyan-300"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    {editingId === entry.id ? (
                      <div className="mt-2">
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          className="w-full rounded-lg border border-slate-600 bg-slate-800 p-2 text-sm text-slate-200 outline-none focus:border-cyan-500"
                          rows={2}
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => handleEdit(entry.id)}
                            className="rounded bg-cyan-600 px-3 py-1 text-xs text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded bg-slate-700 px-3 py-1 text-xs text-slate-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      entry.notes && (
                        <p className="mt-2 text-sm text-slate-400">
                          {entry.notes}
                        </p>
                      )
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══════════════ INSIGHTS TAB ═══════════════ */}
      {tab === "Insights" && (
        <div className="space-y-6">
          {/* Weekly Summary */}
          {weeklyScore && (
            <Card title="📊 Weekly Summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat
                  label="Avg Mood"
                  value={`${weeklyScore.average_mood.toFixed(1)}/10`}
                />
                <MiniStat label="Entries" value={weeklyScore.entries_count} />
                <MiniStat
                  label="Consistency"
                  value={`${(weeklyScore.consistency_ratio * 100).toFixed(0)}%`}
                />
                <MiniStat
                  label="Stability"
                  value={`${(weeklyScore.stability_score * 100).toFixed(0)}%`}
                />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm text-slate-400 mb-1">
                  <span>Weekly Health Score</span>
                  <span className="text-cyan-400 font-bold">
                    {weeklyScore.weekly_mental_health_score.toFixed(0)}/100
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                    style={{
                      width: `${weeklyScore.weekly_mental_health_score}%`,
                    }}
                  />
                </div>
              </div>
            </Card>
          )}

          {/* Streak Card */}
          {streaks && (
            <Card title="🔥 Streaks">
              <div className="grid grid-cols-3 gap-4 text-center">
                <MiniStat
                  label="Current"
                  value={`${streaks.current_streak}d`}
                />
                <MiniStat
                  label="Longest"
                  value={`${streaks.longest_streak}d`}
                />
                <MiniStat label="Total Logs" value={streaks.total_entries} />
              </div>
            </Card>
          )}

          {/* Trend Analysis */}
          {trends && (
            <Card title="📈 Trend Analysis">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {trends.trend_direction === "improving"
                    ? "📈"
                    : trends.trend_direction === "declining"
                      ? "📉"
                      : "➡️"}
                </span>
                <div>
                  <p className="text-lg font-semibold text-slate-100 capitalize">
                    {trends.trend_direction}
                  </p>
                  <p className="text-sm text-slate-400">
                    Over the last {trends.window_days} days (slope:{" "}
                    {trends.slope.toFixed(4)})
                  </p>
                </div>
              </div>
              {trends.top_emotions?.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-slate-400 mb-2">Top Emotions:</p>
                  <div className="flex flex-wrap gap-2">
                    {trends.top_emotions.map((e) => (
                      <span
                        key={e.emotion}
                        className="rounded-full bg-cyan-900/30 border border-cyan-700/30 px-3 py-1 text-xs text-cyan-300"
                      >
                        {e.emotion}: {e.avg_score.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Mood Patterns */}
          {patterns?.time_of_day?.length > 0 && (
            <Card title="🕐 Time-of-Day Patterns">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {patterns.time_of_day.map((t) => (
                  <div
                    key={t.time}
                    className="rounded-lg bg-slate-800/60 p-3 text-center"
                  >
                    <p className="text-xs text-slate-500 capitalize">
                      {t.time}
                    </p>
                    <p className="text-lg font-bold text-slate-100">
                      {t.avg_mood.toFixed(1)}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {t.count} entries
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* AI Reflection */}
          <Card title="🤖 AI Weekly Reflection">
            {aiReflection ? (
              <p className="text-sm text-slate-300 leading-relaxed">
                {aiReflection}
              </p>
            ) : (
              <p className="text-sm text-slate-500">
                Get a personalized reflection based on your recent mood entries.
              </p>
            )}
            <button
              onClick={fetchAiReflection}
              disabled={aiLoading}
              className="mt-3 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition disabled:opacity-50"
            >
              {aiLoading ? "Generating…" : "✨ Generate Reflection"}
            </button>
          </Card>

          {/* Recommendations */}
          {recommendation && (
            <Card title="💡 Recommendation">
              <p className="text-sm text-slate-300 leading-relaxed">
                {recommendation}
              </p>
            </Card>
          )}

          {/* Crisis Safety Net */}
          <Card title="💛 Support Resources">
            <p className="text-sm text-slate-400 mb-3">
              Remember: it&apos;s okay to ask for help. These resources are
              always available.
            </p>
            <button
              onClick={() => router.push("/emergency")}
              className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition"
            >
              🆘 Emergency Resources
            </button>
          </Card>
        </div>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-xs text-slate-400">
          Loading data…
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 backdrop-blur-xl">
      {title && (
        <h2 className="mb-4 text-lg font-semibold text-slate-200">{title}</h2>
      )}
      {children}
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-900/80 border border-slate-700/50 px-3 py-1.5 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-200">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-xl font-bold text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-cyan-600 text-white shadow-md"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}
