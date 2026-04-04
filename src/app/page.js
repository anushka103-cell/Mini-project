import Link from "next/link";

const FEATURES = [
  { icon: "AI", title: "AI Emotional Companion", description: "Talk to an empathetic AI that listens, understands, and responds with care 24/7." },
  { icon: "People", title: "Anonymous Human Support", description: "Connect with real people anonymously. No names, no judgement, just support." },
  { icon: "Heart", title: "Mood Tracking and Insights", description: "Log how you feel daily and discover patterns through analytics." },
  { icon: "Avatar", title: "3D Custom Avatars", description: "Express yourself with a personalized 3D avatar powered by Ready Player Me." },
  { icon: "Game", title: "Stress-Relief Games", description: "Breathing exercises and focus games designed to calm your mind in minutes." },
  { icon: "Lock", title: "Privacy and Encryption", description: "End-to-end encrypted data, GDPR compliant. Your mental health stays private." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-cyan-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <section className="relative flex flex-col items-center justify-center px-6 py-36 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
          Privacy-first mental wellness platform
        </div>

        <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-tight md:text-6xl">
          A safe world where your{" "}
          <span className="bg-gradient-to-r from-cyan-400 to-cyan-200 bg-clip-text text-transparent">
            mind can breathe
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-400">
          Connect with AI companions, anonymous peers, and therapeutic tools designed for your emotional well-being.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href="/signup">
            <button className="rounded-xl bg-cyan-600 px-8 py-3 font-semibold transition hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950">
              Get Started Free
            </button>
          </Link>
          <Link href="/login">
            <button className="rounded-xl border border-slate-600 px-8 py-3 font-semibold transition hover:border-cyan-500 hover:text-cyan-400 focus:outline-none">
              Sign In
            </button>
          </Link>
        </div>
      </section>

      <section className="px-6 pb-32">
        <h2 className="mb-4 text-center text-3xl font-bold">Everything you need to feel safe</h2>
        <p className="mb-12 text-center text-slate-400">Built with compassion and cutting-edge technology.</p>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-6 backdrop-blur-xl transition hover:border-cyan-500/50 hover:bg-slate-900"
            >
              <div className="mb-3 text-sm font-bold text-cyan-400 uppercase tracking-widest">{feature.icon}</div>
              <h3 className="mb-2 text-lg font-semibold text-slate-100">{feature.title}</h3>
              <p className="text-sm text-slate-400">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}