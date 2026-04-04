"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/authClient";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Insights() {
  const router = useRouter();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchMoods();
  }, [router]);

  const fetchMoods = async () => {
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/mood`,
        { method: "GET" },
        API_BASE_URL,
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data.moods || []);
      } else if (response.status === 401) {
        router.replace("/login");
      }
    } catch (err) {
      console.error("Error fetching moods:", err);
    }
  };

  const totalEntries = history.length;

  const averageIntensity =
    history.length > 0
      ? (
          history.reduce((sum, entry) => sum + Number(entry.intensity), 0) /
          history.length
        ).toFixed(1)
      : 0;

  const moodCount = history.reduce((acc, entry) => {
    acc[entry.mood] = (acc[entry.mood] || 0) + 1;
    return acc;
  }, {});

  const mostFrequentMood =
    Object.keys(moodCount).length > 0
      ? Object.keys(moodCount).reduce((a, b) =>
          moodCount[a] > moodCount[b] ? a : b,
        )
      : "-";

  const intensityData = history.map((entry, index) => ({
    name: index + 1,
    intensity: entry.intensity,
  }));

  const moodDistributionData = Object.keys(moodCount).map((key) => ({
    mood: key,
    count: moodCount[key],
  }));

  const getInsightMessage = () => {
    if (history.length === 0)
      return "Track your moods to see meaningful insights.";

    if (averageIntensity > 7)
      return "You've been experiencing high-intensity emotions lately. Consider relaxation exercises.";

    if (mostFrequentMood === "Sad")
      return "You've reported sadness frequently. Talking to someone may help.";

    if (mostFrequentMood === "Happy")
      return "You've been feeling happy often. Keep nurturing what makes you feel good.";

    return "You're building emotional awareness. Keep tracking daily.";
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8 md:p-10">
      <h1 className="mb-8 text-3xl font-bold text-slate-100">
        📊 Insights & Analytics
      </h1>

      <div className="grid md:grid-cols-3 gap-4 text-center mb-8">
        <Stat label="Total Mood Entries" value={totalEntries} />
        <Stat label="Average Intensity" value={`${averageIntensity}/10`} />
        <Stat label="Most Frequent Mood" value={mostFrequentMood} />
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-200">
          Mood Intensity Trend
        </h2>

        {history.length === 0 ? (
          <p className="text-sm text-slate-400">
            No data yet — log some moods first!
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={intensityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" />
              <YAxis domain={[0, 10]} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                }}
              />
              <Line
                type="monotone"
                dataKey="intensity"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ fill: "#22d3ee" }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-xl">
        <h2 className="mb-4 text-lg font-semibold text-slate-200">
          Mood Distribution
        </h2>

        {moodDistributionData.length === 0 ? (
          <p className="text-sm text-slate-400">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={moodDistributionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mood" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid #475569",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="count" fill="#0891b2" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-6 backdrop-blur-xl">
        <h2 className="mb-3 text-lg font-semibold text-cyan-400">
          🌟 AI-Powered Insight
        </h2>
        <p className="text-sm text-slate-300">{getInsightMessage()}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 backdrop-blur-xl">
      <h2 className="text-2xl font-bold text-slate-100">{value}</h2>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
    </div>
  );
}
