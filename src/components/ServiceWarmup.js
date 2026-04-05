"use client";

import { useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Fires a background warmup request that retries until it reaches the API
 * gateway.  The gateway itself may be sleeping on Render free-tier, so a
 * single fire-and-forget call often fails silently.  Retrying every 5 s
 * for up to 90 s ensures the gateway (and the microservices it pings)
 * actually wake up before the user navigates to a feature.
 */
export default function ServiceWarmup() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const start = Date.now();
      const BUDGET = 90_000; // 90 s total
      const INTERVAL = 5_000; // retry every 5 s

      while (!cancelled && Date.now() - start < BUDGET) {
        try {
          const res = await fetch(`${API_BASE_URL}/warmup`, {
            method: "GET",
            cache: "no-store",
          });
          if (res.ok) break; // gateway is alive and pinged microservices
        } catch {
          // network error — gateway still waking, retry
        }
        await new Promise((r) => setTimeout(r, INTERVAL));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
