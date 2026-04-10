/**
 * components/student/AnnouncementsTab.tsx
 * Read-only announcement feed for students.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface Announcement {
  id: number; title: string; description: string;
  announced_date: string; posted_by_name: string; created_at: number;
}

export default function StudentAnnouncementsTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [items,   setItems]   = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/announcements");
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    // Normalise libSQL bigint fields
    if (json.ok) setItems(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.data as any[]).map((r) => ({ ...r, id: Number(r.id), created_at: Number(r.created_at) }))
    );
    setLoading(false);
  }, [onForceLogout]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="fade-in">
      <h2 className="text-base font-semibold text-white mb-4">Announcements</h2>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">No announcements yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="card fade-in">
              <h3 className="font-semibold text-white text-sm mb-1">{item.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">{item.description}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
                <span>📅 Announced: {item.announced_date}</span>
                <span>👤 By: {item.posted_by_name}</span>
                <span>🕒 Posted: {new Date(item.created_at).toLocaleDateString("en-IN")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
