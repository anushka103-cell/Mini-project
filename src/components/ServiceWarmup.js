"use client";

import { useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Two-phase background service keep-alive:
 *
 * Phase 1 — Aggressive warmup (first ~90 s).
 *   Pings /warmup every 5 s until the API gateway responds.  The gateway
 *   itself may be sleeping on Render free-tier, so a single call fails.
 *
 * Phase 2 — Keep-alive heartbeat (every 13 min, indefinitely).
 *   Render free-tier sleeps after 15 min of inactivity.  By pinging every
 *   13 min we guarantee services stay awake as long as any user has a tab
 *   open.  When the last tab closes the pings stop and services naturally
 *   go to sleep, costing nothing.
 */
export default function ServiceWarmup() {
  useEffect(() => {
    let cancelled = false;
    let keepAliveTimer = null;

    const ping = () =>
      fetch(`${API_BASE_URL}/warmup`, {
        method: "GET",
        cache: "no-store",
      });

    // Phase 1: aggressive retry until gateway is up
    (async () => {
      const start = Date.now();
      const BUDGET = 90_000;
      const INTERVAL = 5_000;

      while (!cancelled && Date.now() - start < BUDGET) {
        try {
          const res = await ping();
          if (res.ok) break;
        } catch {
          // gateway still waking
        }
        await new Promise((r) => setTimeout(r, INTERVAL));
      }

      // Phase 2: keep-alive heartbeat every 13 min
      if (!cancelled) {
        const KEEP_ALIVE_MS = 13 * 60 * 1000; // 13 minutes
        keepAliveTimer = setInterval(() => {
          ping().catch(() => {});
        }, KEEP_ALIVE_MS);
      }
    })();

    return () => {
      cancelled = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    };
  }, []);

  return null;
}
