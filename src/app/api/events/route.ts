/**
 * GET  /api/events  – Fetch the most recent event (both roles)
 * POST /api/events  – Create new event (admin only; rejected if active event exists)
 */

import { NextRequest, NextResponse }     from "next/server";
import { v4 as uuid }                    from "uuid";
import { getSession }                    from "@/lib/auth";
import { db, adminExists, notifyAdmins } from "@/lib/db";
import { sanitize, formatTs, todayUtc }  from "@/lib/utils";

async function guardAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await adminExists(s.id)) ? s : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  // Fetch the single most recent event
  const result = await db.execute(`
    SELECT e.id, e.title, e.description, e.event_date, e.last_reg_date,
           e.status, e.form_token, e.created_at,
           adm.name AS posted_by_name,
           COUNT(er.id) AS registration_count
    FROM   events e
    JOIN   admins adm ON adm.id = e.posted_by_admin
    LEFT   JOIN event_registrations er ON er.event_id = e.id
    GROUP  BY e.id
    ORDER  BY e.created_at DESC
    LIMIT  1
  `);

  if (!result.rows.length) return NextResponse.json({ ok: true, data: null });

  const row = result.rows[0] as {
    id: number; title: string; description: string; event_date: string;
    last_reg_date: string; status: string; form_token: string;
    created_at: number; posted_by_name: string; registration_count: number;
  };

  // Compute is_expired (today > last_reg_date)
  const is_expired = todayUtc() > row.last_reg_date;

  // Students only see limited info
  if (session.role === "student") {
    return NextResponse.json({
      ok: true,
      data: {
        title:         row.title,
        description:   row.description,
        event_date:    row.event_date,
        last_reg_date: row.last_reg_date,
        status:        row.status,
        is_expired,
      },
    });
  }

  return NextResponse.json({ ok: true, data: { ...row, is_expired } });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  // Only one event at a time: check if a non-expired event exists
  const existing = await db.execute(
    "SELECT id, last_reg_date FROM events ORDER BY created_at DESC LIMIT 1"
  );
  if (existing.rows.length) {
    const ev = existing.rows[0] as { last_reg_date: string };
    if (todayUtc() <= ev.last_reg_date) {
      return NextResponse.json({ ok: false, error: "An active event already exists. Delete or wait until it expires before creating a new one." }, { status: 409 });
    }
  }

  const { title, description, eventDate, lastRegDate } = await req.json() as {
    title: string; description: string; eventDate: string; lastRegDate: string;
  };

  if (!title || !description || !eventDate || !lastRegDate) {
    return NextResponse.json({ ok: false, error: "All fields are required." }, { status: 400 });
  }
  if (lastRegDate > eventDate) {
    return NextResponse.json({ ok: false, error: "Registration deadline cannot be after event date." }, { status: 400 });
  }

  const token = uuid().replace(/-/g, "");

  const r = await db.execute({
    sql:  "INSERT INTO events (title, description, event_date, last_reg_date, form_token, posted_by_admin) VALUES (?,?,?,?,?,?) RETURNING id",
    args: [sanitize(title), sanitize(description), eventDate, lastRegDate, token, session.id],
  });

  await notifyAdmins(
    `Event "${sanitize(title)}" (date: ${eventDate}) was created by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({
    ok:   true,
    data: { id: (r.rows[0] as { id: number }).id, form_token: token },
  }, { status: 201 });
}
