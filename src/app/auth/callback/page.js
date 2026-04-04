"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveTokens, clearTokens } from "@/lib/authClient";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const refreshToken = searchParams.get("refreshToken");
    const error = searchParams.get("error");

    if (token) {
      saveTokens(token, refreshToken, "15m");
      router.replace("/dashboard");
      return;
    }

    // Redirect to login with a readable error message
    const errorMap = {
      google_oauth_denied: "You cancelled the Google sign-in.",
      google_token_failed:
        "Google could not verify your account. Please try again.",
      google_no_email: "Your Google account did not share an email address.",
      google_oauth_error: "An unexpected error occurred with Google sign-in.",
    };

    const msg = errorMap[error] || "Google sign-in failed. Please try again.";
    clearTokens();
    router.replace(`/login?error=${encodeURIComponent(msg)}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Completing sign-in...</p>
      </div>
    </div>
  );
}
