/**
 * components/admin/StudentsTab.tsx
 * Lists all students. Add / Edit / Remove with modal forms.
 */

"use client";

import React, { useState, useEffect, useCallback } from "react";
import Button from "@/components/ui/Button";
import Modal  from "@/components/ui/Modal";
import Popup  from "@/components/ui/Popup";

interface StudentRow {
  id:           number;
  name:         string;
  student_id:   string;
  has_password: number;
  created_at:   number;
}

export default function StudentsTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [students,      setStudents]      = useState<StudentRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [editTarget,    setEditTarget]    = useState<StudentRow | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<StudentRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [alert,         setAlert]         = useState<{ msg: string; variant: "success"|"error" } | null>(null);
  const [search,        setSearch]        = useState("");

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const res  = await fetch("/api/student/manage");
    const json = await res.json();
    if (json.forceLogout) { onForceLogout(); return; }
    // Normalise libSQL bigint id fields to JS number
    if (json.ok) setStudents(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (json.data as any[]).map((r) => ({ ...r, id: Number(r.id) }))
    );
    setLoading(false);
  }, [onForceLogout]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    const res  = await fetch(`/api/student/manage/${deleteTarget.id}`, { method: "DELETE" });
    const json = await res.json();
    setDeleteLoading(false);
    setDeleteTarget(null);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) { setAlert({ msg: "Student removed.", variant: "success" }); fetchStudents(); }
    else          setAlert({ msg: json.error, variant: "error" });
  }

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-semibold text-white">Students ({students.length})</h2>
        <div className="flex gap-2">
          <input
            placeholder="Search name or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-44 text-xs"
          />
          <Button size="sm" onClick={() => setShowAddModal(true)}>+ Add</Button>
        </div>
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
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-800/50 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 text-slate-200">{s.name}</td>
                  <td className="py-3">
                    <code className="text-cyan-400 text-xs bg-cyan-400/10 px-2 py-0.5 rounded">{s.student_id}</code>
                  </td>
                  <td className="py-3 hidden sm:table-cell">
                    {!s.has_password && (
                      <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">Awaiting login</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button variant="secondary" size="sm" onClick={() => setEditTarget(s)}>Edit</Button>
                      <Button variant="danger"    size="sm" onClick={() => setDeleteTarget(s)}>Remove</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="text-center text-slate-500 text-sm py-8">
              {search ? "No students match your search." : "No students found."}
            </p>
          )}
        </div>
      )}

      {showAddModal && (
        <AddStudentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchStudents(); setAlert({ msg: "Student added.", variant: "success" }); }}
          onForceLogout={onForceLogout}
        />
      )}
      {editTarget && (
        <EditStudentModal
          student={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); fetchStudents(); setAlert({ msg: "Student updated.", variant: "success" }); }}
          onForceLogout={onForceLogout}
        />
      )}
      {deleteTarget && (
        <Popup
          type="confirm"
          message={`Remove "${deleteTarget.name}" (${deleteTarget.student_id})? All their attendance data will also be deleted.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
          confirmLabel="Remove"
          danger
        />
      )}
      {alert && <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />}
    </div>
  );
}

function AddStudentModal({ onClose, onSuccess, onForceLogout }: {
  onClose: () => void; onSuccess: () => void; onForceLogout: () => void;
}) {
  const [name,      setName]      = useState("");
  const [studentId, setStudentId] = useState("");
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const res  = await fetch("/api/student/manage", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, studentId }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) onSuccess();
    else setError(json.error);
  }

  return (
    <Modal title="Add New Student" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya Sharma" required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Student ID</label>
          <input value={studentId} onChange={(e) => setStudentId(e.target.value.toUpperCase())} placeholder="e.g. S001" maxLength={4} required />
          <p className="text-xs text-slate-500 mt-1">Format: S followed by 3 digits (S001–S999)</p>
        </div>
        <p className="text-xs text-slate-500 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
          ⚠ No password is set now. The student will set their password on first login.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" type="button" onClick={onClose} size="sm">Cancel</Button>
          <Button type="submit" loading={saving} size="sm">Add Student</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditStudentModal({ student, onClose, onSuccess, onForceLogout }: {
  student: StudentRow; onClose: () => void; onSuccess: () => void; onForceLogout: () => void;
}) {
  const [name,      setName]      = useState(student.name);
  const [studentId, setStudentId] = useState(student.student_id);
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");
  const [saving,    setSaving]    = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    const body: Record<string, string> = {};
    if (name      !== student.name)       body.name      = name;
    if (studentId !== student.student_id) body.studentId = studentId;
    if (password)                          body.password  = password;

    const res  = await fetch(`/api/student/manage/${student.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (json.forceLogout) { onForceLogout(); return; }
    if (json.ok) onSuccess();
    else setError(json.error);
  }

  return (
    <Modal title={`Edit Student: ${student.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Student ID</label>
          <input value={studentId} onChange={(e) => setStudentId(e.target.value.toUpperCase())} maxLength={4} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">New Password <span className="text-slate-600">(optional)</span></label>
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
