"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/authClient";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function Profile() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState("user");
  const [anonymizedUserId, setAnonymizedUserId] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isMobileVerified, setIsMobileVerified] = useState(false);
  const [anonymousName, setAnonymousName] = useState("Anonymous");
  const [anonymousMode, setAnonymousMode] = useState(true);
  const [mobileOtp, setMobileOtp] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetchWithAuth(
          `${API_BASE_URL}/api/profile`,
          { method: "GET" },
          API_BASE_URL,
        );

        if (response.status === 401) {
          setSaveStatus("error");
          setStatusMessage("Session expired. Please sign in again.");
          return;
        }

        if (!response.ok) {
          setSaveStatus("error");
          setStatusMessage("Unable to load profile right now. Please retry.");
          return;
        }

        const data = await response.json();
        setEmail(data.email || "");
        setAnonymizedUserId(data.anonymizedUserId || "");
        setRole(data.profile?.role || "user");
        setFullName(data.profile?.fullName || "");
        setMobile(data.profile?.mobile || "");
        setIsEmailVerified(Boolean(data.profile?.isEmailVerified));
        setIsMobileVerified(Boolean(data.profile?.isMobileVerified));
        setAnonymousName(data.profile?.anonymousName || "Anonymous");
        setAnonymousMode(
          typeof data.profile?.anonymousMode === "boolean"
            ? data.profile.anonymousMode
            : true,
        );
      } catch (error) {
        setSaveStatus("error");
        setStatusMessage("Unable to load profile right now. Please retry.");
      }
    };

    loadProfile();
  }, []);

  async function saveProfile() {
    if (!fullName.trim()) {
      setSaveStatus("error");
      setStatusMessage("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setSaveStatus("error");
      setStatusMessage("Email is required.");
      return;
    }

    if (!mobile.trim()) {
      setSaveStatus("error");
      setStatusMessage("Mobile number is required.");
      return;
    }

    if (!email) {
      setSaveStatus("error");
      setStatusMessage("Please sign in again before saving your profile.");
      return;
    }

    setIsSaving(true);
    setSaveStatus("idle");
    setStatusMessage("");

    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim(),
            mobile: mobile.trim(),
            anonymousName: anonymousName.trim() || "Anonymous",
            anonymousMode,
          }),
        },
        API_BASE_URL,
      );

      if (response.status === 401) {
        setSaveStatus("error");
        setStatusMessage("Session expired. Please sign in again.");
        return;
      }

      if (!response.ok) {
        setSaveStatus("error");
        setStatusMessage("Failed to save profile. Please try again.");
        return;
      }

      setSaveStatus("success");
      setStatusMessage("Profile updated successfully.");
    } catch {
      setSaveStatus("error");
      setStatusMessage("Failed to save profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function requestEmailVerification() {
    setVerificationMessage("");
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/email/request-verification`,
        { method: "POST" },
        API_BASE_URL,
      );

      const data = await response.json();
      if (!response.ok) {
        setVerificationMessage(
          data.message || "Could not send verification email.",
        );
        return;
      }

      if (data.verificationLink) {
        setVerificationMessage(`Verification link: ${data.verificationLink}`);
      } else {
        setVerificationMessage("Verification email sent.");
      }
    } catch {
      setVerificationMessage("Could not send verification email.");
    }
  }

  async function requestMobileOtp() {
    setVerificationMessage("");
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/mobile/request-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ mobile: mobile.trim() }),
        },
        API_BASE_URL,
      );

      const data = await response.json();
      if (!response.ok) {
        setVerificationMessage(data.message || "Could not send OTP.");
        return;
      }

      setVerificationMessage(
        data.otp ? `OTP sent. Dev code: ${data.otp}` : "OTP sent successfully.",
      );
    } catch {
      setVerificationMessage("Could not send OTP.");
    }
  }

  async function verifyMobileOtp() {
    setVerificationMessage("");
    try {
      const response = await fetchWithAuth(
        `${API_BASE_URL}/api/mobile/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mobile: mobile.trim(),
            otp: mobileOtp.trim(),
          }),
        },
        API_BASE_URL,
      );

      const data = await response.json();
      if (!response.ok) {
        setVerificationMessage(data.message || "Could not verify mobile.");
        return;
      }

      setIsMobileVerified(true);
      setMobileOtp("");
      setVerificationMessage("Mobile number verified successfully.");
    } catch {
      setVerificationMessage("Could not verify mobile.");
    }
  }

  const initials = email ? email[0].toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f2740_0%,_#020617_55%)] p-6 md:p-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-100">
                Profile and Privacy
              </h1>
              <p className="mt-2 text-sm text-slate-400">
                Manage your identity settings and privacy preferences.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-sky-700 text-lg font-bold text-white">
                {initials}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">
                  {anonymousName || "Anonymous"}
                </p>
                <p className="text-xs text-cyan-300 capitalize">{role}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl md:grid-cols-2 md:p-8">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4 md:col-span-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              placeholder="Enter your full name"
            />
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Email
            </p>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              placeholder="you@example.com"
            />
            <p className="mt-2 text-xs text-slate-300">
              Status: {isEmailVerified ? "Verified" : "Not verified"}
            </p>
            {!isEmailVerified ? (
              <button
                type="button"
                onClick={requestEmailVerification}
                className="mt-2 rounded-lg border border-cyan-500 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
              >
                Verify Email
              </button>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Mobile
            </p>
            <input
              type="tel"
              value={mobile}
              onChange={(event) => setMobile(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              placeholder="+91XXXXXXXXXX"
            />
            <p className="mt-2 text-xs text-slate-300">
              Status: {isMobileVerified ? "Verified" : "Not verified"}
            </p>
            {!isMobileVerified ? (
              <div className="mt-2 space-y-2">
                <button
                  type="button"
                  onClick={requestMobileOtp}
                  className="rounded-lg border border-cyan-500 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/10"
                >
                  Send OTP
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={mobileOtp}
                    onChange={(event) => setMobileOtp(event.target.value)}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter OTP"
                    className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={verifyMobileOtp}
                    className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-600"
                  >
                    Verify
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Role
            </p>
            <p className="mt-1 text-sm font-medium capitalize text-slate-100">
              {role}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/50 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Anonymized User ID
            </p>
            <p className="mt-1 break-all text-sm font-medium text-slate-100">
              {anonymizedUserId || "Unavailable"}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-wide text-emerald-300">
              Data Privacy
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-200">
              End-to-end encrypted
            </p>
          </div>
          {verificationMessage ? (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-200 md:col-span-2">
              {verificationMessage}
            </div>
          ) : null}
          <div className="md:col-span-2">
            <button
              type="button"
              onClick={saveProfile}
              disabled={isSaving}
              className="w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
            {statusMessage ? (
              <p
                className={`mt-2 text-sm ${
                  saveStatus === "error" ? "text-red-400" : "text-cyan-300"
                }`}
              >
                {statusMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-5 rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <h2 className="text-xl font-semibold text-slate-100">
            Privacy Preferences
          </h2>

          <div>
            <label
              htmlFor="anonymousName"
              className="mb-2 block text-xs uppercase tracking-wide text-slate-400"
            >
              Anonymous Display Name
            </label>
            <input
              id="anonymousName"
              type="text"
              value={anonymousName}
              onChange={(event) => setAnonymousName(event.target.value)}
              maxLength={80}
              className="w-full rounded-2xl border border-slate-600 bg-slate-800/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-500"
              placeholder="Anonymous"
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-600 bg-slate-800/60 px-4 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Anonymous Mode
              </p>
              <p className="text-xs text-slate-400">
                Hide personal identity in user-facing contexts.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAnonymousMode((prev) => !prev)}
              className={`relative h-7 w-12 rounded-full transition ${
                anonymousMode ? "bg-cyan-600" : "bg-slate-600"
              }`}
              aria-pressed={anonymousMode}
              aria-label="Toggle anonymous mode"
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
                  anonymousMode ? "left-6" : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <button
              type="button"
              onClick={saveProfile}
              disabled={isSaving}
              className="w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>

            {statusMessage ? (
              <p
                className={`text-sm ${
                  saveStatus === "error" ? "text-red-400" : "text-cyan-300"
                }`}
              >
                {statusMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-3 rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <Link
            href="/avatar"
            className="block w-full rounded-2xl bg-violet-700 px-4 py-3 text-center text-sm font-semibold transition hover:bg-violet-600"
          >
            Manage Avatar
          </Link>
          <button className="w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-semibold transition hover:bg-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-500">
            Change Password
          </button>
          <button className="w-full rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold transition hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-500">
            Download My Data
          </button>
          <button className="w-full rounded-2xl bg-red-700/80 px-4 py-3 text-sm font-semibold transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500">
            Delete Account
          </button>
        </section>

        {/* Privacy Dashboard */}
        <section className="rounded-3xl border border-slate-700/50 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl md:p-8">
          <h2 className="mb-4 text-lg font-bold text-slate-100">
            🔒 Privacy Dashboard
          </h2>

          <div className="space-y-4">
            {/* Encryption Status */}
            <div className="rounded-2xl border border-emerald-700/40 bg-emerald-900/10 p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-lg">🛡️</span>
                <h3 className="text-sm font-semibold text-emerald-300">
                  Encryption Status
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-300">Data at rest: AES-256</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-300">
                    Data in transit: TLS 1.3
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-300">Mood data: Encrypted</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="text-slate-300">
                    Chat history: Encrypted
                  </span>
                </div>
              </div>
            </div>

            {/* Data Categories */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">
                Your Data Categories
              </h3>
              <div className="space-y-2">
                {[
                  {
                    label: "Profile Information",
                    icon: "👤",
                    desc: "Name, email, preferences",
                  },
                  {
                    label: "Mood Entries",
                    icon: "💙",
                    desc: "Daily logs, emotions, notes",
                  },
                  {
                    label: "Chat History",
                    icon: "💬",
                    desc: "AI companion conversations",
                  },
                  {
                    label: "Activity Data",
                    icon: "🎮",
                    desc: "Game scores, session times",
                  },
                  {
                    label: "Avatar Settings",
                    icon: "🧑‍🎨",
                    desc: "Customization preferences",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl bg-slate-900/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{item.icon}</span>
                      <div>
                        <p className="text-xs font-medium text-slate-200">
                          {item.label}
                        </p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400">🔒</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GDPR / Rights */}
            <div className="rounded-2xl border border-cyan-700/30 bg-cyan-900/10 p-4">
              <h3 className="text-sm font-semibold text-cyan-300 mb-2">
                Your Privacy Rights
              </h3>
              <ul className="space-y-1 text-xs text-slate-400">
                <li>✓ Right to access — download all your data anytime</li>
                <li>✓ Right to deletion — permanently delete your account</li>
                <li>
                  ✓ Right to portability — export data in standard formats
                </li>
                <li>
                  ✓ Right to rectification — edit your personal information
                </li>
                <li>✓ Right to restrict — use anonymous mode</li>
              </ul>
            </div>

            {/* Data Retention */}
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/40 p-4">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">
                Data Retention
              </h3>
              <p className="text-xs text-slate-400">
                Your data is stored only while your account is active. Upon
                deletion, all data is permanently removed within 30 days. No
                data is shared with third parties.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
