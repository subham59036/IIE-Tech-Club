/**
 * components/shared/AttendanceChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive bar chart showing each student's present days for a chosen month.
 * Admins also see a "Download Report" button that generates a leaderboard PDF.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import Button from "@/components/ui/Button";
import Popup  from "@/components/ui/Popup";
import type { AttendanceSummary } from "@/types";

function todayYM() { return new Date().toISOString().slice(0, 7); }

// Generate month options: last 12 months
function monthOptions(): { value: string; label: string }[] {
  const opts = [];
  const d    = new Date();
  for (let i = 0; i < 12; i++) {
    const ym    = d.toISOString().slice(0, 7);
    const label = d.toLocaleString("en-IN", { month: "long", year: "numeric" });
    opts.push({ value: ym, label });
    d.setMonth(d.getMonth() - 1);
  }
  return opts;
}

interface Props {
  isAdmin:       boolean;
  onForceLogout: () => void;
}

// Colour palette cycling for bars
const COLOURS = ["#6366f1","#22d3ee","#22c55e","#f59e0b","#ec4899","#a78bfa","#34d399","#fb923c"];

export default function AttendanceChart({ isAdmin, onForceLogout }: Props) {
  const [month,      setMonth]      = useState(todayYM());
  const [data,       setData]       = useState<AttendanceSummary[]>([]);
  const [clubDays,   setClubDays]   = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [alert,      setAlert]      = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res  = await fetch(`/api/attendance/summary?month=${month}`);
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) {
      // libSQL may return INTEGER columns as bigint — normalise every numeric field
      setData(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (json.data as any[]).map((r) => ({
          student_db_id:  Number(r.student_db_id),
          student_name:   String(r.student_name),
          student_id:     String(r.student_id),
          present_days:   Number(r.present_days  ?? 0),
          absent_days:    Number(r.absent_days   ?? 0),
          total_club_days: Number(r.total_club_days ?? 0),
          percentage:     Number(r.percentage    ?? 0),
        }))
      );
      setClubDays(Number(json.meta.total_club_days ?? 0));
    }
    setLoading(false);
  }, [month, onForceLogout]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── PDF report (admin only) ────────────────────────────────────────────────
  async function downloadPdf() {
    setPdfLoading(true);
    try {
      const { jsPDF }              = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const monthLabel = new Date(month + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" });
      const doc        = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Dark background
      doc.setFillColor(10, 10, 15);
      doc.rect(0, 0, 210, 297, "F");

      doc.setTextColor(241, 245, 249);
      doc.setFontSize(16);
      doc.text("IIE Tech Club – Attendance Report", 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text(`Month: ${monthLabel}   |   Club days held: ${clubDays}`, 14, 26);
      doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 31);

      // Sorted descending by present_days (leaderboard)
      const sorted = [...data].sort((a, b) => b.present_days - a.present_days);
      const rows   = sorted.map((s, i) => [
        i + 1,
        s.student_name,
        s.student_id,
        s.present_days,
        clubDays > 0 ? `${s.percentage}%` : "—",
      ]);

      autoTable(doc, {
        startY:    38,
        head:      [["Rank", "Name", "Student ID", "Days Present", "Attendance %"]],
        body:      rows,
        styles:         { fontSize: 9, cellPadding: 3, textColor: [241, 245, 249] },
        headStyles:     { fillColor: [99, 102, 241], textColor: 255 },
        alternateRowStyles: { fillColor: [22, 22, 31] },
        columnStyles: { 0: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" } },
        tableLineColor: [37, 37, 53],
      });

      doc.save(`Attendance_${month}.pdf`);
    } catch {
      setAlert("Failed to generate PDF. Please try again.");
    }
    setPdfLoading(false);
  }

  const months = monthOptions();

  return (
    <div className="fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-white">Attendance</h2>
          {!loading && (
            <p className="text-xs text-slate-500 mt-0.5">
              Club days this month: <strong className="text-slate-300">{clubDays}</strong>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="text-xs w-44"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {isAdmin && !loading && data.length > 0 && (
            <Button variant="secondary" size="sm" onClick={downloadPdf} loading={pdfLoading}>
              📥 Report
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : data.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">No students found.</p>
      ) : clubDays === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 text-sm">No attendance recorded for this month yet.</p>
        </div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="card mb-4" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: -10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#252535" vertical={false} />
                <XAxis
                  dataKey="student_name"
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  allowDecimals={false}
                  domain={[0, clubDays]}
                  label={{ value: "Days", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#16161f", border: "1px solid #252535",
                    borderRadius: 8, fontSize: 12,
                  }}
                  labelStyle={{ color: "#f1f5f9", marginBottom: 4 }}
                  formatter={(value: number, _name: string, props: { payload?: AttendanceSummary }) => [
                    `${value} / ${clubDays} days (${props.payload?.percentage ?? 0}%)`,
                    "Present",
                  ]}
                />
                <Bar dataKey="present_days" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLOURS[i % COLOURS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="text-left px-3 py-2 font-medium">Name</th>
                  <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">ID</th>
                  <th className="text-center px-3 py-2 font-medium">Present</th>
                  <th className="text-center px-3 py-2 font-medium">Absent</th>
                  <th className="text-center px-3 py-2 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {[...data].sort((a, b) => b.present_days - a.present_days).map((s, i) => (
                  <tr key={s.student_db_id} className="border-b border-slate-800/50 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-slate-300">
                      <span className="text-slate-600 mr-2">#{i + 1}</span>{s.student_name}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <code className="text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">{s.student_id}</code>
                    </td>
                    <td className="px-3 py-2 text-center text-green-400 font-medium">{s.present_days}</td>
                    <td className="px-3 py-2 text-center text-red-400">{s.absent_days}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={[
                        "font-semibold",
                        s.percentage >= 75 ? "text-green-400" :
                        s.percentage >= 50 ? "text-amber-400" : "text-red-400",
                      ].join(" ")}>
                        {clubDays > 0 ? `${s.percentage}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {alert && <Popup type="alert" message={alert} variant="error" onClose={() => setAlert(null)} />}
    </div>
  );
}
