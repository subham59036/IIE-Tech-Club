/**
 * GET  /api/attendance?month=YYYY-MM            – All attendance for a month
 * GET  /api/attendance?month=YYYY-MM&studentId=N – Specific student's records
 * POST /api/attendance                           – Upsert an attendance record (admin only)
 *
 * The original query joined attendance + students + admins.
 * Since each table is now in a separate Neon project, we fetch from each
 * database independently and merge the result in JS.
 * The response shape is identical to the original.
 */

import { NextRequest, NextResponse }              from "next/server";
import { getSession }                             from "@/lib/auth";
import { dbAttendance, dbStudents, dbAdmins, adminExists } from "@/lib/db";

async function guardAdmin() {
  const s = await getSession();
  if (!s || s.role !== "admin") return null;
  return (await adminExists(s.id)) ? s : null;
}

async function guardAny() {
  return getSession(); // students can GET
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await guardAny();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const sp           = req.nextUrl.searchParams;
  const month        = sp.get("month");
  const studentDbId  = sp.get("studentId");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: "Provide month=YYYY-MM." }, { status: 400 });
  }

  const effectiveStudentId =
    session.role === "student" ? String(session.id) : studentDbId ?? null;

  // ── 1. Fetch attendance records ─────────────────────────────────────────────
  let attSql  = "SELECT id, student_db_id, date, status, marked_by_admin, created_at FROM attendance WHERE date LIKE ?";
  const attArgs: (string | number)[] = [`${month}-%`];

  if (effectiveStudentId) {
    attSql += " AND student_db_id = ?";
    attArgs.push(parseInt(effectiveStudentId, 10));
  }
  attSql += " ORDER BY date DESC";

  const attResult = await dbAttendance.execute({ sql: attSql, args: attArgs });
  const attRows   = attResult.rows as unknown as {
    id: number; student_db_id: number; date: string;
    status: string; marked_by_admin: number; created_at: number;
  }[];

  if (!attRows.length) {
    return NextResponse.json({ ok: true, data: [] });
  }

  // ── 2. Fetch student names for the student IDs in these records ─────────────
  // Build IN (?,?,?) dynamically — works on any Neon plan without array extensions
  const studentIds = [...new Set(attRows.map((r) => r.student_db_id))];
  const studInPlaceholders = studentIds.map((_, i) => `?`).join(",");
  const studResult = await dbStudents.execute({
    sql:  `SELECT id, name, student_id FROM students WHERE id IN (${studInPlaceholders})`,
    args: studentIds,
  });
  const studMap = new Map(
    (studResult.rows as unknown as { id: number; name: string; student_id: string }[])
      .map((s) => [s.id, s])
  );

  // ── 3. Fetch admin names for the admin IDs that marked these records ─────────
  const adminIds = [...new Set(attRows.map((r) => r.marked_by_admin))];
  const admInPlaceholders = adminIds.map((_, i) => `?`).join(",");
  const admResult = await dbAdmins.execute({
    sql:  `SELECT id, name FROM admins WHERE id IN (${admInPlaceholders})`,
    args: adminIds,
  });
  const admMap = new Map(
    (admResult.rows as unknown as { id: number; name: string }[])
      .map((a) => [a.id, a.name])
  );

  // ── 4. Merge into the same shape as the original JOIN query ──────────────────
  const data = attRows
    .map((r) => {
      const stud = studMap.get(r.student_db_id);
      return {
        id:              r.id,
        student_db_id:   r.student_db_id,
        student_name:    stud?.name     ?? "Unknown",
        student_id:      stud?.student_id ?? "",
        date:            r.date,
        status:          r.status,
        marked_by_name:  admMap.get(r.marked_by_admin) ?? "Unknown",
        created_at:      r.created_at,
      };
    })
    .sort((a, b) => (b.date > a.date ? 1 : -1));

  return NextResponse.json({ ok: true, data });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { studentDbId, date, status } = await req.json() as {
    studentDbId: number;
    date:        string;
    status:      "present" | "absent";
  };

  if (!studentDbId || !date || !status) {
    return NextResponse.json({ ok: false, error: "studentDbId, date and status required." }, { status: 400 });
  }
  if (!["present", "absent"].includes(status)) {
    return NextResponse.json({ ok: false, error: "status must be 'present' or 'absent'." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date must be YYYY-MM-DD." }, { status: 400 });
  }

  // Upsert — ON CONFLICT syntax is identical in PostgreSQL
  await dbAttendance.execute({
    sql: `INSERT INTO attendance (student_db_id, date, status, marked_by_admin)
          VALUES (?,?,?,?)
          ON CONFLICT(student_db_id, date) DO UPDATE SET status=excluded.status, marked_by_admin=excluded.marked_by_admin`,
    args: [studentDbId, date, status, session.id],
  });

  return NextResponse.json({ ok: true });
}
