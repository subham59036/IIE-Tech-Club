/**
 * GET /api/cron/cleanup
 * ─────────────────────────────────────────────────────────────────────────────
 * Called by Vercel Cron (see vercel.json) daily at 02:00 UTC.
 * Protected by CRON_SECRET header to prevent unauthorised triggering.
 *
 * ► CHANGE: Set CRON_SECRET in .env.local to a random string.
 *   Add to vercel.json:
 *   {
 *     "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 2 * * *" }]
 *   }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { runCleanup }                from "@/lib/db";

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret header
  const secret = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  try {
    await runCleanup();
    return NextResponse.json({ ok: true, message: "Cleanup completed." });
  } catch (err) {
    console.error("[cron/cleanup]", err);
    return NextResponse.json({ ok: false, error: "Cleanup failed." }, { status: 500 });
  }
}
