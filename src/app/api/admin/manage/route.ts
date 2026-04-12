/**
 * GET  /api/admin/manage  – List all admins
 * POST /api/admin/manage  – Add a new admin
 *
 * Only accessible by authenticated admins.
 * Every action validates that the requesting admin still exists (force-logout guard).
 */

import { NextRequest, NextResponse }              from "next/server";
import { getSession }                             from "@/lib/auth";
import { dbAdmins, adminExists, notifyAdmins }    from "@/lib/db";
import { isValidAdminId, sanitize, formatTs }     from "@/lib/utils";

async function guard(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  const active  = await adminExists(session.id);
  return active ? session : null;
}

// ─── GET: list all admins ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await guard(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const result = await dbAdmins.execute(
    "SELECT id, name, admin_id, (password_hash IS NOT NULL) AS has_password, created_at FROM admins ORDER BY admin_id"
  );

  return NextResponse.json({ ok: true, data: result.rows });
}

// ─── POST: add new admin ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guard(req);
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { name, adminId } = await req.json() as { name: string; adminId: string };

  if (!name?.trim() || !adminId?.trim()) {
    return NextResponse.json({ ok: false, error: "Name and Admin ID are required." }, { status: 400 });
  }
  if (!isValidAdminId(adminId)) {
    return NextResponse.json({ ok: false, error: "Admin ID must be in format A001, A002, …" }, { status: 400 });
  }

  const exists = await dbAdmins.execute({ sql: "SELECT id FROM admins WHERE admin_id = ?", args: [adminId] });
  if (exists.rows.length > 0) {
    return NextResponse.json({ ok: false, error: `Admin ID ${adminId} is already in use.` }, { status: 409 });
  }

  const r = await dbAdmins.execute({
    sql:  "INSERT INTO admins (name, admin_id) VALUES (?,?) RETURNING id",
    args: [sanitize(name), adminId],
  });

  const newId = (r.rows[0] as unknown as { id: number }).id;

  await notifyAdmins(
    `Admin "${sanitize(name)}" (${adminId}) was added by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true, data: { id: newId, name, adminId } }, { status: 201 });
}
