/**
 * GET /api/events/public?token=XYZ
 * ─────────────────────────────────────────────────────────────────────────────
 * Public — no authentication required.
 * Returns only title, description, status, and last_reg_date of the event.
 * Used by the public registration form page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { db }                        from "@/lib/db";
import { todayUtc }                  from "@/lib/utils";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ ok: false, error: "token required." }, { status: 400 });

  const result = await db.execute({
    sql:  "SELECT id, title, description, event_date, last_reg_date, status FROM events WHERE form_token=?",
    args: [token],
  });

  if (!result.rows.length) {
    return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
  }

  const ev = result.rows[0] as unknown as {
    id: number; title: string; description: string;
    event_date: string; last_reg_date: string; status: string;
  };

  return NextResponse.json({
    ok:   true,
    data: {
      id:            ev.id,
      title:         ev.title,
      description:   ev.description,
      event_date:    ev.event_date,
      last_reg_date: ev.last_reg_date,
      status:        ev.status,
      is_expired:    todayUtc() > ev.last_reg_date,
    },
  });
}
