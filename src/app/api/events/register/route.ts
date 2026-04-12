/**
 * POST /api/events/register
 * Public — no auth required (external students can register).
 * Validates: captcha token, rate-limit (3 per IP per hour per event),
 * duplicate roll check, event is live & not expired.
 */

import { NextRequest, NextResponse }                     from "next/server";
import { createHash }                                    from "crypto";
import { dbEvents, dbCaptcha, dbEventRegs, checkRateLimit } from "@/lib/db";
import { sanitize, hashIp, getClientIp, todayUtc }      from "@/lib/utils";

const DEPARTMENTS = ["CSE", "ECE", "EE", "ME", "AIML", "BBA"] as const;

export async function POST(req: NextRequest) {
  try {
    const {
      formToken,
      studentName,
      semester,
      department,
      roll,
      captchaToken,
      captchaAnswer,
    } = await req.json() as {
      formToken:     string;
      studentName:   string;
      semester:      number;
      department:    string;
      roll:          string;
      captchaToken:  string;
      captchaAnswer: string;
    };

    // ── Basic validation ──────────────────────────────────────────────────────
    if (!formToken || !studentName?.trim() || !semester || !department || !roll?.trim() || !captchaToken || !captchaAnswer?.trim()) {
      return NextResponse.json({ ok: false, error: "All fields are required." }, { status: 400 });
    }
    if (semester < 1 || semester > 8 || !Number.isInteger(Number(semester))) {
      return NextResponse.json({ ok: false, error: "Semester must be 1–8." }, { status: 400 });
    }
    if (!(DEPARTMENTS as readonly string[]).includes(department)) {
      return NextResponse.json({ ok: false, error: "Invalid department." }, { status: 400 });
    }

    // ── Fetch event by form_token ─────────────────────────────────────────────
    const evResult = await dbEvents.execute({
      sql:  "SELECT id, status, last_reg_date FROM events WHERE form_token=?",
      args: [formToken],
    });
    if (!evResult.rows.length) {
      return NextResponse.json({ ok: false, error: "Event not found." }, { status: 404 });
    }
    const ev = evResult.rows[0] as unknown as { id: number; status: string; last_reg_date: string };

    if (ev.status !== "live") {
      return NextResponse.json({ ok: false, error: "Registrations are paused for this event." }, { status: 403 });
    }
    if (todayUtc() > ev.last_reg_date) {
      return NextResponse.json({ ok: false, error: "Registration deadline has passed." }, { status: 410 });
    }

    // ── Rate-limit by IP + event ──────────────────────────────────────────────
    const ip      = getClientIp(req);
    const ipHash  = hashIp(ip);
    const allowed = await checkRateLimit(`reg:${ipHash}:${ev.id}`, 3);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
    }

    // ── Captcha verification ──────────────────────────────────────────────────
    const captchaRow = await dbCaptcha.execute({
      sql:  "SELECT answer, created_at FROM captcha_tokens WHERE token=?",
      args: [captchaToken],
    });
    if (!captchaRow.rows.length) {
      return NextResponse.json({ ok: false, error: "Invalid or expired captcha. Refresh and try again." }, { status: 400 });
    }
    const captcha = captchaRow.rows[0] as unknown as { answer: string; created_at: number };

    if (Date.now() - captcha.created_at > 10 * 60 * 1000) {
      await dbCaptcha.execute({ sql: "DELETE FROM captcha_tokens WHERE token=?", args: [captchaToken] });
      return NextResponse.json({ ok: false, error: "Captcha expired. Please refresh." }, { status: 400 });
    }

    const suppliedHash = createHash("sha256").update(captchaAnswer.trim()).digest("hex");
    if (suppliedHash !== captcha.answer) {
      return NextResponse.json({ ok: false, error: "Incorrect captcha answer." }, { status: 400 });
    }

    // Delete used captcha token (one-time use)
    await dbCaptcha.execute({ sql: "DELETE FROM captcha_tokens WHERE token=?", args: [captchaToken] });

    // ── Duplicate roll check ──────────────────────────────────────────────────
    const dupCheck = await dbEventRegs.execute({
      sql:  "SELECT id FROM event_registrations WHERE event_id=? AND roll=?",
      args: [ev.id, roll.trim().toUpperCase()],
    });
    if (dupCheck.rows.length > 0) {
      return NextResponse.json({ ok: false, error: "This roll number has already been registered for this event." }, { status: 409 });
    }

    // ── Insert registration ───────────────────────────────────────────────────
    await dbEventRegs.execute({
      sql:  "INSERT INTO event_registrations (event_id, student_name, semester, department, roll, ip_hash) VALUES (?,?,?,?,?,?)",
      args: [ev.id, sanitize(studentName), Number(semester), department, roll.trim().toUpperCase(), ipHash],
    });

    return NextResponse.json({ ok: true, data: { message: "Registration successful!" } }, { status: 201 });

  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("UNIQUE")) {
      return NextResponse.json({ ok: false, error: "This roll number has already been registered." }, { status: 409 });
    }
    console.error("[register]", err);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
