/**
 * GET  /api/attendance?month=YYYY-MM           – All attendance for a month
 * GET  /api/attendance?month=YYYY-MM&studentId=N – Specific student's records
 * POST /api/attendance                          – Upsert an attendance record (admin only)
 *
 * Note: one record per student per date (UNIQUE constraint).
 * Upserting allows admins to correct mistakes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { db, adminExists }           from "@/lib/db";
// (no util imports needed in this route)

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

  const sp         = req.nextUrl.searchParams;
  const month      = sp.get("month");      // YYYY-MM
  const studentDbId = sp.get("studentId"); // DB id (optional filter)

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: "Provide month=YYYY-MM." }, { status: 400 });
  }

  // If student role, restrict to their own records
  const effectiveStudentId =
    session.role === "student" ? String(session.id) : studentDbId ?? null;

  let sql = `
    SELECT a.id, a.student_db_id, s.name AS student_name, s.student_id,
           a.date, a.status, adm.name AS marked_by_name, a.created_at
    FROM attendance a
    JOIN students s   ON s.id = a.student_db_id
    JOIN admins   adm ON adm.id = a.marked_by_admin
    WHERE a.date LIKE ?
  `;
  const args: (string | number)[] = [`${month}-%`];

  if (effectiveStudentId) {
    sql += " AND a.student_db_id = ?";
    args.push(parseInt(effectiveStudentId, 10));
  }

  sql += " ORDER BY a.date DESC, s.student_id";

  const result = await db.execute({ sql, args });
  return NextResponse.json({ ok: true, data: result.rows });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await guardAdmin();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  const { studentDbId, date, status } = await req.json() as {
    studentDbId: number;
    date:        string;  // YYYY-MM-DD
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

  // Upsert (INSERT OR REPLACE respects the UNIQUE constraint)
  await db.execute({
    sql: `INSERT INTO attendance (student_db_id, date, status, marked_by_admin)
          VALUES (?,?,?,?)
          ON CONFLICT(student_db_id, date) DO UPDATE SET status=excluded.status, marked_by_admin=excluded.marked_by_admin`,
    args: [studentDbId, date, status, session.id],
  });

  return NextResponse.json({ ok: true });
}
