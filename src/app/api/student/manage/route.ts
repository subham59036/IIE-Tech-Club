/**
 * GET  /api/student/manage  – List all students
 * POST /api/student/manage  – Add a new student
 */

import { NextRequest, NextResponse }                          from "next/server";
import { getSession }                                         from "@/lib/auth";
import { dbStudents, adminExists, notifyAdmins, notifyStudent } from "@/lib/db";
import { isValidStudentId, sanitize, formatTs }               from "@/lib/utils";

async function guard() {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return (await adminExists(session.id)) ? session : null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await guard();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const result = await dbStudents.execute(
    "SELECT id, name, student_id, (password_hash IS NOT NULL) AS has_password, created_at FROM students ORDER BY student_id"
  );
  return NextResponse.json({ ok: true, data: result.rows });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guard();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { name, studentId } = await req.json() as { name: string; studentId: string };

  if (!name?.trim() || !studentId?.trim()) {
    return NextResponse.json({ ok: false, error: "Name and Student ID are required." }, { status: 400 });
  }
  if (!isValidStudentId(studentId)) {
    return NextResponse.json({ ok: false, error: "Student ID must be in format S001, S002, …" }, { status: 400 });
  }

  const exists = await dbStudents.execute({ sql: "SELECT id FROM students WHERE student_id = ?", args: [studentId] });
  if (exists.rows.length > 0) {
    return NextResponse.json({ ok: false, error: `Student ID ${studentId} is already in use.` }, { status: 409 });
  }

  const r = await dbStudents.execute({
    sql:  "INSERT INTO students (name, student_id) VALUES (?,?) RETURNING id",
    args: [sanitize(name), studentId],
  });
  const newId = (r.rows[0] as unknown as { id: number }).id;

  await notifyAdmins(
    `Student "${sanitize(name)}" (${studentId}) was added by ${session.name} (${session.userId}) at ${formatTs(Date.now())}.`
  );
  await notifyStudent(newId,
    `Welcome! You were added to TechOS by ${session.name} (${session.userId}) at ${formatTs(Date.now())}. Please log in and set your password.`
  );

  return NextResponse.json({ ok: true, data: { id: newId, name, studentId } }, { status: 201 });
}
