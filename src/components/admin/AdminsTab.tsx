/**
 * components/admin/AdminsTab.tsx
 * Lists all admins. Allows adding, editing, and removing admins.
 * Handles force-logout if current admin is removed from another session.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button  from "@/components/ui/Button";
import Modal   from "@/components/ui/Modal";
import Popup   from "@/components/ui/Popup";

interface AdminRow {
  id:           number;
  name:         string;
  admin_id:     string;
  has_password: number; // SQLite returns 0/1
  created_at:   number;
}

interface AdminsTabProps {
  currentAdminDbId: number;
  onForceLogout:    () => void;
}

export default function AdminsTab({ currentAdminDbId, onForceLogout }: AdminsTabProps) {
  const [admins,       setAdmins]       = useState<AdminRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget,   setEditTarget]   = useState<AdminRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminRow | null>(null);
  const [deleteLoading,setDeleteLoading]= useState(false);
  const [alert,        setAlert]        = useState<{ msg: string; variant: "success"|"error" } | null>(null);

  // ─── Fetch admins list ─────────────────────────────────────────────────────
  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/admin/manage");
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    // Normalise libSQL bigint id fields to JS number
    if (json.ok) setAdmins(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.data as any[]).map((r) => ({ ...r, id: Number(r.id) }))
    );
    setLoading(false);
  }, [onForceLogout]);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  // ─── Delete handler ────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res  = await fetch(`/api/admin/manage/${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) { setAlert({ msg: "Admin removed.", variant: "success" }); fetchAdmins(); }
    else          setAlert({ msg: json.error, variant: "error" });
  }

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-white">Admins</h2>
        <Button size="sm" onClick={() => setShowAddModal(true)}>+ Add Admin</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs">
                <th className="text-left pb-2 font-medium">Name</th>
                <th className="text-left pb-2 font-medium">ID</th>
                <th className="text-left pb-2 font-medium hidden sm:table-cell">Status</th>
                <th className="text-right pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 text-slate-200">{admin.name}</td>
                  <td className="py-3">
                    <code className="text-indigo-400 text-xs bg-indigo-400/10 px-2 py-0.5 rounded">{admin.admin_id}</code>
                  </td>
                  <td className="py-3 hidden sm:table-cell">
                    {admin.id === currentAdminDbId && (
                      <span className="text-xs text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">You</span>
                    )}
                    {!admin.has_password && (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded ml-1">Awaiting login</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setEditTarget(admin)}>Edit</Button>
                      {admin.id !== currentAdminDbId && (
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(admin)}>Remove</Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!admins.length && (
            <p className="text-center text-slate-500 text-sm py-8">No admins found.</p>
          )}
        </div>
      )}

      {/* Add admin modal */}
      {showAddModal && (
        <AddAdminModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchAdmins(); setAlert({ msg: "Admin added successfully.", variant: "success" }); }}
          onForceLogout={onForceLogout}
        />
      )}

      {/* Edit admin modal */}
      {editTarget && (
        <EditAdminModal
          admin={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchAdmins(); setAlert({ msg: "Admin updated.", variant: "success" }); }}
          onForceLogout={onForceLogout}
        />
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <Popup
          type="confirm"
          message={`Remove admin "${deleteTarget.name}" (${deleteTarget.admin_id})? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
          confirmLabel="Remove"
          danger
        />
      )}

      {/* Alert popup */}
      {alert && (
        <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />
      )}
    </div>
  );
}

// ─── Add Admin Modal ──────────────────────────────────────────────────────────
function AddAdminModal({ onClose, onSuccess, onForceLogout }: {
  onClose: () => void; onSuccess: () => void; onForceLogout: () => void;
}) {
  const [name,    setName]    = useState("");
  const [adminId, setAdminId] = useState("");
  const [error,   setError]   = useState("");
  const [saving,  setSaving]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const res  = await fetch("/api/admin/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, adminId }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) onSuccess();
    else setError(json.error);
  }

  return (
    <Modal title="Add New Admin" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Das" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Admin ID</label>
          <input value={adminId} onChange={(e) => setAdminId(e.target.value.toUpperCase())} placeholder="e.g. A002" maxLength={4} required />
          <p className="text-xs text-slate-500 mt-1">Format: A followed by 3 digits (A001–A999)</p>
        </div>
        <p className="text-xs text-slate-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          ⚠ No password is set now. The admin will set their password on first login.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose} size="sm">Cancel</Button>
          <Button type="submit" loading={saving} size="sm">Add Admin</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit Admin Modal ─────────────────────────────────────────────────────────
function EditAdminModal({ admin, onClose, onSuccess, onForceLogout }: {
  admin: AdminRow; onClose: () => void; onSuccess: () => void; onForceLogout: () => void;
}) {
  const [name,     setName]     = useState(admin.name);
  const [adminId,  setAdminId]  = useState(admin.admin_id);
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [saving,   setSaving]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const body: Record<string, string> = {};
    if (name    !== admin.name)     body.name    = name;
    if (adminId !== admin.admin_id) body.adminId = adminId;
    if (password)                   body.password = password;

    const res  = await fetch(`/api/admin/manage/${admin.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) onSuccess();
    else setError(json.error);
  }

  return (
    <Modal title={`Edit Admin: ${admin.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Admin ID</label>
          <input value={adminId} onChange={(e) => setAdminId(e.target.value.toUpperCase())} maxLength={4} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">New Password <span className="text-slate-600">(leave blank to keep current)</span></label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose} size="sm">Cancel</Button>
          <Button type="submit" loading={saving} size="sm">Save Changes</Button>
        </div>
      </form>
    </Modal>
  );
}
