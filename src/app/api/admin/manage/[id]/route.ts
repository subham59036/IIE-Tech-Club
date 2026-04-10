/**
 * PUT    /api/admin/manage/[id]  – Update admin name / ID / password
 * DELETE /api/admin/manage/[id]  – Remove an admin
 *
 * [id] = DB primary-key integer of the target admin.
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt                         from "bcryptjs";
import { getSession }                 from "@/lib/auth";
import { db, adminExists, notifyAdmins } from "@/lib/db";
import { isValidAdminId, sanitize, formatTs } from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  const active  = await adminExists(session.id);
  return active ? session : null;
}

// ─── PUT: update admin ────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await guard();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { id }  = await params;
  const targetId = parseInt(id, 10);
  const { name, adminId, password } = await req.json() as {
    name?: string; adminId?: string; password?: string;
  };

  // Fetch existing record
  const existing = await db.execute({ sql: "SELECT * FROM admins WHERE id = ?", args: [targetId] });
  if (existing.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Admin not found." }, { status: 404 });
  }
  const old = existing.rows[0] as unknown as { name: string; admin_id: string };

  // Validate new ID uniqueness
  if (adminId && adminId !== old.admin_id) {
    if (!isValidAdminId(adminId)) {
      return NextResponse.json({ ok: false, error: "Admin ID must be in format A001, A002, …" }, { status: 400 });
    }
    const clash = await db.execute({ sql: "SELECT id FROM admins WHERE admin_id = ? AND id != ?", args: [adminId, targetId] });
    if (clash.rows.length > 0) {
      return NextResponse.json({ ok: false, error: `Admin ID ${adminId} is already in use.` }, { status: 409 });
    }
  }

  // Build update fields
  const fields: string[] = [];
  const args: (string | number)[] = [];

  if (name)    { fields.push("name = ?");     args.push(sanitize(name)); }
  if (adminId) { fields.push("admin_id = ?"); args.push(adminId); }
  if (password) {
    const hash = await bcrypt.hash(password, 12);
    fields.push("password_hash = ?");
    args.push(hash);
  }

  if (fields.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  args.push(targetId);
  await db.execute({ sql: `UPDATE admins SET ${fields.join(", ")} WHERE id = ?`, args });

  await notifyAdmins(
    `Admin "${old.name}" (${old.admin_id}) was updated by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}

// ─── DELETE: remove admin ─────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await guard();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { id }   = await params;
  const targetId = parseInt(id, 10);

  // Prevent self-deletion
  if (targetId === session.id) {
    return NextResponse.json({ ok: false, error: "You cannot remove yourself." }, { status: 400 });
  }

  const existing = await db.execute({ sql: "SELECT name, admin_id FROM admins WHERE id = ?", args: [targetId] });
  if (existing.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Admin not found." }, { status: 404 });
  }
  const target = existing.rows[0] as unknown as { name: string; admin_id: string };

  await db.execute({ sql: "DELETE FROM admins WHERE id = ?", args: [targetId] });

  await notifyAdmins(
    `Admin "${target.name}" (${target.admin_id}) was removed by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}
