/**
 * app/student/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Student dashboard with 5 tabs:
 * Attendance (chart) | Announcements | Events | Notifications | Profile
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import Image                   from "next/image";
import TabBar                  from "@/components/ui/TabBar";

import AttendanceChart         from "@/components/shared/AttendanceChart";
import StudentAnnouncementsTab from "@/components/student/AnnouncementsTab";
import StudentEventsTab        from "@/components/student/EventsTab";
import StudentNotificationsTab from "@/components/student/NotificationsTab";
import StudentProfileTab       from "@/components/student/ProfileTab";

const TABS = [
  { id: "attendance",    label: "Attendance",    icon: "📊" },
  { id: "announcements", label: "Announcements", icon: "📢" },
  { id: "events",        label: "Events",        icon: "🎯" },
  { id: "notifications", label: "Notifications", icon: "🔔" },
  { id: "profile",       label: "Profile",       icon: "👤" },
];

interface SessionInfo { name: string; userId: string; }

export default function StudentDashboard() {
  const router = useRouter();

  const [activeTab,  setActiveTab]  = useState("announcements");
  const [session,    setSession]    = useState<SessionInfo | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Read session from /api/auth/me — fast JWT-only check, no DB round-trip.
  // Force-logout validation (student removed) runs inside each tab component.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) { handleForceLogout(); return; }
        setSession({ name: json.data.name, userId: json.data.userId });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleForceLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 sticky top-0 z-50" style={{ background: "var(--color-surface)" }}>
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative w-7 h-7">
              <Image src="/logo.png" alt="TechOS" fill className="object-contain" />
            </div>
            <span className="text-sm font-semibold text-white">TechOS</span>
            <span className="hidden sm:inline text-slate-600 text-xs">/ Student</span>
          </div>

          <div className="flex items-center gap-3">
            {session && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-600/25 border border-cyan-500/30 flex items-center justify-center text-xs font-bold text-cyan-400">
                  {session.name.charAt(0)}
                </div>
                <span className="text-xs text-slate-400">{session.name}</span>
                <code className="text-[11px] text-cyan-400">{session.userId}</code>
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded border border-slate-800 hover:border-red-500/30 disabled:opacity-50"
            >
              {loggingOut ? "…" : "Logout"}
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 pb-2">
          <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {activeTab === "attendance"    && <AttendanceChart  isAdmin={false} onForceLogout={handleForceLogout} />}
        {activeTab === "announcements" && <StudentAnnouncementsTab onForceLogout={handleForceLogout} />}
        {activeTab === "events"        && <StudentEventsTab        onForceLogout={handleForceLogout} />}
        {activeTab === "notifications" && <StudentNotificationsTab onForceLogout={handleForceLogout} />}
        {activeTab === "profile"       && <StudentProfileTab       onForceLogout={handleForceLogout} />}
      </main>
    </div>
  );
}
