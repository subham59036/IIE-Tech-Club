/**
 * lib/db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Turso/libSQL client instance shared across all API routes.
 * All DB helpers live here so schema knowledge is centralised.
 *
 * ► CHANGE: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN come from .env.local
 *   (auto-injected by Vercel's Turso integration – no manual edits needed).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@libsql/client";

// ─── Client singleton ────────────────────────────────────────────────────────
// Vercel's Turso integration sets these env vars automatically.
export const db = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

// ─── Schema initialisation ───────────────────────────────────────────────────
// Run once via `npm run db:init` (see scripts/init-db.ts).
// All tables use INTEGER timestamps (Unix ms) for portability.
export const SCHEMA = `
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  admin_id      TEXT    NOT NULL UNIQUE,   -- e.g. A001
  password_hash TEXT,                       -- NULL = first login not yet set
  created_at    INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  student_id    TEXT    NOT NULL UNIQUE,   -- e.g. S001
  password_hash TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS attendance (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_db_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date             TEXT    NOT NULL,        -- YYYY-MM-DD
  status           TEXT    NOT NULL CHECK(status IN ('present','absent')),
  marked_by_admin  INTEGER NOT NULL,        -- admin DB id
  created_at       INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  UNIQUE(student_db_id, date)               -- one record per student per day
);

CREATE TABLE IF NOT EXISTS announcements (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT    NOT NULL,
  announced_date  TEXT    NOT NULL,         -- user-supplied YYYY-MM-DD
  posted_by_admin INTEGER NOT NULL,         -- admin DB id
  created_at      INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  event_date    TEXT    NOT NULL,           -- YYYY-MM-DD
  last_reg_date TEXT    NOT NULL,           -- YYYY-MM-DD
  status        TEXT    NOT NULL DEFAULT 'live' CHECK(status IN ('live','paused')),
  form_token    TEXT    NOT NULL UNIQUE,    -- random UUID for public URL
  posted_by_admin INTEGER NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS event_registrations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  student_name TEXT    NOT NULL,
  semester     INTEGER NOT NULL,
  department   TEXT    NOT NULL,
  roll         TEXT    NOT NULL,
  ip_hash      TEXT    NOT NULL,            -- hashed IP for dedup / rate-limit
  created_at   INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  UNIQUE(event_id, roll)                    -- one submission per roll per event
);

CREATE TABLE IF NOT EXISTS admin_notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message    TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS student_notifications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  student_db_id    INTEGER NOT NULL,        -- 0 = broadcast to all students
  message          TEXT    NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  key          TEXT    NOT NULL UNIQUE,     -- "reg:<ip_hash>:<event_id>"
  count        INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL             -- Unix ms
);

CREATE TABLE IF NOT EXISTS captcha_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  token      TEXT    NOT NULL UNIQUE,
  answer     TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_db_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date         ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_student_notifications   ON student_notifications(student_db_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations     ON event_registrations(event_id);
`;

// ─── Cleanup helper (called by /api/cron/cleanup) ────────────────────────────
// Deletes stale data to keep the Turso free-tier usage lean.
export async function runCleanup() {
  const now = Date.now();
  const d365 = now - 365 * 24 * 60 * 60 * 1000; // attendance older than 1 year
  const d120 = now - 120 * 24 * 60 * 60 * 1000; // notifications/announcements > 120d
  const d60  = now - 60  * 24 * 60 * 60 * 1000; // events older than 60 days
  const d1   = now -       60 * 60 * 1000;       // captcha tokens older than 1 hour

  await db.batch([
    { sql: "DELETE FROM attendance             WHERE created_at < ?", args: [d365] },
    { sql: "DELETE FROM admin_notifications    WHERE created_at < ?", args: [d120] },
    { sql: "DELETE FROM student_notifications  WHERE created_at < ?", args: [d120] },
    { sql: "DELETE FROM announcements          WHERE created_at < ?", args: [d120] },
    { sql: "DELETE FROM events                 WHERE created_at < ?", args: [d60]  },
    { sql: "DELETE FROM captcha_tokens         WHERE created_at < ?", args: [d1]   },
    { sql: "DELETE FROM rate_limits            WHERE window_start < ?", args: [now - 3600_000] },
  ]);
}

// ─── Rate-limit helper ───────────────────────────────────────────────────────
// Returns true if the action is allowed, false if over limit.
// window = 1 hour, maxRequests per window per key.
export async function checkRateLimit(key: string, maxRequests = 3): Promise<boolean> {
  const now   = Date.now();
  const hour  = 3600_000;

  const row = await db.execute({
    sql:  "SELECT count, window_start FROM rate_limits WHERE key = ?",
    args: [key],
  });

  if (row.rows.length === 0) {
    // First request in window
    await db.execute({
      sql:  "INSERT INTO rate_limits (key, count, window_start) VALUES (?,1,?)",
      args: [key, now],
    });
    return true;
  }

  const { count, window_start } = row.rows[0] as { count: number | bigint; window_start: number | bigint };
  const countN       = Number(count);
  const windowStartN = Number(window_start);

  if (now - windowStartN > hour) {
    // Window expired – reset
    await db.execute({
      sql:  "UPDATE rate_limits SET count=1, window_start=? WHERE key=?",
      args: [now, key],
    });
    return true;
  }

  if (countN >= maxRequests) return false;

  await db.execute({
    sql:  "UPDATE rate_limits SET count=count+1 WHERE key=?",
    args: [key],
  });
  return true;
}

// ─── Notification helpers ────────────────────────────────────────────────────

/** Broadcast an admin notification visible to all admins. */
export async function notifyAdmins(message: string) {
  await db.execute({
    sql:  "INSERT INTO admin_notifications (message) VALUES (?)",
    args: [message],
  });
}

/** Send a notification to a specific student (student_db_id). */
export async function notifyStudent(studentDbId: number, message: string) {
  await db.execute({
    sql:  "INSERT INTO student_notifications (student_db_id, message) VALUES (?,?)",
    args: [studentDbId, message],
  });
}

// ─── Admin existence check (for force-logout validation) ────────────────────
export async function adminExists(id: number): Promise<boolean> {
  const r = await db.execute({
    sql:  "SELECT id FROM admins WHERE id = ?",
    args: [id],
  });
  return r.rows.length > 0;
}

// ─── Student existence check ─────────────────────────────────────────────────
export async function studentExists(id: number): Promise<boolean> {
  const r = await db.execute({
    sql:  "SELECT id FROM students WHERE id = ?",
    args: [id],
  });
  return r.rows.length > 0;
}
