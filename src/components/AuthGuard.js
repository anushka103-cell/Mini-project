"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loadTokens, hasValidSession } from "@/lib/authClient";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/verify-email",
  "/auth/callback",
]);

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (PUBLIC_ROUTES.has(pathname)) {
      setIsAuthorized(true);
      return;
    }

    // Synchronous check — no async, no network calls, no race conditions.
    // hasValidSession allows through when a refresh token exists (even if
    // the access token is expired) because fetchWithAuth will silently
    // renew on the first API call.
    if (hasValidSession()) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
      router.replace("/login");
    }
  }, [pathname, router]);

  if (!isAuthorized) {
    return null;
  }

  return children;
}
