/**
 * PUT    /api/student/manage/[id]  – Update student name / ID / password
 * DELETE /api/student/manage/[id]  – Remove a student
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt                         from "bcryptjs";
import { getSession }                 from "@/lib/auth";
import { db, adminExists, notifyAdmins, notifyStudent } from "@/lib/db";
import { isValidStudentId, sanitize, formatTs }          from "@/lib/utils";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return (await adminExists(session.id)) ? session : null;
}

// ─── PUT ──────────────────────────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: Params) {
  const session = await guard();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { id }   = await params;
  const targetId = parseInt(id, 10);
  const { name, studentId, password } = await req.json() as {
    name?: string; studentId?: string; password?: string;
  };

  const existing = await db.execute({ sql: "SELECT * FROM students WHERE id = ?", args: [targetId] });
  if (existing.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });
  }
  const old = existing.rows[0] as { name: string; student_id: string };

  if (studentId && studentId !== old.student_id) {
    if (!isValidStudentId(studentId)) {
      return NextResponse.json({ ok: false, error: "Student ID must be in format S001, S002, …" }, { status: 400 });
    }
    const clash = await db.execute({ sql: "SELECT id FROM students WHERE student_id = ? AND id != ?", args: [studentId, targetId] });
    if (clash.rows.length > 0) {
      return NextResponse.json({ ok: false, error: `Student ID ${studentId} is already in use.` }, { status: 409 });
    }
  }

  const fields: string[] = [];
  const args: (string | number)[] = [];

  if (name)      { fields.push("name = ?");       args.push(sanitize(name)); }
  if (studentId) { fields.push("student_id = ?"); args.push(studentId); }
  if (password)  {
    const hash = await bcrypt.hash(password, 12);
    fields.push("password_hash = ?");
    args.push(hash);
  }

  if (!fields.length) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });

  args.push(targetId);
  await db.execute({ sql: `UPDATE students SET ${fields.join(", ")} WHERE id = ?`, args });

  await notifyAdmins(
    `Student "${old.name}" (${old.student_id}) was updated by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await guard();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { id }   = await params;
  const targetId = parseInt(id, 10);

  const existing = await db.execute({ sql: "SELECT name, student_id FROM students WHERE id = ?", args: [targetId] });
  if (existing.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });
  }
  const target = existing.rows[0] as { name: string; student_id: string };

  // Store notification for student BEFORE deleting (cascade will delete student_notifications)
  // We send an admin notification instead, since the student record will be gone
  await db.execute({ sql: "DELETE FROM students WHERE id = ?", args: [targetId] });

  await notifyAdmins(
    `Student "${target.name}" (${target.student_id}) was removed by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );

  return NextResponse.json({ ok: true });
}
