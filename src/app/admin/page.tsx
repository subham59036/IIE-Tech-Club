/**
 * app/admin/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin dashboard. Renders a 7-tab layout.
 * Handles force-logout: when any API returns forceLogout=true the session is
 * cleared and the user is sent back to the login page.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter }           from "next/navigation";
import Image                   from "next/image";
import TabBar                  from "@/components/ui/TabBar";

// Tab components
import AdminsTab        from "@/components/admin/AdminsTab";
import StudentsTab      from "@/components/admin/StudentsTab";
import AttendanceTab    from "@/components/admin/AttendanceTab";
import AnnouncementsTab from "@/components/admin/AnnouncementsTab";
import EventsTab        from "@/components/admin/EventsTab";
import NotificationsTab from "@/components/admin/NotificationsTab";
import ProfileTab       from "@/components/admin/ProfileTab";
import AttendanceChart  from "@/components/shared/AttendanceChart";

const TABS = [
  { id: "admins",        label: "Admins",        icon: "🛡" },
  { id: "students",      label: "Students",       icon: "🎓" },
  { id: "attendance",    label: "Attendance",     icon: "📅" },
  { id: "chart",         label: "Chart",          icon: "📊" },
  { id: "announcements", label: "Announcements",  icon: "📢" },
  { id: "events",        label: "Events",         icon: "🎯" },
  { id: "notifications", label: "Notifications",  icon: "🔔" },
  { id: "profile",       label: "Profile",        icon: "👤" },
];

interface SessionInfo { id: number; name: string; userId: string; }

export default function AdminDashboard() {
  const router = useRouter();

  const [activeTab, setActiveTab]   = useState("admins");
  const [session,   setSession]     = useState<SessionInfo | null>(null);
  const [loggingOut,setLoggingOut]  = useState(false);

  // Read session from /api/auth/me — a fast JWT-only check (no DB hit)
  // The full DB-validated force-logout guard runs inside each tab component.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) { handleForceLogout(); return; }
        setSession({ id: json.data.id, name: json.data.name, userId: json.data.userId });
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Force logout: clear cookie + redirect ──────────────────────────────────
  async function handleForceLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  // ── Manual logout ──────────────────────────────────────────────────────────
  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Top header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-800 bg-surface sticky top-0 z-50" style={{ background: "var(--color-surface)" }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo + title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative w-7 h-7">
              <Image src="/logo.png" alt="TechOS" fill className="object-contain" />
            </div>
            <span className="text-sm font-semibold text-white">TechOS</span>
            <span className="hidden sm:inline text-slate-600 text-xs">/ Admin</span>
          </div>

          {/* Session info + logout */}
          <div className="flex items-center gap-3">
            {session && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-600/25 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
                  {session.name.charAt(0)}
                </div>
                <span className="text-xs text-slate-400">{session.name}</span>
                <code className="text-[11px] text-indigo-400">{session.userId}</code>
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

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-4 pb-2">
          <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === "admins"        && session && (
          <AdminsTab currentAdminDbId={session.id} onForceLogout={handleForceLogout} />
        )}
        {activeTab === "students"      && <StudentsTab      onForceLogout={handleForceLogout} />}
        {activeTab === "attendance"    && <AttendanceTab    onForceLogout={handleForceLogout} />}
        {activeTab === "chart"         && <AttendanceChart  isAdmin={true} onForceLogout={handleForceLogout} />}
        {activeTab === "announcements" && <AnnouncementsTab onForceLogout={handleForceLogout} />}
        {activeTab === "events"        && <EventsTab        onForceLogout={handleForceLogout} />}
        {activeTab === "notifications" && <NotificationsTab onForceLogout={handleForceLogout} />}
        {activeTab === "profile"       && <ProfileTab       onForceLogout={handleForceLogout} />}
      </main>
    </div>
  );
}
