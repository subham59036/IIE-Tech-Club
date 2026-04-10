/**
 * GET /api/notifications
 * Returns notifications for the current user:
 *   – admin  → admin_notifications (global)
 *   – student → student_notifications where student_db_id = session.id
 *
 * DELETE /api/notifications?id=N  (mark read / delete own notification)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { db, adminExists }           from "@/lib/db";

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  // Admin force-logout guard
  if (session.role === "admin" && !(await adminExists(session.id))) {
    return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });
  }

  let result;
  if (session.role === "admin") {
    result = await db.execute(
      "SELECT id, message, created_at FROM admin_notifications ORDER BY created_at DESC LIMIT 100"
    );
  } else {
    result = await db.execute({
      sql:  "SELECT id, message, created_at FROM student_notifications WHERE student_db_id=? ORDER BY created_at DESC LIMIT 100",
      args: [session.id],
    });
  }

  return NextResponse.json({ ok: true, data: result.rows });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return NextResponse.json({ ok: false, error: "id required." }, { status: 400 });

  if (session.role === "admin") {
    await db.execute({ sql: "DELETE FROM admin_notifications WHERE id=?", args: [id] });
  } else {
    // Students may only delete their own notifications
    await db.execute({
      sql:  "DELETE FROM student_notifications WHERE id=? AND student_db_id=?",
      args: [id, session.id],
    });
  }

  return NextResponse.json({ ok: true });
}
