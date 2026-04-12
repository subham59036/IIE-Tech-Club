/**
 * GET /api/attendance/summary?month=YYYY-MM
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns per-student attendance summary for a given month.
 * Club total days = count of distinct dates in that month with any record.
 * Percentage is against club days only (not calendar days).
 *
 * The original query LEFT JOIN-ed students + attendance in one DB.
 * Since they are now in separate Neon projects, we fetch both independently
 * and compute the aggregation in JavaScript.
 * The response shape is identical to the original.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse }      from "next/server";
import { getSession }                     from "@/lib/auth";
import { dbAttendance, dbStudents, adminExists } from "@/lib/db";
import type { AttendanceSummary }         from "@/types";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });

  if (session.role === "admin" && !(await adminExists(session.id))) {
    return NextResponse.json({ ok: false, error: "Unauthorised.", forceLogout: true }, { status: 401 });
  }

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ ok: false, error: "month=YYYY-MM required." }, { status: 400 });
  }

  // ── 1. Total club days = distinct dates with at least one record ────────────
  const clubDaysResult = await dbAttendance.execute({
    sql:  "SELECT COUNT(DISTINCT date) AS total FROM attendance WHERE date LIKE ?",
    args: [`${month}-%`],
  });
  const total_club_days =
    (clubDaysResult.rows[0] as unknown as { total: number } | undefined)?.total ?? 0;

  // ── 2. All students ─────────────────────────────────────────────────────────
  const studResult = await dbStudents.execute(
    "SELECT id, name, student_id FROM students ORDER BY student_id"
  );
  const students = studResult.rows as unknown as {
    id: number; name: string; student_id: string;
  }[];

  // ── 3. All attendance records for this month ────────────────────────────────
  const attResult = await dbAttendance.execute({
    sql:  "SELECT student_db_id, status FROM attendance WHERE date LIKE ?",
    args: [`${month}-%`],
  });
  const attRows = attResult.rows as unknown as {
    student_db_id: number; status: string;
  }[];

  // ── 4. Aggregate in JS (replicates the SQL GROUP BY + SUM) ──────────────────
  const presentMap = new Map<number, number>();
  const absentMap  = new Map<number, number>();
  for (const r of attRows) {
    const sid = r.student_db_id;
    if (r.status === "present") presentMap.set(sid, (presentMap.get(sid) ?? 0) + 1);
    else                         absentMap.set(sid,  (absentMap.get(sid)  ?? 0) + 1);
  }

  const data: AttendanceSummary[] = students
    .map((s) => {
      const present_days = presentMap.get(s.id) ?? 0;
      const absent_days  = absentMap.get(s.id)  ?? 0;
      return {
        student_db_id:  s.id,
        student_name:   s.name,
        student_id:     s.student_id,
        present_days,
        absent_days,
        total_club_days,
        percentage: total_club_days > 0
          ? Math.round((present_days / total_club_days) * 100)
          : 0,
      };
    })
    // Sort descending by present_days (same ORDER BY as original query)
    .sort((a, b) => b.present_days - a.present_days || a.student_id.localeCompare(b.student_id));

  return NextResponse.json({ ok: true, data, meta: { total_club_days } });
}
