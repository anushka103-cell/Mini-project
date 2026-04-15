"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://mindsafe-api.onrender.com";
const GOOGLE_AUTH_URL = process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL;

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [verificationLink, setVerificationLink] = useState("");

  const passwordChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasNumber: /\d/.test(password),
      hasLetter: /[A-Za-z]/.test(password),
      matchesConfirm: password.length > 0 && password === confirmPassword,
    };
  }, [password, confirmPassword]);

  const canSubmit =
    email.trim().length > 0 &&
    passwordChecks.minLength &&
    passwordChecks.hasLetter &&
    passwordChecks.hasNumber &&
    passwordChecks.matchesConfirm;

  const handleGoogleSignup = () => {
    if (!GOOGLE_AUTH_URL) {
      setError(
        "Google sign-up is not available yet. Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file and rebuild.",
      );
      return;
    }

    window.location.href = GOOGLE_AUTH_URL;
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setVerificationLink("");

    if (!canSubmit) {
      setError("Please complete all fields and satisfy password requirements.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Sign-up failed. Please try again.");
        return;
      }

      setSuccessMessage(
        "Account created. Please verify your email from your inbox before login.",
      );

      // In development, the API may return a verification token for auto-redirect
      const token = String(data.emailVerificationToken || "").trim();
      if (token) {
        router.push(`/verify-email?token=${encodeURIComponent(token)}`);
        return;
      }

      if (data.verificationLink) {
        try {
          const parsed = new URL(data.verificationLink);
          const tokenFromLink = parsed.searchParams.get("token");
          if (tokenFromLink) {
            router.push(
              `/verify-email?token=${encodeURIComponent(tokenFromLink)}`,
            );
            return;
          }
        } catch {
          // If parsing fails, keep the user on signup and show the Verify Email button.
        }
      }
    } catch {
      setError("Server error. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyNow = () => {
    if (!verificationLink) {
      return;
    }

    try {
      const parsed = new URL(verificationLink);
      const token = parsed.searchParams.get("token");
      if (token) {
        router.push(`/verify-email?token=${encodeURIComponent(token)}`);
        return;
      }
    } catch {
      // Fall through to direct navigation if parsing fails.
    }

    if (verificationLink.startsWith("/")) {
      router.push(verificationLink);
    } else {
      window.location.href = verificationLink;
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-10%] top-[-20%] h-80 w-80 rounded-full bg-cyan-500/30 blur-3xl" />
        <div className="absolute bottom-[-25%] right-[-8%] h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-300/80">
          Join MindSafe
        </p>
        <h1 className="mb-2 text-3xl font-semibold leading-tight">
          Create your private support account
        </h1>
        <p className="mb-6 text-sm text-slate-300">
          Start with email or use Google. Email verification is required before
          your first login.
        </p>

        <button
          type="button"
          onClick={handleGoogleSignup}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 font-medium transition hover:border-cyan-400 hover:bg-slate-800"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="mb-5 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-700" />
          or continue with email
          <span className="h-px flex-1 bg-slate-700" />
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <FieldLabel>Password</FieldLabel>
          <input
            type="password"
            required
            placeholder="At least 8 characters"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <FieldLabel>Confirm Password</FieldLabel>
          <input
            type="password"
            required
            placeholder="Re-enter password"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <PasswordChecklist checks={passwordChecks} />

          {error ? (
            <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          ) : null}

          {successMessage ? (
            <div className="space-y-3 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              <p>{successMessage}</p>
              {verificationLink ? (
                <button
                  type="button"
                  onClick={handleVerifyNow}
                  className="rounded-md bg-emerald-300 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-200"
                >
                  Verify Email Now
                </button>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || isLoading}
            className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-300">
          Already registered?{" "}
          <Link
            href="/login"
            className="font-medium text-cyan-300 hover:text-cyan-200"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label className="mb-1 block text-sm text-slate-200">{children}</label>
  );
}

function PasswordChecklist({ checks }) {
  const rules = [
    { ok: checks.minLength, text: "At least 8 characters" },
    { ok: checks.hasLetter, text: "Contains a letter" },
    { ok: checks.hasNumber, text: "Contains a number" },
    { ok: checks.matchesConfirm, text: "Passwords match" },
  ];

  return (
    <ul className="space-y-1 text-xs">
      {rules.map((rule) => (
        <li
          key={rule.text}
          className={rule.ok ? "text-emerald-300" : "text-slate-400"}
        >
          {rule.ok ? "*" : "-"} {rule.text}
        </li>
      ))}
    </ul>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.56-2.77c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.28-1.93-6.15-4.52H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.85 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.09 14.96 1 12 1A11 11 0 0 0 2.18 7.05l3.67 2.84C6.72 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
