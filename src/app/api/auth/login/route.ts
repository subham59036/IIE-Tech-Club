/**
 * POST /api/auth/login
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles login for both admins and students.
 * If user has no password (first login), sets the supplied password.
 * Sets a JWT session cookie (7-day if rememberMe, session if not).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt                         from "bcryptjs";
import { dbAdmins, dbStudents }       from "@/lib/db";
import { setSessionCookie }           from "@/lib/auth";
import type { SessionUser }           from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { userId, password, rememberMe } = await req.json() as {
      userId:     string;
      password:   string;
      rememberMe: boolean;
    };

    if (!userId || !password) {
      return NextResponse.json({ ok: false, error: "ID and password are required." }, { status: 400 });
    }

    // ── Determine role from ID prefix ────────────────────────────────────────
    const isAdmin   = userId.startsWith("A");
    const isStudent = userId.startsWith("S");
    if (!isAdmin && !isStudent) {
      return NextResponse.json({ ok: false, error: "Invalid ID format." }, { status: 400 });
    }

    // ── Select the correct Neon project for this role ─────────────────────────
    const db    = isAdmin ? dbAdmins : dbStudents;
    const idCol = isAdmin ? "admin_id" : "student_id";

    // ── Fetch user record ─────────────────────────────────────────────────────
    const result = await db.execute({
      sql:  `SELECT id, name, ${idCol} AS user_id, password_hash FROM ${isAdmin ? "admins" : "students"} WHERE ${idCol} = ?`,
      args: [userId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const user = result.rows[0] as unknown as {
      id: number;
      name: string;
      user_id: string;
      password_hash: string | null;
    };

    // ── First-login: set password ─────────────────────────────────────────────
    if (!user.password_hash) {
      const hash = await bcrypt.hash(password, 12);
      await db.execute({
        sql:  `UPDATE ${isAdmin ? "admins" : "students"} SET password_hash = ? WHERE id = ?`,
        args: [hash, user.id],
      });
    } else {
      // ── Validate existing password ──────────────────────────────────────────
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
      }
    }

    // ── Issue JWT cookie ──────────────────────────────────────────────────────
    const sessionUser: SessionUser = {
      id:     user.id,
      role:   isAdmin ? "admin" : "student",
      name:   user.name,
      userId: user.user_id,
    };

    await setSessionCookie(sessionUser, !!rememberMe);

    return NextResponse.json({
      ok:   true,
      data: { role: sessionUser.role, name: sessionUser.name, userId: sessionUser.userId },
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
