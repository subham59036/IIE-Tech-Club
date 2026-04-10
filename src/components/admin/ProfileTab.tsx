/**
 * components/admin/ProfileTab.tsx
 * Admins can update their name, ID and password from here.
 * Cookie is refreshed server-side after update.
 */

"use client";

import React, { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import Popup  from "@/components/ui/Popup";

interface Profile { id: number; name: string; user_id: string; created_at: number; }

export default function ProfileTab({ onForceLogout }: { onForceLogout: () => void }) {
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [name,     setName]     = useState("");
  const [userId,   setUserId]   = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [alert,    setAlert]    = useState<{ msg: string; variant: "success"|"error" } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((json) => {
        if (json.forceLogout) { onForceLogout(); return; }
        if (json.ok) {
          const d = json.data;
          const normalised = { ...d, id: Number(d.id), created_at: Number(d.created_at) };
          setProfile(normalised);
          setName(normalised.name);
          setUserId(normalised.user_id);
        }
        setLoading(false);
      });
  }, [onForceLogout]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (password && password !== confirm) {
      setAlert({ msg: "Passwords do not match.", variant: "error" });
      return;
    }
    if (password && password.length < 6) {
      setAlert({ msg: "Password must be at least 6 characters.", variant: "error" });
      return;
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
      setAlert({ msg: "Profile updated successfully.", variant: "success" });
    } else {
      setAlert({ msg: json.error, variant: "error" });
    }
  }

  if (loading) return <div className="text-center py-12 text-slate-500 text-sm">Loading…</div>;

  return (
    <div className="fade-in max-w-md">
      <h2 className="text-base font-semibold text-white mb-4">Profile</h2>

      {/* Info card */}
      {profile && (
        <div className="card mb-6 flex items-center gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl font-bold text-indigo-400 shrink-0">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-white">{profile.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              <code className="text-indigo-400">{profile.user_id}</code>
              {" · "}Admin
              {" · "}Joined {new Date(profile.created_at).toLocaleDateString("en-IN")}
            </p>
          </div>
        </div>
      )}

      {/* Edit form */}
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Admin ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value.toUpperCase())}
            maxLength={4}
            required
          />
          <p className="text-xs text-slate-600 mt-1">Format: A001 – A999. Must be unique.</p>
        </div>

        <hr className="border-slate-800" />

        <p className="text-xs text-slate-500">Change password (leave blank to keep current)</p>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">New Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Confirm Password</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat new password"
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" loading={saving} className="self-start">Save Changes</Button>
      </form>

      {alert && <Popup type="alert" message={alert.msg} variant={alert.variant} onClose={() => setAlert(null)} />}
    </div>
  );
}
