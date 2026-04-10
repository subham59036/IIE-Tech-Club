/**
 * components/admin/NotificationsTab.tsx
 * Displays all admin-wide notifications. Admins can dismiss individual ones.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Popup  from "@/components/ui/Popup";

interface Notif { id: number; message: string; created_at: number; }

function formatTs(ms: number) {
  return new Date(ms).toLocaleString("en-IN", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
  });
}

export default function NotificationsTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [items,   setItems]   = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [alert,   setAlert]   = useState<string | null>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/notifications");
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    // Normalise libSQL bigint fields
    if (json.ok) setItems(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.data as any[]).map((r) => ({ ...r, id: Number(r.id), created_at: Number(r.created_at) }))
    );
    setLoading(false);
  }, [onForceLogout]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  async function dismiss(id: number) {
    const res  = await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) setItems((prev) => prev.filter((n) => n.id !== id));
    else setAlert(json.error);
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Notifications</h2>
        {items.length > 0 && (
          <span className="text-xs text-slate-500">{items.length} message{items.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">No notifications.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((n) => (
            <div key={n.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-colors fade-in">
              {/* Dot indicator */}
              <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-300 leading-relaxed">{n.message}</p>
                <p className="text-[11px] text-slate-600 mt-1">{formatTs(n.created_at)}</p>
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="text-slate-600 hover:text-slate-400 transition-colors text-lg shrink-0 leading-none"
                title="Dismiss"
              >×</button>
            </div>
          ))}
        </div>
      )}

      {alert && <Popup type="alert" message={alert} variant="error" onClose={() => setAlert(null)} />}
    </div>
  );
}
