/**
 * GET /api/attendance/summary?month=YYYY-MM
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns per-student attendance summary for a given month.
 * Club total days = count of distinct dates in that month with any record.
 * Percentage is against club days only (not calendar days).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession }                from "@/lib/auth";
import { db, adminExists }           from "@/lib/db";
import type { AttendanceSummary }    from "@/types";

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

  // Total club days in this month = distinct dates that have at least one record
  const clubDaysResult = await db.execute({
    sql:  "SELECT COUNT(DISTINCT date) AS total FROM attendance WHERE date LIKE ?",
    args: [`${month}-%`],
  });
  // COUNT always returns one row; use optional chaining + nullish coalescing for safety
  const total_club_days = (clubDaysResult.rows[0] as unknown as { total: number } | undefined)?.total ?? 0;

  // Per-student summary
  const result = await db.execute({
    sql: `
      SELECT s.id AS student_db_id, s.name AS student_name, s.student_id,
             SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_days,
             SUM(CASE WHEN a.status='absent'  THEN 1 ELSE 0 END) AS absent_days
      FROM   students s
      LEFT   JOIN attendance a
             ON a.student_db_id = s.id AND a.date LIKE ?
      GROUP  BY s.id
      ORDER  BY present_days DESC, s.student_id
    `,
    args: [`${month}-%`],
  });

  const data: AttendanceSummary[] = result.rows.map((r) => {
    const row = r as unknown as {
      student_db_id: number; student_name: string; student_id: string;
      present_days: number; absent_days: number;
    };
    return {
      student_db_id:  row.student_db_id,
      student_name:   row.student_name,
      student_id:     row.student_id,
      present_days:   row.present_days  ?? 0,
      absent_days:    row.absent_days   ?? 0,
      total_club_days,
      percentage:     total_club_days > 0
        ? Math.round(((row.present_days ?? 0) / total_club_days) * 100)
        : 0,
    };
  });

  return NextResponse.json({ ok: true, data, meta: { total_club_days } });
}
