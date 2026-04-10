/**
 * components/student/EventsTab.tsx
 * Students can see current event info but cannot post, pause, or delete.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

interface EventView {
  title: string; description: string;
  event_date: string; last_reg_date: string;
  status: string; is_expired: boolean;
}

export default function StudentEventsTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [event,   setEvent]   = useState<EventView | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/events");
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) setEvent(json.data);
    setLoading(false);
  }, [onForceLogout]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return (
    <div className="fade-in">
      <h2 className="text-base font-semibold text-white mb-4">Events</h2>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : !event ? (
        <p className="text-center text-slate-500 text-sm py-12">No active event at the moment.</p>
      ) : (
        <div className="card fade-in">
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <h3 className="font-semibold text-white text-base">{event.title}</h3>
            <span className={event.is_expired ? "badge-expired" : event.status === "live" ? "badge-live" : "badge-paused"}>
              {event.is_expired ? "EXPIRED" : event.status.toUpperCase()}
            </span>
          </div>
          <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mb-4">{event.description}</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">Event Date</span>
              <span className="text-white font-medium">{event.event_date}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">Last Registration Date</span>
              <span className="text-white font-medium">{event.last_reg_date}</span>
            </div>
          </div>

          {/* Registration hint */}
          {!event.is_expired && event.status === "live" && (
            <div className="mt-4 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300">
              💡 To register, use the registration link shared by your admin.
            </div>
          )}
          {event.status === "paused" && !event.is_expired && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              ⏸ Registrations are currently paused. Check back later.
            </div>
          )}
          {event.is_expired && (
            <div className="mt-4 p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400">
              ✕ The registration deadline for this event has passed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
