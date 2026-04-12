/**
 * GET  /api/events  – Fetch the most recent event (both roles)
 * POST /api/events  – Create new event (admin only; rejected if active event exists)
 *
 * The original query JOINed events + admins + event_registrations.
 * We fetch each from its own Neon project and merge in JS.
 */

import { NextRequest, NextResponse }                from "next/server";
import { v4 as uuid }                               from "uuid";
import { getSession }                               from "@/lib/auth";
import { dbEvents, dbAdmins, dbEventRegs, adminExists, notifyAdmins } from "@/lib/db";
import { sanitize, formatTs, todayUtc }             from "@/lib/utils";

async function guardAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await adminExists(s.id)) ? s : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  // Fetch most recent event
  const result = await dbEvents.execute(
    "SELECT id, title, description, event_date, last_reg_date, status, form_token, posted_by_admin, created_at FROM events ORDER BY created_at DESC LIMIT 1"
  );

  if (!result.rows.length) return NextResponse.json({ ok: true, data: null });

  const row = result.rows[0] as unknown as {
    id: number; title: string; description: string; event_date: string;
    last_reg_date: string; status: string; form_token: string;
    posted_by_admin: number; created_at: number;
  };

  const is_expired = todayUtc() > row.last_reg_date;

  // Students see limited info — no DB lookups needed
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

  // Fetch poster name and registration count in parallel
  const [admResult, regResult] = await Promise.all([
    dbAdmins.execute({ sql: "SELECT name FROM admins WHERE id=?", args: [row.posted_by_admin] }),
    dbEventRegs.execute({ sql: "SELECT COUNT(*) AS cnt FROM event_registrations WHERE event_id=?", args: [row.id] }),
  ]);

  const posted_by_name    = (admResult.rows[0] as unknown as { name: string } | undefined)?.name ?? "Unknown";
  const registration_count = Number((regResult.rows[0] as unknown as { cnt: number | string }).cnt ?? 0);

  return NextResponse.json({
    ok:   true,
    data: { ...row, posted_by_name, registration_count, is_expired },
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  // Only one event at a time
  const existing = await dbEvents.execute(
    "SELECT id, last_reg_date FROM events ORDER BY created_at DESC LIMIT 1"
  );
  if (existing.rows.length) {
    const ev = existing.rows[0] as unknown as { last_reg_date: string };
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

  const r = await dbEvents.execute({
    sql:  "INSERT INTO events (title, description, event_date, last_reg_date, form_token, posted_by_admin) VALUES (?,?,?,?,?,?) RETURNING id",
    args: [sanitize(title), sanitize(description), eventDate, lastRegDate, token, session.id],
  });

  await notifyAdmins(
    `Event "${sanitize(title)}" (date: ${eventDate}) was created by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({
    ok:   true,
    data: { id: (r.rows[0] as unknown as { id: number }).id, form_token: token },
  }, { status: 201 });
}
