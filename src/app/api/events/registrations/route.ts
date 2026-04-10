/**
 * GET /api/events/registrations?eventId=N
 * Returns all registrations for a given event (admin only).
 * Used by the PDF download button in EventsTab.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { db, adminExists }           from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });
  }
  if (!(await adminExists(session.id))) {
    return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });
  }

  const eventId = parseInt(req.nextUrl.searchParams.get("eventId") ?? "", 10);
  if (!eventId) return NextResponse.json({ ok: false, error: "eventId required." }, { status: 400 });

  const result = await db.execute({
    sql:  "SELECT student_name, semester, department, roll, created_at FROM event_registrations WHERE event_id=? ORDER BY created_at",
    args: [eventId],
  });

  return NextResponse.json({ ok: true, data: result.rows });
}
