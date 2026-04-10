/**
 * GET /api/auth/me
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight session probe. Returns the current user's role, name and userId
 * from the JWT cookie — does NOT hit the database.
 *
 * Used by the middleware-free client-side bootstrap in dashboard pages to
 * quickly confirm the session is still valid before the first real API call.
 *
 * For the force-logout check (admin removed mid-session) the dashboards use
 * /api/profile which does hit the DB. This route is just for the initial
 * "am I logged in?" check that populates the header.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextResponse } from "next/server";
import { getSession }   from "@/lib/auth";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated.", forceLogout: true },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok:   true,
    data: {
      id:     session.id,
      role:   session.role,
      name:   session.name,
      userId: session.userId,
    },
  });
}
