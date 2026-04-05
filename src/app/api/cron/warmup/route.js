/**
 * Vercel API route: GET /api/cron/warmup
 *
 * Pings the Render API gateway's /warmup endpoint which in turn wakes all
 * microservices.  Point an external free cron service (e.g. cron-job.org,
 * UptimeRobot, or Freshping) at this URL every 14 minutes to prevent
 * Render free-tier services from sleeping.
 *
 * URL to register: https://mind-safe-tan.vercel.app/api/cron/warmup
 */

export const dynamic = "force-dynamic"; // never cache
export const maxDuration = 120; // allow up to 120 s on Vercel (Hobby limit)

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100_000);

    const res = await fetch(`${API_BASE_URL}/warmup`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await res.json().catch(() => ({}));
    return Response.json(
      { ok: true, backend: data },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: err?.message || "warmup failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
