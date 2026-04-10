/**
 * components/admin/EventsTab.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Admins can post one event at a time, pause/resume, edit last reg date,
 * delete, and download a PDF report of registrations.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Modal  from "@/components/ui/Modal";
import Popup  from "@/components/ui/Popup";

interface ClubEvent {
  id: number; title: string; description: string;
  event_date: string; last_reg_date: string; status: "live"|"paused";
  form_token: string; posted_by_name: string; created_at: number;
  registration_count: number; is_expired: boolean;
}

// ► CHANGE: Replace with your actual Vercel deployment domain
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://iie-tech-club.onrender.app";

export default function EventsTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [event,       setEvent]       = useState<ClubEvent | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [showCreate,  setShowCreate]  = useState(false);
  const [deleteConf,  setDeleteConf]  = useState(false);
  const [delLoading,  setDelLoading]  = useState(false);
  const [pauseLoad,   setPauseLoad]   = useState(false);
  const [newDate,     setNewDate]     = useState("");
  const [dateLoading, setDateLoading] = useState(false);
  const [alert,       setAlert]       = useState<{ msg: string; variant: "success"|"error" } | null>(null);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [copied,      setCopied]      = useState(false);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/events");
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) {
      // Normalise libSQL bigint fields
      const raw = json.data;
      const normalised = raw ? {
        ...raw,
        id:                 Number(raw.id),
        registration_count: Number(raw.registration_count ?? 0),
      } : null;
      setEvent(normalised);
      if (normalised) setNewDate(normalised.last_reg_date);
    }
    setLoading(false);
  }, [onForceLogout]);

  useEffect(() => { fetchEvent(); }, [fetchEvent]);

  // ─── Toggle pause / live ────────────────────────────────────────────────────
  async function toggleStatus() {
    if (!event) return;
    setPauseLoad(true);
    const res  = await fetch(`/api/events/${event.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: event.status === "live" ? "paused" : "live" }),
    });
    const json = await res.json();
    setPauseLoad(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) fetchEvent();
    else setAlert({ msg: json.error, variant: "error" });
  }

  // ─── Update last reg date ───────────────────────────────────────────────────
  async function handleDateUpdate() {
    if (!event || !newDate) return;
    setDateLoading(true);
    const res  = await fetch(`/api/events/${event.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastRegDate: newDate }),
    });
    const json = await res.json();
    setDateLoading(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) { fetchEvent(); setAlert({ msg: "Registration deadline updated.", variant: "success" }); }
    else setAlert({ msg: json.error, variant: "error" });
  }

  // ─── Delete event ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!event) return;
    setDelLoading(true);
    const res  = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    const json = await res.json();
    setDelLoading(false);
    setDeleteConf(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) { setEvent(null); setAlert({ msg: "Event deleted.", variant: "success" }); }
    else setAlert({ msg: json.error, variant: "error" });
  }

  // ─── Copy form link ─────────────────────────────────────────────────────────
  function copyLink() {
    if (!event) return;
    navigator.clipboard.writeText(`${APP_DOMAIN}/event/${event.form_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ─── Download PDF ───────────────────────────────────────────────────────────
  async function downloadPdf() {
    if (!event) return;
    setPdfLoading(true);
    const res  = await fetch(`/api/events/registrations?eventId=${event.id}`);
    const json = await res.json();
    if (!json.ok) { setAlert({ msg: json.error, variant: "error" }); setPdfLoading(false); return; }

    const { jsPDF }         = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFillColor(10, 10, 15);
    doc.rect(0, 0, 210, 297, "F");
    doc.setTextColor(241, 245, 249);
    doc.setFontSize(16);
    doc.text("IIE Tech Club – Event Registration Report", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text(`Event: ${event.title}`, 14, 26);
    doc.text(`Date: ${event.event_date}   |   Registrations: ${json.data.length}`, 14, 31);
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 36);

    const rows = (json.data as { student_name: string; semester: number; department: string; roll: string }[])
      .map((r, i) => [i + 1, r.student_name, r.semester, r.department, r.roll]);

    autoTable(doc, {
      startY: 42,
      head:   [["#", "Name", "Semester", "Department", "Roll No."]],
      body:   rows,
      styles:       { fontSize: 9, cellPadding: 3, textColor: [241, 245, 249] },
      headStyles:   { fillColor: [99, 102, 241], textColor: 255 },
      alternateRowStyles: { fillColor: [22, 22, 31] },
      tableLineColor: [37, 37, 53],
    });

    doc.save(`${event.title.replace(/\s+/g, "_")}_registrations.pdf`);
    setPdfLoading(false);
  }

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Event</h2>
        {!event && <Button size="sm" onClick={() => setShowCreate(true)}>+ Create Event</Button>}
      </div>

      {!event ? (
        <div className="text-center py-16">
          <p className="text-slate-500 text-sm mb-4">No active event. Create one to get started.</p>
          <Button onClick={() => setShowCreate(true)}>Create Event</Button>
        </div>
      ) : (
        <div className="card space-y-4 fade-in">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-white">{event.title}</h3>
                <span className={event.is_expired ? "badge-expired" : event.status === "live" ? "badge-live" : "badge-paused"}>
                  {event.is_expired ? "EXPIRED" : event.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xl">{event.description}</p>
            </div>
            <div className="text-right text-xs text-slate-500 shrink-0">
              <div>👤 {event.posted_by_name}</div>
              <div>📝 {event.registration_count} registrations</div>
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
            <span>🗓 Event date: <strong className="text-white">{event.event_date}</strong></span>
            <span>⏰ Last reg: <strong className="text-white">{event.last_reg_date}</strong></span>
          </div>

          {/* Form link */}
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Registration Form Link</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${APP_DOMAIN}/event/${event.form_token}`}
                className="text-xs text-slate-400 bg-slate-900/50 flex-1 cursor-text"
              />
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? "✓ Copied" : "Copy"}
              </Button>
            </div>
          </div>

          {/* Controls */}
          {!event.is_expired ? (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <Button
                variant={event.status === "live" ? "secondary" : "primary"}
                size="sm"
                onClick={toggleStatus}
                loading={pauseLoad}
              >
                {event.status === "live" ? "⏸ Pause" : "▶ Resume"}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteConf(true)}>
                🗑 Delete
              </Button>
              {/* Date updater */}
              <div className="flex items-center gap-2 ml-auto">
                <label className="text-xs text-slate-400 whitespace-nowrap">Change deadline</label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="text-xs w-32"
                />
                <Button variant="secondary" size="sm" onClick={handleDateUpdate} loading={dateLoading}>
                  Update
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 pt-2 border-t border-slate-800">
              <Button onClick={downloadPdf} loading={pdfLoading} size="sm">
                📥 Download Registration Report
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteConf(true)}>
                🗑 Delete
              </Button>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); fetchEvent(); setAlert({ msg: "Event created.", variant: "success" }); }}
          onForceLogout={onForceLogout}
        />
      )}
      {deleteConf && (
        <Popup
          type="confirm"
          message={`Delete event "${event?.title}"? All registrations will also be lost.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConf(false)}
          loading={delLoading}
          confirmLabel="Delete"
          danger
        />
      )}
      {alert && <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />}
    </div>
  );
}

function CreateEventModal({ onClose, onSuccess, onForceLogout }: {
  onClose: () => void; onSuccess: () => void; onForceLogout: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [eventDate,   setEventDate]   = useState(today);
  const [lastRegDate, setLastRegDate] = useState(today);
  const [error,       setError]       = useState("");
  const [saving,      setSaving]      = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const res  = await fetch("/api/events", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, eventDate, lastRegDate }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) onSuccess();
    else setError(json.error);
  }

  return (
    <Modal title="Create New Event" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Event Date</label>
            <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required min={today} />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Last Registration Date</label>
            <input type="date" value={lastRegDate} onChange={(e) => setLastRegDate(e.target.value)} required min={today} max={eventDate} />
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose} size="sm">Cancel</Button>
          <Button type="submit" loading={saving} size="sm">Create Event</Button>
        </div>
      </form>
    </Modal>
  );
}
