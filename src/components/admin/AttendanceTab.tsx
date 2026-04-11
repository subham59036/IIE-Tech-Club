/**
 * components/admin/AttendanceTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Calendar-based attendance UI.
 *
 * Flow:
 *   1. Admin picks a month (defaults to current month).
 *   2. A full calendar grid is shown. Each date cell is colour-coded:
 *        • Dark / dim   → no records at all for that date
 *        • Indigo ring  → at least one student marked (has data)
 *        • Green bg     → ALL students present for that date
 *        • Amber bg     → mixed (some present, some absent)
 *        • Red bg       → ALL students absent for that date
 *   3. Clicking a date opens an inline student panel below the calendar.
 *      The panel shows every student with:
 *        • Highlighted P / A chip showing their current status
 *        • Tap P or A to record / change status (saves immediately)
 *        • "All Present" and "All Absent" quick-fill buttons
 *   4. Clicking the same date again (or the ✕ button) closes the panel.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Popup from "@/components/ui/Popup";

// ─── Types ────────────────────────────────────────────────────────────────────
interface StudentRow      { id: number; name: string; student_id: string; }
interface AttendanceRecord { student_db_id: number; date: string; status: "present" | "absent"; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function todayYM() { return new Date().toISOString().slice(0, 7); }

function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function firstDayOfWeek(ym: string) {
  // 0 = Sunday
  return new Date(`${ym}-01`).getDay();
}

function fmt(date: string) {
  // "2025-01-15" → "Wed, 15 Jan 2025"
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AttendanceTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [month,        setMonth]        = useState(todayYM());
  const [students,     setStudents]     = useState<StudentRow[]>([]);
  const [records,      setRecords]      = useState<AttendanceRecord[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [marking,      setMarking]      = useState<string | null>(null); // "studentId-date"
  const [bulkMarking,  setBulkMarking]  = useState(false);
  const [alert,        setAlert]        = useState<{ msg: string; variant: "error" | "success" } | null>(null);

  // ── Fetch all data for the selected month ────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [sRes, aRes] = await Promise.all([
      fetch("/api/student/manage"),
      fetch(`/api/attendance?month=${month}`),
    ]);
    const [sJson, aJson] = await Promise.all([sRes.json(), aRes.json()]);
    if (sJson.forceLogout || aJson.forceLogout) { onForceLogout(); return; }
    if (sJson.ok) setStudents(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sJson.data as any[]).map((r) => ({ ...r, id: Number(r.id) }))
    );
    if (aJson.ok) setRecords(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (aJson.data as any[]).map((r) => ({
        student_db_id: Number(r.student_db_id),
        date:          String(r.date),
        status:        String(r.status) as "present" | "absent",
      }))
    );
    setLoading(false);
  }, [month, onForceLogout]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close panel when month changes
  useEffect(() => { setSelectedDate(null); }, [month]);

  // ── Build lookup: "studentId-date" → status ──────────────────────────────
  const lookup: Record<string, "present" | "absent"> = {};
  records.forEach((r) => { lookup[`${r.student_db_id}-${r.date}`] = r.status; });

  // ── Compute per-date summary for calendar colouring ─────────────────────
  function dateSummary(date: string): "none" | "all-present" | "all-absent" | "mixed" {
    if (!students.length) return "none";
    const dayRecords = records.filter((r) => r.date === date);
    if (!dayRecords.length) return "none";
    const allPresent = dayRecords.length === students.length && dayRecords.every((r) => r.status === "present");
    const allAbsent  = dayRecords.length === students.length && dayRecords.every((r) => r.status === "absent");
    if (allPresent) return "all-present";
    if (allAbsent)  return "all-absent";
    return "mixed";
  }

  // ── Mark a single student ────────────────────────────────────────────────
  async function markStudent(studentId: number, date: string, status: "present" | "absent") {
    const key = `${studentId}-${date}`;
    // Already at this status → no-op
    if (lookup[key] === status) return;
    setMarking(key);

    const res  = await fetch("/api/attendance", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ studentDbId: studentId, date, status }),
    });
    const json = await res.json();
    setMarking(null);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) {
      setRecords((prev) => {
        const filtered = prev.filter(
          (r) => !(r.student_db_id === studentId && r.date === date)
        );
        return [...filtered, { student_db_id: studentId, date, status }];
      });
    } else {
      setAlert({ msg: json.error ?? "Failed to save.", variant: "error" });
    }
  }

  // ── Bulk mark all students ────────────────────────────────────────────────
  async function markAll(date: string, status: "present" | "absent") {
    setBulkMarking(true);
    // Fire all requests in parallel
    const results = await Promise.all(
      students.map((s) =>
        fetch("/api/attendance", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ studentDbId: s.id, date, status }),
        }).then((r) => r.json())
      )
    );
    setBulkMarking(false);

    const forceOut = results.find((r) => r.forceLogout);
    if (forceOut) { onForceLogout(); return; }

    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      setAlert({ msg: "Some records failed to save. Please retry.", variant: "error" });
    }

    // Rebuild records for this date optimistically
    setRecords((prev) => {
      const withoutThisDate = prev.filter((r) => r.date !== date);
      const newEntries = students.map((s) => ({
        student_db_id: s.id,
        date,
        status,
      }));
      return [...withoutThisDate, ...newEntries];
    });
  }

  // ── Calendar grid data ────────────────────────────────────────────────────
  const totalDays = daysInMonth(month);
  const startDay  = firstDayOfWeek(month); // 0=Sun
  const days = Array.from({ length: totalDays }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${month}-${d}`;
  });

  // Day-of-week labels
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // ── Date cell styling ──────────────────────────────────────────────────────
  function dateCellClass(date: string): string {
    const summary   = dateSummary(date);
    const isSelected = date === selectedDate;
    const today     = new Date().toISOString().slice(0, 10);
    const isToday   = date === today;

    const base = "relative flex flex-col items-center justify-center rounded-xl cursor-pointer select-none transition-all duration-150 aspect-square text-sm font-semibold border";

    if (isSelected) {
      return `${base} bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105 z-10`;
    }
    if (summary === "all-present") {
      return `${base} bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30`;
    }
    if (summary === "all-absent") {
      return `${base} bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30`;
    }
    if (summary === "mixed") {
      return `${base} bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30`;
    }
    // No records
    if (isToday) {
      return `${base} border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10`;
    }
    return `${base} border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300 hover:bg-white/[0.03]`;
  }

  // Dot indicator: shows on dates that have any data
  function hasData(date: string) {
    return records.some((r) => r.date === date);
  }

  // ── Selected date student panel ────────────────────────────────────────────
  function StudentPanel() {
    if (!selectedDate) return null;
    const dayRecords = records.filter((r) => r.date === selectedDate);
    const presentCount = dayRecords.filter((r) => r.status === "present").length;
    const absentCount  = dayRecords.filter((r) => r.status === "absent").length;

    return (
      <div className="mt-4 card fade-in">
        {/* Panel header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {fmt(selectedDate)}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {dayRecords.length === 0
                ? "No records yet — mark attendance below"
                : `${presentCount} present · ${absentCount} absent · ${students.length - dayRecords.length} unmarked`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Bulk buttons */}
            <button
              onClick={() => markAll(selectedDate, "present")}
              disabled={bulkMarking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 disabled:opacity-50 transition-all"
            >
              {bulkMarking ? <span className="spinner" /> : "✓"}
              All Present
            </button>
            <button
              onClick={() => markAll(selectedDate, "absent")}
              disabled={bulkMarking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 disabled:opacity-50 transition-all"
            >
              {bulkMarking ? <span className="spinner" /> : "✕"}
              All Absent
            </button>
            {/* Close panel */}
            <button
              onClick={() => setSelectedDate(null)}
              className="text-slate-500 hover:text-white text-xl leading-none px-1 transition-colors"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* Student list */}
        <div className="flex flex-col gap-1.5">
          {students.map((student) => {
            const key    = `${student.id}-${selectedDate}`;
            const status = lookup[key];
            const isBusy = marking === key || bulkMarking;

            return (
              <div
                key={student.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-800/60 bg-slate-900/40 hover:bg-slate-900/70 transition-colors"
              >
                {/* Student info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 font-medium truncate">{student.name}</p>
                  <p className="text-[11px] text-slate-500">{student.student_id}</p>
                </div>

                {/* Status chip (read-only display) */}
                <div className="text-[11px] w-16 text-center">
                  {status === "present" && (
                    <span className="px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                      Present
                    </span>
                  )}
                  {status === "absent" && (
                    <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                      Absent
                    </span>
                  )}
                  {!status && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-700/40 text-slate-500 border border-slate-700">
                      —
                    </span>
                  )}
                </div>

                {/* P button */}
                <button
                  onClick={() => markStudent(student.id, selectedDate!, "present")}
                  disabled={isBusy}
                  title="Mark Present"
                  className={[
                    "w-9 h-9 rounded-lg text-xs font-bold transition-all border",
                    status === "present"
                      ? "bg-green-500 border-green-400 text-white shadow-md"
                      : "bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/25",
                    "disabled:opacity-40",
                  ].join(" ")}
                >
                  {isBusy && marking === key + "_p" ? <span className="spinner w-3 h-3" /> : "P"}
                </button>

                {/* A button */}
                <button
                  onClick={() => markStudent(student.id, selectedDate!, "absent")}
                  disabled={isBusy}
                  title="Mark Absent"
                  className={[
                    "w-9 h-9 rounded-lg text-xs font-bold transition-all border",
                    status === "absent"
                      ? "bg-red-500 border-red-400 text-white shadow-md"
                      : "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/25",
                    "disabled:opacity-40",
                  ].join(" ")}
                >
                  {isBusy && marking === key + "_a" ? <span className="spinner w-3 h-3" /> : "A"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-white">Attendance</h2>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-36 text-xs"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : students.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">
          No students yet. Add students first.
        </p>
      ) : (
        <>
          {/* ── Calendar grid ──────────────────────────────────────────────── */}
          <div className="card">
            {/* Month label */}
            <p className="text-xs text-slate-500 mb-3 text-center font-medium tracking-wide uppercase">
              {new Date(`${month}-01`).toLocaleString("en-IN", { month: "long", year: "numeric" })}
            </p>

            {/* Day-of-week header */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DOW.map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] text-slate-500 font-semibold py-1"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Date cells */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty prefix cells for first-week offset */}
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {days.map((date) => {
                const dayNum = date.slice(8);
                const isBusy = bulkMarking && selectedDate === date;

                return (
                  <div
                    key={date}
                    onClick={() =>
                      setSelectedDate((prev) => (prev === date ? null : date))
                    }
                    className={dateCellClass(date)}
                    style={{ minHeight: 44 }}
                  >
                    {/* Day number */}
                    <span className="leading-none">{dayNum}</span>

                    {/* Indicator dot for dates with data */}
                    {hasData(date) && date !== selectedDate && (
                      <span
                        className={[
                          "absolute bottom-1 w-1 h-1 rounded-full",
                          dateSummary(date) === "all-present" ? "bg-green-400" :
                          dateSummary(date) === "all-absent"  ? "bg-red-400"   :
                          "bg-amber-400",
                        ].join(" ")}
                      />
                    )}

                    {/* Busy spinner for bulk ops */}
                    {isBusy && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30">
                        <span className="spinner w-3 h-3" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 justify-center">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/40 inline-block" />
                All Present
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40 inline-block" />
                Mixed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40 inline-block" />
                All Absent
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded border border-slate-700 inline-block" />
                No records
              </span>
              <span className="text-slate-600">· Click any date to mark attendance</span>
            </div>
          </div>

          {/* ── Student panel (shown when a date is selected) ───────────── */}
          <StudentPanel />
        </>
      )}

      {alert && (
        <Popup
          type="alert"
          message={alert.msg}
          variant={alert.variant}
          onClose={() => setAlert(null)}
        />
      )}
    </div>
  );
}
