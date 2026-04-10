/**
 * lib/utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Stateless utility functions shared across the app.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHash } from "crypto";

// ─── ID validation ────────────────────────────────────────────────────────────
export const ADMIN_ID_RE   = /^A\d{3}$/;
export const STUDENT_ID_RE = /^S\d{3}$/;

export function isValidAdminId(id: string)   { return ADMIN_ID_RE.test(id);   }
export function isValidStudentId(id: string) { return STUDENT_ID_RE.test(id); }

// ─── Hash IP for privacy-preserving rate-limiting ─────────────────────────────
export function hashIp(ip: string): string {
  return createHash("sha256").update(ip + (process.env.IP_SALT ?? "techos")).digest("hex").slice(0, 32);
}

// ─── Get client IP from Next.js request ──────────────────────────────────────
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────
/** Today as YYYY-MM-DD in UTC */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format Unix ms to readable string */
export function formatTs(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata", // ► CHANGE: adjust timezone if needed
  });
}

/** Return YYYY-MM for a given YYYY-MM-DD date string */
export function yearMonth(date: string): string {
  return date.slice(0, 7);
}

/** All YYYY-MM months from start to today */
export function monthsRange(earliest: string): string[] {
  const result: string[] = [];
  const start = new Date(earliest.slice(0, 7) + "-01");
  const end   = new Date();
  end.setDate(1);
  while (start <= end) {
    result.push(start.toISOString().slice(0, 7));
    start.setMonth(start.getMonth() + 1);
  }
  return result;
}

// ─── Captcha generator ───────────────────────────────────────────────────────
/** Generate a simple addition/subtraction math challenge */
export function generateCaptcha(): { question: string; answer: string } {
  const a  = Math.floor(Math.random() * 15) + 3;
  const b  = Math.floor(Math.random() * 10) + 1;
  const op = Math.random() > 0.5 ? "+" : "-";
  return {
    question: `${a} ${op} ${b}`,
    answer:   String(op === "+" ? a + b : a - b),
  };
}

// ─── Sanitize plain text (prevent injection in notification strings) ──────────
export function sanitize(str: string): string {
  return str.replace(/[<>"'`]/g, "").trim().slice(0, 512);
}
