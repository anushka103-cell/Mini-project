"use client";

import Link from "next/link";

const CRISIS_LINES = [
  {
    name: "Vandrevala Foundation (India)",
    number: "1860-2662-345",
    available: "24/7",
    description: "Free, confidential mental health support in multiple Indian languages.",
  },
  {
    name: "iCall (Tata Institute)",
    number: "9152987821",
    available: "Mon–Sat, 8 AM – 10 PM IST",
    description: "Psychosocial helpline by trained counsellors.",
  },
  {
    name: "AASRA",
    number: "9820466726",
    available: "24/7",
    description: "Crisis intervention helpline for those in emotional distress.",
  },
  {
    name: "Snehi",
    number: "044-24640050",
    available: "24/7",
    description: "Emotional support and suicide prevention helpline.",
  },
  {
    name: "NIMHANS Helpline",
    number: "080-46110007",
    available: "Mon–Sat, 9:30 AM – 4:30 PM IST",
    description: "National Institute of Mental Health and Neurosciences helpline.",
  },
];

const COPING_STEPS = [
  {
    icon: "🌬️",
    title: "Breathe Slowly",
    description: "Inhale for 4 seconds, hold for 4, exhale for 6. Repeat 5 times.",
  },
  {
    icon: "🧊",
    title: "Grounding Technique",
    description: "Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste.",
  },
  {
    icon: "🚰",
    title: "Drink Water",
    description: "A glass of cool water can ground you in the present moment.",
  },
  {
    icon: "📝",
    title: "Write It Down",
    description: "Putting emotions on paper can relieve mental pressure instantly.",
  },
  {
    icon: "🤝",
    title: "Reach Out",
    description: "Call a trusted friend, family member, or any helpline listed above.",
  },
];

export default function EmergencyHelp() {
  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold tracking-tight text-slate-100">
            🆘 Emergency Help
          </h1>
          <p className="mt-2 text-slate-400">
            If you or someone you know is in emotional distress, please reach
            out. You are not alone.
          </p>
        </header>

        {/* Immediate SOS Banner */}
        <section
          className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6"
          role="alert"
          aria-label="Emergency contact"
        >
          <p className="mb-2 text-lg font-semibold text-rose-300">
            Feeling unsafe right now?
          </p>
          <p className="mb-4 text-sm text-slate-300">
            Call emergency services or a crisis helpline immediately. Your safety
            comes first.
          </p>
          <a
            href="tel:112"
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            aria-label="Call emergency number 112"
          >
            📞 Call 112 (Emergency)
          </a>
        </section>

        {/* Crisis Helplines */}
        <section aria-labelledby="helplines-heading">
          <h2
            id="helplines-heading"
            className="mb-4 text-xl font-semibold text-slate-100"
          >
            Crisis Helplines
          </h2>
          <div className="space-y-3">
            {CRISIS_LINES.map((line) => (
              <div
                key={line.number}
                className="flex flex-col gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-100">{line.name}</p>
                  <p className="text-sm text-slate-400">{line.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Available: {line.available}
                  </p>
                </div>
                <a
                  href={`tel:${line.number.replace(/[^+\d]/g, "")}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  aria-label={`Call ${line.name} at ${line.number}`}
                >
                  📞 {line.number}
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Coping Steps */}
        <section aria-labelledby="coping-heading">
          <h2
            id="coping-heading"
            className="mb-4 text-xl font-semibold text-slate-100"
          >
            Quick Coping Steps
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {COPING_STEPS.map((step) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 backdrop-blur-xl"
              >
                <div className="mb-2 text-2xl">{step.icon}</div>
                <h3 className="mb-1 text-sm font-semibold text-slate-100">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Safety Planning */}
        <section
          className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6"
          aria-labelledby="safety-heading"
        >
          <h2
            id="safety-heading"
            className="mb-3 text-lg font-semibold text-amber-200"
          >
            Create a Safety Plan
          </h2>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex gap-2">
              <span className="text-amber-400">1.</span> Identify warning signs
              that a crisis may be developing.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">2.</span> List coping strategies
              that have helped you before.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">3.</span> Write down people you
              can contact for support.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">4.</span> Save the crisis
              helpline numbers from this page.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-400">5.</span> Make your environment
              safe — remove access to harmful items.
            </li>
          </ul>
        </section>

        {/* Back to Dashboard */}
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="text-sm text-cyan-400 transition hover:text-cyan-300"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
