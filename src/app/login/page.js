"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { saveTokens, clearTokens } from "@/lib/authClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const GOOGLE_AUTH_URL = process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL;

function readTokens(data) {
  return {
    accessToken: data?.accessToken || data?.access_token || data?.token || null,
    refreshToken: data?.refreshToken || data?.refresh_token || null,
  };
}

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginMode, setLoginMode] = useState("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) setError(decodeURIComponent(oauthError));
  }, [searchParams]);

  // Clear any stale tokens when arriving at the login page
  useEffect(() => {
    clearTokens();
  }, []);

  const handleGoogleLogin = () => {
    if (!GOOGLE_AUTH_URL) {
      setError(
        "Google sign-in is not available yet. Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file and rebuild.",
      );
      return;
    }

    window.location.href = GOOGLE_AUTH_URL;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setInfoMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Unable to login.");
        return;
      }

      const { accessToken, refreshToken } = readTokens(data);

      if (accessToken) {
        saveTokens(accessToken, refreshToken, data.expiresIn || "15m");
        router.push("/dashboard");
      } else {
        setError("Login response missing tokens.");
      }
    } catch {
      setError("Server error. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setInfoMessage("");

    if (!email.trim()) {
      setError("Enter your email first, then click Forgot password.");
      return;
    }

    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Unable to send reset email.");
        return;
      }

      setInfoMessage(
        "If an account with that email exists, a password reset link has been sent.",
      );
    } catch {
      setError("Server error. Please try again in a moment.");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleRequestOtp = async () => {
    setError("");
    setInfoMessage("");

    if (!mobile.trim()) {
      setError("Enter your mobile number with country code.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/request-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mobile: mobile.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Unable to send OTP.");
        return;
      }

      setOtpSent(true);
      setInfoMessage("If this number is registered, OTP has been sent.");
    } catch {
      setError("Server error. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMobileLogin = async (event) => {
    event.preventDefault();
    setError("");
    setInfoMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/mobile/login-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mobile: mobile.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Unable to login with OTP.");
        return;
      }

      const { accessToken, refreshToken } = readTokens(data);

      if (accessToken) {
        saveTokens(accessToken, refreshToken, data.expiresIn || "15m");
        router.push("/dashboard");
      } else {
        setError("Login response missing tokens.");
      }
    } catch {
      setError("Server error. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-65">
        <div className="absolute left-[-12%] top-[-18%] h-80 w-80 rounded-full bg-cyan-500/30 blur-3xl" />
        <div className="absolute bottom-[-24%] right-[-8%] h-96 w-96 rounded-full bg-teal-400/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/75 p-8 shadow-2xl backdrop-blur-xl">
        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-300/80">
          Welcome Back
        </p>
        <h1 className="mb-2 text-3xl font-semibold">Sign in to continue</h1>
        <p className="mb-6 text-sm text-slate-300">
          Your account stays private. Sign in with email/password or mobile/OTP.
        </p>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-slate-700 bg-slate-950 p-1 text-sm">
          <button
            type="button"
            onClick={() => {
              setLoginMode("email");
              setError("");
              setInfoMessage("");
            }}
            className={`rounded-lg px-3 py-2 transition ${
              loginMode === "email"
                ? "bg-cyan-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Email + Password
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode("mobile");
              setError("");
              setInfoMessage("");
            }}
            className={`rounded-lg px-3 py-2 transition ${
              loginMode === "mobile"
                ? "bg-cyan-500 text-slate-950"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            Mobile + OTP
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 font-medium transition hover:border-cyan-400 hover:bg-slate-800"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {loginMode === "email" ? (
          <>
            <div className="mb-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-700" />
              or continue with email
              <span className="h-px flex-1 bg-slate-700" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <label className="block text-sm text-slate-200">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <label className="block text-sm text-slate-200">Password</label>
              <input
                type="password"
                required
                placeholder="Your password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div className="text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={forgotLoading}
                  className="text-xs text-cyan-300 hover:text-cyan-200 disabled:opacity-60"
                >
                  {forgotLoading ? "Sending..." : "Forgot password?"}
                </button>
              </div>

              {error ? (
                <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                  {error}
                </p>
              ) : null}

              {infoMessage ? (
                <p className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                  {infoMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleMobileLogin} className="space-y-4">
            <label className="block text-sm text-slate-200">
              Mobile Number
            </label>
            <input
              type="tel"
              required
              placeholder="+91XXXXXXXXXX"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />

            <div className="flex gap-3">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                placeholder="Enter 6-digit OTP"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none transition focus:border-cyan-400"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              <button
                type="button"
                onClick={handleRequestOtp}
                disabled={isLoading}
                className="rounded-xl border border-cyan-500 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {otpSent ? "Resend OTP" : "Send OTP"}
              </button>
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
                {error}
              </p>
            ) : null}

            {infoMessage ? (
              <p className="rounded-lg border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200">
                {infoMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in with OTP"}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between text-sm text-slate-300">
          <Link href="/signup" className="text-cyan-300 hover:text-cyan-200">
            Create account
          </Link>
          <Link href="/verify-email" className="hover:text-cyan-200">
            Verify email
          </Link>
        </div>
      </div>
    </div>
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
