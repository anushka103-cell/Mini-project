"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking verification token...");
  const [isError, setIsError] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  const verifyWithToken = async (token) => {
    const normalizedToken = String(token || "").trim();

    if (!normalizedToken) {
      setIsError(true);
      setStatus("Verification token is missing.");
      setIsDone(true);
      return false;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/verify-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: normalizedToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsError(true);
        setStatus(data.message || "Email verification failed.");
        setIsDone(true);
        return false;
      }

      setIsError(false);
      setStatus("Email verified successfully. Redirecting to login...");
      setIsDone(true);

      // Clear one-time dev token hints when verification succeeds.
      localStorage.removeItem("pendingEmailVerificationToken");
      localStorage.removeItem("pendingEmailVerificationLink");

      setTimeout(() => router.push("/login"), 1500);
      return true;
    } catch {
      setIsError(true);
      setStatus("Server error while verifying email.");
      setIsDone(true);
      return false;
    }
  };

  useEffect(() => {
    const verifyEmail = async () => {
      const queryToken = new URLSearchParams(window.location.search).get(
        "token",
      );
      const storedToken = localStorage.getItem("pendingEmailVerificationToken");

      if (queryToken) {
        setTokenInput(queryToken);
        await verifyWithToken(queryToken);
        return;
      }

      if (storedToken) {
        setTokenInput(storedToken);
        await verifyWithToken(storedToken);
        return;
      }

      setIsError(true);
      setIsDone(true);
      setStatus(
        "Verification token is missing. Paste your token below, or open the verification link from your signup response/email.",
      );
    };

    verifyEmail();
  }, [router]);

  const handleManualVerification = async (event) => {
    event.preventDefault();
    setIsSubmittingManual(true);
    setIsDone(false);
    setStatus("Verifying token...");
    await verifyWithToken(tokenInput);
    setIsSubmittingManual(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-65">
        <div className="absolute left-[-8%] top-[-18%] h-80 w-80 rounded-full bg-cyan-500/25 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] h-96 w-96 rounded-full bg-teal-500/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/75 p-8 text-center shadow-2xl backdrop-blur-xl">
        <h1 className="mb-4 text-2xl font-semibold">Email verification</h1>

        {!isDone ? (
          <div className="mb-4 flex items-center justify-center gap-2 text-cyan-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
            <span className="text-sm">Processing...</span>
          </div>
        ) : null}

        <p
          className={isError ? "text-rose-300" : "text-emerald-300"}
          aria-live="polite"
        >
          {status}
        </p>

        <form
          onSubmit={handleManualVerification}
          className="mt-5 space-y-3 text-left"
        >
          <label className="block text-xs uppercase tracking-wide text-slate-400">
            Verification token
          </label>
          <input
            type="text"
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value)}
            placeholder="Paste token here"
            className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
          />
          <button
            type="submit"
            disabled={isSubmittingManual}
            className="w-full rounded-xl border border-cyan-500 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmittingManual ? "Verifying..." : "Verify with token"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Link
            href="/login"
            className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400"
          >
            Go to login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-slate-600 px-4 py-2 hover:border-cyan-300"
          >
            Create new account
          </Link>
        </div>
      </div>
    </div>
  );
}
