/**
 * components/admin/AttendanceTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar-based attendance marking.
 * Admin selects a month, sees all students as rows, date as columns.
 * Clicking a cell toggles present ↔ absent ↔ (unset).
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Popup from "@/components/ui/Popup";

interface StudentRow { id: number; name: string; student_id: string; }
interface AttendanceRecord { student_db_id: number; date: string; status: "present"|"absent"; }

function todayYM() { return new Date().toISOString().slice(0, 7); }
function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export default function AttendanceTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [month,     setMonth]     = useState(todayYM());
  const [students,  setStudents]  = useState<StudentRow[]>([]);
  const [records,   setRecords]   = useState<AttendanceRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [marking,   setMarking]   = useState<string | null>(null); // "studentDbId-date"
  const [alert,     setAlert]     = useState<{ msg: string; variant: "error"|"success" } | null>(null);

  const days = Array.from({ length: daysInMonth(month) }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${month}-${d}`;
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sRes, aRes] = await Promise.all([
      fetch("/api/student/manage"),
      fetch(`/api/attendance?month=${month}`),
    ]);
    const [sJson, aJson] = await Promise.all([sRes.json(), aRes.json()]);
    if (sJson.forceLogout || aJson.forceLogout) { onForceLogout(); return; }
    if (sJson.ok) setStudents(sJson.data);
    // libSQL may return INTEGER columns as bigint — normalise to number
    if (aJson.ok) setRecords(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (aJson.data as any[]).map((r) => ({
        ...r,
        student_db_id: Number(r.student_db_id),
      }))
    );
    setLoading(false);
  }, [month, onForceLogout]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build lookup: "studentDbId-date" → status
  const lookup: Record<string, "present"|"absent"> = {};
  records.forEach((r) => { lookup[`${r.student_db_id}-${r.date}`] = r.status; });

  async function handleCellClick(studentDbId: number, date: string) {
    const key     = `${studentDbId}-${date}`;
    const current = lookup[key];
    // Cycle: unset → present → absent → unset (we'll just toggle present/absent/unmark via upsert)
    const next    = current === "present" ? "absent" : "present";
    setMarking(key);

    const res  = await fetch("/api/attendance", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentDbId, date, status: next }),
    });
    const json = await res.json();
    setMarking(null);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) {
      // Optimistic UI update
      setRecords((prev) => {
        const filtered = prev.filter((r) => !(r.student_db_id === studentDbId && r.date === date));
        return [...filtered, { student_db_id: studentDbId, date, status: next }];
      });
    } else {
      setAlert({ msg: json.error, variant: "error" });
    }
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-white">Attendance</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-36 text-xs"
            max={todayYM()}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : students.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">No students yet. Add students first.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="text-xs min-w-full">
            <thead>
              <tr className="bg-slate-900/60">
                <th className="sticky left-0 bg-slate-900 z-10 text-left px-3 py-2 font-medium text-slate-400 whitespace-nowrap border-r border-slate-800">
                  Student
                </th>
                {days.map((date) => {
                  const day     = date.slice(8);
                  const dayOfW  = new Date(date).getDay(); // 0=Sun
                  const isSun   = dayOfW === 0;
                  return (
                    <th key={date} className={`px-1 py-2 font-medium text-center ${isSun ? "text-red-400/70" : "text-slate-500"}`}>
                      {day}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-t border-slate-800/60 hover:bg-white/[0.01]">
                  <td className="sticky left-0 bg-[#111118] z-10 px-3 py-2 whitespace-nowrap border-r border-slate-800">
                    <div className="text-slate-300 font-medium">{student.name}</div>
                    <div className="text-slate-500 text-[10px]">{student.student_id}</div>
                  </td>
                  {days.map((date) => {
                    const key    = `${student.id}-${date}`;
                    const status = lookup[key];
                    const isMarkingThis = marking === key;
                    return (
                      <td
                        key={date}
                        onClick={() => !isMarkingThis && handleCellClick(student.id, date)}
                        title={status ? `${status} – click to toggle` : "Click to mark"}
                        className={[
                          "px-1 py-1 text-center cursor-pointer transition-all",
                          isMarkingThis ? "opacity-50" : "",
                          status === "present" ? "text-green-400" :
                          status === "absent"  ? "text-red-400"   : "text-slate-700 hover:text-slate-500",
                        ].join(" ")}
                      >
                        <span className={[
                          "inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold",
                          status === "present" ? "bg-green-500/20 border border-green-500/40" :
                          status === "absent"  ? "bg-red-500/20   border border-red-500/40"   :
                          "border border-transparent hover:border-slate-700",
                        ].join(" ")}>
                          {isMarkingThis ? "…" : status === "present" ? "P" : status === "absent" ? "A" : "·"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-[11px] text-slate-500">
        <span><span className="text-green-400 font-bold">P</span> = Present</span>
        <span><span className="text-red-400 font-bold">A</span> = Absent</span>
        <span>Click any cell to toggle</span>
      </div>

      {alert && <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />}
    </div>
  );
}
