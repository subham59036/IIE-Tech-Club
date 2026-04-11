/**
 * GET /api/profile  – Own profile data (name, ID, joined date)
 * PUT /api/profile  – Update name, ID, and/or password
 *
 * Works for both admins (A-prefix IDs) and students (S-prefix IDs).
 * ID change is rejected when the new ID conflicts with an existing record.
 *
 * Cookie re-issue: reads the rememberMe flag embedded in the current JWT
 * and preserves it — so a non-persistent login stays non-persistent after
 * a profile update, and a 7-day login stays 7-day.
 */

import { NextRequest, NextResponse }             from "next/server";
import bcrypt                                     from "bcryptjs";
import { getSession, createToken, getRememberMe, COOKIE_NAME } from "@/lib/auth";
import { cookies }                               from "next/headers";
import { db, adminExists }                       from "@/lib/db";
import { isValidAdminId, isValidStudentId, sanitize } from "@/lib/utils";

const SEVEN_DAYS = 7 * 24 * 60 * 60; // seconds

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised.", forceLogout: true },
      { status: 401 }
    );
  }

  // Admin force-logout guard
  if (session.role === "admin" && !(await adminExists(session.id))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised.", forceLogout: true },
      { status: 401 }
    );
  }

  const table = session.role === "admin" ? "admins"   : "students";
  const idCol = session.role === "admin" ? "admin_id" : "student_id";

  const result = await db.execute({
    sql:  `SELECT id, name, ${idCol} AS user_id, created_at FROM ${table} WHERE id = ?`,
    args: [session.id],
  });

  if (!result.rows.length) {
    return NextResponse.json(
      { ok: false, error: "User not found.", forceLogout: true },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, data: result.rows[0] });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised.", forceLogout: true },
      { status: 401 }
    );
  }

  if (session.role === "admin" && !(await adminExists(session.id))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorised.", forceLogout: true },
      { status: 401 }
    );
  }

  const body = await req.json() as {
    name?:     string;
    userId?:   string;
    password?: string;
  };
  const { name, userId, password } = body;

  const table = session.role === "admin" ? "admins"   : "students";
  const idCol = session.role === "admin" ? "admin_id" : "student_id";

  // ── Validate new ID ────────────────────────────────────────────────────────
  if (userId && userId !== session.userId) {
    const valid = session.role === "admin"
      ? isValidAdminId(userId)
      : isValidStudentId(userId);

    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Invalid ID format. Admins: A001–A999 · Students: S001–S999." },
        { status: 400 }
      );
    }

    const clash = await db.execute({
      sql:  `SELECT id FROM ${table} WHERE ${idCol} = ? AND id != ?`,
      args: [userId, session.id],
    });
    if (clash.rows.length > 0) {
      return NextResponse.json(
        { ok: false, error: `ID ${userId} is already in use.` },
        { status: 409 }
      );
    }
  }

  // ── Build update ───────────────────────────────────────────────────────────
  const fields: string[]            = [];
  const args:   (string | number)[] = [];

  if (name) {
    fields.push("name = ?");
    args.push(sanitize(name));
  }
  if (userId) {
    fields.push(`${idCol} = ?`);
    args.push(userId);
  }
  if (password) {
    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }
    fields.push("password_hash = ?");
    args.push(await bcrypt.hash(password, 12));
  }

  if (!fields.length) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  args.push(session.id);
  await db.execute({ sql: `UPDATE ${table} SET ${fields.join(", ")} WHERE id = ?`, args });

  // ── Re-issue JWT preserving the original rememberMe preference ────────────
  // Read rememberMe from the existing JWT so a session-only login stays
  // session-only and a persistent login stays persistent.
  const rememberMe = await getRememberMe();

  const updatedSession = {
    ...session,
    name:   name   ?? session.name,
    userId: userId ?? session.userId,
  };

  const token       = await createToken(updatedSession, rememberMe);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    // Only set maxAge if this was originally a persistent session
    ...(rememberMe ? { maxAge: SEVEN_DAYS } : {}),
  });

  return NextResponse.json({
    ok:   true,
    data: { name: updatedSession.name, userId: updatedSession.userId },
  });
}
