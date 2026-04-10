/**
 * PUT    /api/events/[id]  – Update event status or last_reg_date (admin only)
 * DELETE /api/events/[id]  – Delete event (admin only)
 */

import { NextRequest, NextResponse }     from "next/server";
import { getSession }                    from "@/lib/auth";
import { db, adminExists, notifyAdmins } from "@/lib/db";
import { formatTs, todayUtc }            from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function guardAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await adminExists(s.id)) ? s : null;
}

async function fetchEvent(id: number) {
  const r = await db.execute({ sql: "SELECT * FROM events WHERE id=?", args: [id] });
  return r.rows[0] as unknown as {
    id: number; title: string; last_reg_date: string; status: string;
  } | undefined;
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { id }  = await params;
  const eventId = parseInt(id, 10);
  const ev      = await fetchEvent(eventId);
  if (!ev) return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });

  // Disallow edits after expiry (only download is available then)
  const is_expired = todayUtc() > ev.last_reg_date;
  if (is_expired) {
    return NextResponse.json({ ok: false, error: "Event has expired; no edits allowed." }, { status: 400 });
  }

  const { status, lastRegDate } = await req.json() as {
    status?: "live" | "paused"; lastRegDate?: string;
  };

  const fields: string[] = [];
  const args: (string | number)[] = [];

  if (status && ["live","paused"].includes(status)) {
    fields.push("status=?"); args.push(status);
  }
  if (lastRegDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastRegDate)) {
      return NextResponse.json({ ok: false, error: "lastRegDate must be YYYY-MM-DD." }, { status: 400 });
    }
    fields.push("last_reg_date=?"); args.push(lastRegDate);
  }

  if (!fields.length) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });

  args.push(eventId);
  await db.execute({ sql: `UPDATE events SET ${fields.join(",")} WHERE id=?`, args });

  const changeDesc = [
    status      ? `status → ${status}`           : null,
    lastRegDate ? `last reg date → ${lastRegDate}`: null,
  ].filter(Boolean).join(", ");

  await notifyAdmins(
    `Event "${ev.title}" was updated (${changeDesc}) by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { id }  = await params;
  const eventId = parseInt(id, 10);
  const ev      = await fetchEvent(eventId);
  if (!ev) return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });

  await db.execute({ sql: "DELETE FROM events WHERE id=?", args: [eventId] });

  await notifyAdmins(
    `Event "${ev.title}" was deleted by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}
