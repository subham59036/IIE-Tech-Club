/**
 * components/admin/AnnouncementsTab.tsx
 * Post announcements (admin) and view all (both roles via shared component).
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Modal  from "@/components/ui/Modal";
import Popup  from "@/components/ui/Popup";

interface Announcement {
  id: number; title: string; description: string;
  announced_date: string; posted_by_name: string; created_at: number;
}

export default function AnnouncementsTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [items,       setItems]       = useState<Announcement[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showModal,   setShowModal]   = useState(false);
  const [deleteTarget,setDeleteTarget]= useState<Announcement | null>(null);
  const [delLoading,  setDelLoading]  = useState(false);
  const [alert,       setAlert]       = useState<{ msg: string; variant: "success"|"error" } | null>(null);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDelLoading(true);
    const res  = await fetch(`/api/announcements?id=${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    setDelLoading(false);
    setDeleteTarget(null);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) { setAlert({ msg: "Announcement deleted.", variant: "success" }); fetch_(); }
    else          setAlert({ msg: json.error, variant: "error" });
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Announcements</h2>
        <Button size="sm" onClick={() => setShowModal(true)}>+ Post</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : items.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">No announcements yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div key={item.id} className="card fade-in">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm mb-1">{item.title}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">{item.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-500">
                    <span>📅 Announced: {item.announced_date}</span>
                    <span>👤 By: {item.posted_by_name}</span>
                    <span>🕒 Posted: {new Date(item.created_at).toLocaleDateString("en-IN")}</span>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(item)}
                  className="text-slate-600 hover:text-red-400 transition-colors text-lg shrink-0"
                  title="Delete"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PostAnnouncementModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetch_(); setAlert({ msg: "Announcement posted.", variant: "success" }); }}
          onForceLogout={onForceLogout}
        />
      )}
      {deleteTarget && (
        <Popup
          type="confirm"
          message={`Delete announcement "${deleteTarget.title}"?`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={delLoading}
          confirmLabel="Delete"
          danger
        />
      )}
      {alert && <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />}
    </div>
  );
}

function PostAnnouncementModal({ onClose, onSuccess, onForceLogout }: {
  onClose: () => void; onSuccess: () => void; onForceLogout: () => void;
}) {
  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");
  const [announcedDate, setAnnouncedDate] = useState(new Date().toISOString().slice(0, 10));
  const [error,         setError]         = useState("");
  const [saving,        setSaving]        = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const res  = await fetch("/api/announcements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, announcedDate }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) onSuccess();
    else setError(json.error);
  }

  return (
    <Modal title="Post Announcement" onClose={onClose} width="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Write the announcement details…"
            rows={4}
            required
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Announced Date</label>
          <input type="date" value={announcedDate} onChange={(e) => setAnnouncedDate(e.target.value)} required />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose} size="sm">Cancel</Button>
          <Button type="submit" loading={saving} size="sm">Post</Button>
        </div>
      </form>
    </Modal>
  );
}
