/**
 * components/student/ProfileTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Students can update their name, ID and password.
 * Shows a monthly calendar of their own attendance — green = present, red = absent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Popup  from "@/components/ui/Popup";

interface Profile { id: number; name: string; user_id: string; created_at: number; }
interface AttRec  { date: string; status: "present"|"absent"; }

function todayYM() { return new Date().toISOString().slice(0, 7); }
function monthOptions() {
  const opts: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) {
    opts.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleString("en-IN", { month: "long", year: "numeric" }),
    });
    d.setMonth(d.getMonth() - 1);
  }
  return opts;
}

export default function StudentProfileTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [name,     setName]     = useState("");
  const [userId,   setUserId]   = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [alert,    setAlert]    = useState<{ msg: string; variant: "success"|"error" } | null>(null);

  // Calendar state
  const [calMonth,  setCalMonth]  = useState(todayYM());
  const [attRecs,   setAttRecs]   = useState<AttRec[]>([]);
  const [calLoad,   setCalLoad]   = useState(false);

  // ─── Load profile ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.forceLogout) { onForceLogout(); return; }
        if (json.ok) {
          const d = json.data;
          const norm = { ...d, id: Number(d.id), created_at: Number(d.created_at) };
          setProfile(norm); setName(norm.name); setUserId(norm.user_id);
        }
        setLoading(false);
      });
  }, [onForceLogout]);

  // ─── Load attendance calendar ───────────────────────────────────────────────
  const loadCalendar = useCallback(async () => {
    setCalLoad(true);
    const res  = await fetch(`/api/attendance?month=${calMonth}`);
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    // Normalise libSQL bigint returns; only keep date + status fields needed for calendar
    if (json.ok) setAttRecs(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.data as any[]).map((r) => ({
        date:   String(r.date),
        status: String(r.status) as "present" | "absent",
      }))
    );
    setCalLoad(false);
  }, [calMonth, onForceLogout]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  // ─── Save profile ───────────────────────────────────────────────────────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (password && password !== confirm) {
      setAlert({ msg: "Passwords do not match.", variant: "error" }); return;
    }
    if (password && password.length < 6) {
      setAlert({ msg: "Password must be at least 6 characters.", variant: "error" }); return;
    }
    setSaving(true);
    const body: Record<string, string> = {};
    if (name    !== profile?.name)    body.name     = name;
    if (userId  !== profile?.user_id) body.userId   = userId;
    if (password)                      body.password = password;

    const res  = await fetch("/api/profile", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) {
      setProfile((p) => p ? { ...p, name: json.data.name, user_id: json.data.userId } : p);
      setPassword(""); setConfirm("");
      setAlert({ msg: "Profile updated.", variant: "success" });
    } else {
      setAlert({ msg: json.error, variant: "error" });
    }
  }

  // ─── Build calendar grid ────────────────────────────────────────────────────
  function renderCalendar() {
    const [y, m]    = calMonth.split("-").map(Number);
    const firstDay  = new Date(y, m - 1, 1).getDay(); // 0=Sun
    const totalDays = new Date(y, m, 0).getDate();

    // Build lookup
    const statusMap: Record<string, "present"|"absent"> = {};
    attRecs.forEach((r) => { statusMap[r.date] = r.status; });

    const cells: React.ReactNode[] = [];
    // Empty prefix cells
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`e${i}`} />);
    }
    // Day cells
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${calMonth}-${String(d).padStart(2, "0")}`;
      const status  = statusMap[dateStr];
      cells.push(
        <div
          key={dateStr}
          title={status ? `${dateStr}: ${status}` : dateStr}
          className={[
            "aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors",
            status === "present" ? "bg-green-500/25 text-green-400 border border-green-500/40" :
            status === "absent"  ? "bg-red-500/25   text-red-400   border border-red-500/40"   :
            "bg-slate-800/40 text-slate-600 border border-transparent",
          ].join(" ")}
        >
          {d}
        </div>
      );
    }
    return cells;
  }

  const presentDays = attRecs.filter((r) => r.status === "present").length;
  const absentDays  = attRecs.filter((r) => r.status === "absent").length;

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="fade-in space-y-6">
      {/* ── Profile edit ─────────────────────────────────────────────────────── */}
      <div className="max-w-md">
        <h2 className="text-base font-semibold text-white mb-4">Profile</h2>

        {/* Avatar card */}
        {profile && (
          <div className="card mb-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-xl font-bold text-cyan-400 shrink-0">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-white">{profile.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                <code className="text-cyan-400">{profile.user_id}</code>
                {" · "}Student
                {" · "}Joined {new Date(profile.created_at).toLocaleDateString("en-IN")}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Student ID</label>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value.toUpperCase())}
              maxLength={4} required
            />
            <p className="text-xs text-slate-600 mt-1">Format: S001 – S999. Must be unique.</p>
          </div>
          <hr className="border-slate-800" />
          <p className="text-xs text-slate-500">Change password (leave blank to keep current)</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" />
          </div>
          <Button type="submit" loading={saving} className="self-start">Save Changes</Button>
        </form>
      </div>

      {/* ── Attendance calendar ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-base font-semibold text-white">My Attendance</h2>
          <select
            value={calMonth}
            onChange={(e) => setCalMonth(e.target.value)}
            className="text-xs w-44"
          >
            {monthOptions().map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="flex gap-3 mb-3">
          <div className="card flex-1 text-center py-3">
            <p className="text-2xl font-bold text-green-400">{presentDays}</p>
            <p className="text-xs text-slate-500 mt-1">Present</p>
          </div>
          <div className="card flex-1 text-center py-3">
            <p className="text-2xl font-bold text-red-400">{absentDays}</p>
            <p className="text-xs text-slate-500 mt-1">Absent</p>
          </div>
          <div className="card flex-1 text-center py-3">
            <p className="text-2xl font-bold text-indigo-400">
              {presentDays + absentDays > 0 ? `${Math.round((presentDays / (presentDays + absentDays)) * 100)}%` : "—"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Rate</p>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="card">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
              <div key={d} className="text-center text-[10px] text-slate-500 font-medium py-1">{d}</div>
            ))}
          </div>
          {calLoad ? (
            <div className="text-center py-6 text-slate-500 text-xs">Loading…</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {renderCalendar()}
            </div>
          )}
          {/* Legend */}
          <div className="flex gap-4 mt-3 text-[11px] text-slate-500 justify-center">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500/25 border border-green-500/40 inline-block" />Present</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/25 border border-red-500/40 inline-block" />Absent</span>
          </div>
        </div>
      </div>

      {alert && <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />}
    </div>
  );
}
