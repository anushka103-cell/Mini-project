"use client";

import { useState, useEffect } from "react";

const STEPS = [
  {
    icon: "👋",
    title: "Welcome to MindSafe",
    description:
      "Your privacy-first mental health companion. Everything here is encrypted and confidential.",
  },
  {
    icon: "💙",
    title: "Track Your Mood",
    description:
      "Log how you feel daily. Over time, discover patterns and insights about your well-being.",
  },
  {
    icon: "🤖",
    title: "AI Companion",
    description:
      "Chat with our AI anytime. It's trained to listen, support, and guide — never judge.",
  },
  {
    icon: "🎮",
    title: "Relax & Play",
    description:
      "10 activities from breathing exercises to mindful games. Take a break whenever you need.",
  },
  {
    icon: "🔒",
    title: "Your Privacy Matters",
    description:
      "End-to-end encryption, anonymous mode, and full data control. Your data belongs to you.",
  },
];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("mindsafe_onboarded", "true");
      onComplete();
    }
  };

  const skip = () => {
    localStorage.setItem("mindsafe_onboarded", "true");
    onComplete();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4">
      <div className="w-full max-w-md text-center">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i === step
                  ? "w-6 bg-cyan-500"
                  : i < step
                    ? "bg-cyan-700"
                    : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="text-6xl mb-6">{current.icon}</div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-slate-100 mb-3">
          {current.title}
        </h2>
        <p className="text-slate-400 mb-10 leading-relaxed max-w-sm mx-auto">
          {current.description}
        </p>

        {/* Buttons */}
        <div className="flex justify-center gap-3">
          <button
            onClick={skip}
            className="rounded-xl px-6 py-3 text-sm text-slate-500 transition hover:text-slate-300"
          >
            Skip
          </button>
          <button
            onClick={next}
            className="rounded-xl bg-cyan-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-cyan-500"
          >
            {step < STEPS.length - 1 ? "Next" : "Get Started"}
          </button>
        </div>

        {/* Step counter */}
        <p className="text-xs text-slate-600 mt-6">
          {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  );
}

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("mindsafe_onboarded");
    if (!onboarded) setShowOnboarding(true);
  }, []);

  return {
    showOnboarding,
    completeOnboarding: () => setShowOnboarding(false),
  };
}
