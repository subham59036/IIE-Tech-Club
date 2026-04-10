/**
 * app/event/[token]/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Public event registration form. No authentication required.
 * External students (from other colleges) can also fill this form.
 * Fetches event details by token, shows captcha, submits registration.
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useState, useEffect, use, type FormEvent } from "react";
import Image  from "next/image";
import Button from "@/components/ui/Button";
import Popup  from "@/components/ui/Popup";

const DEPARTMENTS = ["CSE","ECE","EE","ME","AIML","BBA"] as const;

interface EventInfo {
  id:            number;
  title:         string;
  description:   string;
  event_date:    string;
  last_reg_date: string;
  status:        string;
  is_expired:    boolean;
}

interface CaptchaData { token: string; question: string; }

export default function EventFormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  const [event,     setEvent]     = useState<EventInfo | null>(null);
  const [notFound,  setNotFound]  = useState(false);
  const [pageLoad,  setPageLoad]  = useState(true);

  // Form state
  const [name,       setName]       = useState("");
  const [semester,   setSemester]   = useState("");
  const [dept,       setDept]       = useState("");
  const [roll,       setRoll]       = useState("");
  const [captcha,    setCaptcha]    = useState<CaptchaData | null>(null);
  const [captchaAns, setCaptchaAns] = useState("");
  const [captchaLoad,setCaptchaLoad]= useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);
  const [error,      setError]      = useState("");

  // ─── Fetch event info ───────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/events/public?token=${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) { setNotFound(true); }
        else           { setEvent(json.data); }
        setPageLoad(false);
      });
  }, [token]);

  // ─── Fetch captcha on mount (and after each submission) ────────────────────
  async function loadCaptcha() {
    setCaptchaLoad(true);
    setCaptchaAns("");
    const res  = await fetch("/api/events/captcha");
    const json = await res.json();
    if (json.ok) setCaptcha(json.data);
    setCaptchaLoad(false);
  }

  useEffect(() => { if (event && !event.is_expired && event.status === "live") loadCaptcha(); }, [event]);

  // ─── Submit registration ────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!captcha) { setError("Please wait for the captcha to load."); return; }
    setError(""); setSubmitting(true);

    const res  = await fetch("/api/events/register", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formToken:    token,
        studentName:  name,
        semester:     Number(semester),
        department:   dept,
        roll:         roll,
        captchaToken: captcha.token,
        captchaAnswer: captchaAns,
      }),
    });
    const json = await res.json();
    setSubmitting(false);

    if (json.ok) {
      setSuccess(true);
    } else {
      setError(json.error ?? "Submission failed.");
      // Refresh captcha on error
      await loadCaptcha();
    }
  }

  // ─── Render states ──────────────────────────────────────────────────────────
  if (pageLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner w-8 h-8 border-2" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl mb-4">🔍</div>
        <h2 className="text-lg font-semibold text-white mb-2">Event Not Found</h2>
        <p className="text-slate-500 text-sm">This registration link is invalid or has been removed.</p>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start py-10 px-4">
      {/* Branding header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="relative w-10 h-10">
          <Image src="/logo.png" alt="IIE Tech Club" fill className="object-contain" />
        </div>
        <div>
          <p className="text-xs text-slate-500">IIE Tech Club</p>
          <p className="text-sm font-semibold text-white">Event Registration</p>
        </div>
      </div>

      {/* Event card */}
      <div className="card w-full max-w-lg mb-6 fade-in">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-lg font-bold text-white">{event.title}</h1>
          <span className={event.is_expired ? "badge-expired" : event.status === "live" ? "badge-live" : "badge-paused"}>
            {event.is_expired ? "CLOSED" : event.status.toUpperCase()}
          </span>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed whitespace-pre-wrap mb-4">{event.description}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
          <span>🗓 Event: <strong className="text-white">{event.event_date}</strong></span>
          <span>⏰ Register by: <strong className="text-white">{event.last_reg_date}</strong></span>
        </div>
      </div>

      {/* Gating states */}
      {event.is_expired ? (
        <div className="card w-full max-w-lg text-center py-8 fade-in">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-white font-medium">Registration Closed</p>
          <p className="text-slate-500 text-sm mt-1">The deadline for this event has passed.</p>
        </div>
      ) : event.status === "paused" ? (
        <div className="card w-full max-w-lg text-center py-8 fade-in">
          <p className="text-3xl mb-3">⏸</p>
          <p className="text-white font-medium">Registrations Paused</p>
          <p className="text-slate-500 text-sm mt-1">The admin has temporarily paused registrations. Please check back later.</p>
        </div>
      ) : success ? (
        <div className="card w-full max-w-lg text-center py-10 fade-in">
          <p className="text-4xl mb-3">🎉</p>
          <p className="text-xl font-bold text-green-400 mb-2">Registered!</p>
          <p className="text-slate-400 text-sm">You have successfully registered for <strong className="text-white">{event.title}</strong>.</p>
        </div>
      ) : (
        // ── Registration form ─────────────────────────────────────────────────
        <div className="card w-full max-w-lg fade-in">
          <h2 className="text-sm font-semibold text-white mb-4">Fill in your details</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Semester</label>
                <select value={semester} onChange={(e) => setSemester(e.target.value)} required>
                  <option value="">Select</option>
                  {[1,2,3,4,5,6,7,8].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">Department</label>
                <select value={dept} onChange={(e) => setDept(e.target.value)} required>
                  <option value="">Select</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Roll Number</label>
              <input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 22CSE045" required />
            </div>

            {/* Captcha */}
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-900/40">
              <label className="block text-xs text-slate-400 mb-2">
                Security Check
                <button
                  type="button"
                  onClick={loadCaptcha}
                  className="ml-2 text-indigo-400 hover:text-indigo-300 transition-colors"
                  disabled={captchaLoad}
                  title="Refresh captcha"
                >↺</button>
              </label>
              {captchaLoad ? (
                <p className="text-xs text-slate-500">Loading captcha…</p>
              ) : captcha ? (
                <div className="flex items-center gap-3">
                  <span className="text-white font-mono text-base bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 shrink-0">
                    {captcha.question} = ?
                  </span>
                  <input
                    value={captchaAns}
                    onChange={(e) => setCaptchaAns(e.target.value)}
                    placeholder="Answer"
                    className="w-24"
                    required
                    type="number"
                  />
                </div>
              ) : (
                <p className="text-xs text-red-400">Failed to load captcha. <button type="button" onClick={loadCaptcha} className="text-indigo-400">Retry</button></p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={submitting} size="lg" className="w-full" disabled={!captcha}>
              Submit Registration
            </Button>

            <p className="text-[11px] text-slate-600 text-center">
              By submitting you confirm the details are correct. Duplicate entries will be rejected.
            </p>
          </form>
        </div>
      )}

      {/* Footer */}
      <p className="mt-8 text-[11px] text-slate-700">TechOS · IIE Tech Club · {new Date().getFullYear()}</p>
    </div>
  );
}
