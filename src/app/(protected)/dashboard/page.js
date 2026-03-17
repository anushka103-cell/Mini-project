"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
    }
  }, []);

  return (
    <div>
      <h1 className="text-4xl font-bold mb-8">Welcome to Your Safe Space</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Talk to AI" link="/ai-companion" />
        <Card title="Connect Anonymously" link="/anonymous" />
        <Card title="Log Your Mood" link="/mood" />
        <Card title="Play a Game" link="/games" />
      </div>

      <div className="mt-12 grid md:grid-cols-3 gap-6 text-center">
        <Stat label="Mood Entries Logged" value="0" />
        <Stat label="100% Privacy Protected" value="✔" />
        <Stat label="24/7 Support Available" value="✔" />
      </div>
    </div>
  );
}

function Card({ title, link }) {
  return (
    <Link href={link}>
      <div className="p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-purple-500 transition cursor-pointer">
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
    </Link>
  );
}

function Stat({ label, value }) {
  return (
    <div className="p-6 bg-purple-900/20 rounded-2xl border border-purple-500/30">
      <h2 className="text-3xl font-bold">{value}</h2>
      <p className="text-gray-400 mt-2">{label}</p>
    </div>
  );
}
