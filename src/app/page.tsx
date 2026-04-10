/**
 * app/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Login page for both admins and students.
 * Role is inferred from the ID prefix (A → admin, S → student).
 * "Remember Me" determines whether the cookie persists 7 days.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, FormEvent } from "react";
import { useRouter }           from "next/navigation";
import Image                   from "next/image";
import Button                  from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();

  const [userId,     setUserId]     = useState("");
  const [password,   setPassword]   = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    const res  = await fetch("/api/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: userId.trim(), password, rememberMe }),
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) { setError(json.error ?? "Login failed."); return; }

    // Redirect based on role
    if (json.data.role === "admin")   router.replace("/admin");
    else                               router.replace("/student");
  }

  // Derive hint from ID prefix
  const idHint =
    userId.startsWith("A") ? "Admin account" :
    userId.startsWith("S") ? "Student account" : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {/* ── Login card ─────────────────────────────────────────────────────── */}
      <div className="card w-full max-w-sm fade-in">
        {/* Logo + branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-14 h-14 mb-3">
            <Image
              src="/logo.png"
              alt="IIE Tech Club"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">TechOS</h1>
          <p className="text-xs text-slate-500 mt-1">IIE Tech Club Management System</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              ID
              {idHint && (
                <span className="ml-2 text-indigo-400 font-normal">{idHint}</span>
              )}
            </label>
            <input
              value={userId}
              onChange={(e) => { setUserId(e.target.value.toUpperCase()); setError(""); }}
              placeholder="A001 or S001"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
            <p className="text-[11px] text-slate-600 mt-1">
              First time? Enter any password to set it permanently.
            </p>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div
              onClick={() => setRememberMe((v) => !v)}
              className={[
                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all",
                rememberMe
                  ? "bg-indigo-600 border-indigo-500"
                  : "border-slate-600 group-hover:border-slate-400",
              ].join(" ")}
            >
              {rememberMe && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
            </div>
            <span className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors">
              Remember Me On This Device
            </span>
            <span className="text-[10px] text-slate-600">(7 days)</span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" loading={loading} size="lg" className="mt-1 w-full">
            Sign In
          </Button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-[11px] text-slate-700">
        TechOS · IIE Tech Club · {new Date().getFullYear()}
      </p>
    </div>
  );
}
