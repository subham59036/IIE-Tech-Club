/**
 * GET    /api/announcements  – All announcements (newest first), auth required
 * POST   /api/announcements  – Create announcement (admin only)
 * DELETE /api/announcements?id=N – Delete by id (admin only)
 *
 * The original query JOINed announcements + admins.
 * We fetch announcements first, then look up poster names from dbAdmins.
 */

import { NextRequest, NextResponse }                    from "next/server";
import { getSession }                                   from "@/lib/auth";
import { dbAnnouncements, dbAdmins, adminExists, notifyAdmins } from "@/lib/db";
import { sanitize, formatTs }                           from "@/lib/utils";

async function guardAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await adminExists(s.id)) ? s : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const result = await dbAnnouncements.execute(
    "SELECT id, title, description, announced_date, posted_by_admin, created_at FROM announcements ORDER BY created_at DESC"
  );

  const rows = result.rows as unknown as {
    id: number; title: string; description: string;
    announced_date: string; posted_by_admin: number; created_at: number;
  }[];

  // Fetch admin names for all unique poster IDs
  const adminIds = [...new Set(rows.map((r) => r.posted_by_admin))];
  let admMap = new Map<number, string>();
  if (adminIds.length > 0) {
    const placeholders = adminIds.map(() => "?").join(",");
    const admResult = await dbAdmins.execute({
      sql:  `SELECT id, name FROM admins WHERE id IN (${placeholders})`,
      args: adminIds,
    });
    admMap = new Map(
      (admResult.rows as unknown as { id: number; name: string }[]).map((a) => [a.id, a.name])
    );
  }

  const data = rows.map((r) => ({
    id:             r.id,
    title:          r.title,
    description:    r.description,
    announced_date: r.announced_date,
    posted_by_name: admMap.get(r.posted_by_admin) ?? "Unknown",
    created_at:     r.created_at,
  }));

  return NextResponse.json({ ok: true, data });
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

  const r = await dbAnnouncements.execute({
    sql:  "INSERT INTO announcements (title, description, announced_date, posted_by_admin) VALUES (?,?,?,?) RETURNING id",
    args: [sanitize(title), sanitize(description), announcedDate, session.id],
  });

  await notifyAdmins(
    `New announcement "${sanitize(title)}" posted by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true, data: { id: (r.rows[0] as unknown as { id: number }).id } }, { status: 201 });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ ok: false, error: "id param required." }, { status: 400 });

  const existing = await dbAnnouncements.execute({ sql: "SELECT title FROM announcements WHERE id=?", args: [id] });
  if (!existing.rows.length) return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  const { title } = existing.rows[0] as unknown as { title: string };

  await dbAnnouncements.execute({ sql: "DELETE FROM announcements WHERE id=?", args: [id] });

  await notifyAdmins(
    `Announcement "${title}" deleted by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}
