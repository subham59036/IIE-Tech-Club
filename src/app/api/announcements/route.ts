/**
 * GET    /api/announcements  – All announcements (newest first), auth required
 * POST   /api/announcements  – Create announcement (admin only)
 * DELETE /api/announcements?id=N – Delete by id (admin only)
 */

import { NextRequest, NextResponse }       from "next/server";
import { getSession }                      from "@/lib/auth";
import { db, adminExists, notifyAdmins }   from "@/lib/db";
import { sanitize, formatTs }              from "@/lib/utils";

async function guardAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await adminExists(s.id)) ? s : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const result = await db.execute(`
    SELECT a.id, a.title, a.description, a.announced_date, a.created_at,
           adm.name AS posted_by_name
    FROM   announcements a
    JOIN   admins adm ON adm.id = a.posted_by_admin
    ORDER  BY a.created_at DESC
  `);

  return NextResponse.json({ ok: true, data: result.rows });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { title, description, announcedDate } = await req.json() as {
    title: string; description: string; announcedDate: string;
  };

  if (!title?.trim() || !description?.trim() || !announcedDate) {
    return NextResponse.json({ ok: false, error: "title, description and announcedDate are required." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(announcedDate)) {
    return NextResponse.json({ ok: false, error: "announcedDate must be YYYY-MM-DD." }, { status: 400 });
  }

  const r = await db.execute({
    sql:  "INSERT INTO announcements (title, description, announced_date, posted_by_admin) VALUES (?,?,?,?) RETURNING id",
    args: [sanitize(title), sanitize(description), announcedDate, session.id],
  });

  await notifyAdmins(
    `New announcement "${sanitize(title)}" posted by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true, data: { id: (r.rows[0] as { id: number }).id } }, { status: 201 });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ ok: false, error: "id param required." }, { status: 400 });

  const existing = await db.execute({ sql: "SELECT title FROM announcements WHERE id=?", args: [id] });
  if (!existing.rows.length) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const { title } = existing.rows[0] as { title: string };

  await db.execute({ sql: "DELETE FROM announcements WHERE id=?", args: [id] });

  await notifyAdmins(
    `Announcement "${title}" deleted by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}
