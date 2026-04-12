/**
 * lib/db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Neon serverless PostgreSQL clients — one per table (one Neon project each).
 *
 * Neon API compatibility note (@neondatabase/serverless v1.x):
 *   - v0.x allowed: sql("SELECT $1", [value])         ← REMOVED in v1.x
 *   - v1.x requires either:
 *       a) Tagged template:  sql`SELECT ${value}`
 *       b) Method call:      sql.query("SELECT $1", [value])
 *   We use sql.query() throughout because it accepts a plain string at runtime
 *   and its return type (QueryResult with .rows) is consistent and typed.
 *
 * sql.query() return shape:
 *   { rows: Record<string,unknown>[], rowCount: number, command: string, ... }
 *   We always extract .rows and normalise any BIGINT strings to JS numbers.
 *
 * Lazy initialisation: neon() is called only on the FIRST query, not at
 * module-evaluation time. This prevents boot-time crashes when any env var
 * is temporarily absent.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ─── Row normalisation ────────────────────────────────────────────────────────
// PostgreSQL returns BIGINT columns as strings to prevent JS precision loss.
// Our Unix-ms timestamps (≤16 digits) fit safely in a JS number, so we
// convert them back so the rest of the app can treat them as numbers.
function normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && /^\d{1,16}$/.test(v)) {
      out[k] = Number(v);           // BIGINT string → JS number
    } else if (typeof v === "bigint") {
      out[k] = Number(v);           // native bigint → JS number
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ─── Wrapper factory ──────────────────────────────────────────────────────────
// Accepts a *getter function* for the URL so that neon() is only called on
// the first actual query (lazy init), not at module evaluation time.
function makeDb(getUrl: () => string) {
  // _sql is created once, on the first query, then reused.
  let _sql: NeonQueryFunction<false, false> | null = null;

  function getSql(): NeonQueryFunction<false, false> {
    if (!_sql) {
      const url = getUrl();
      if (!url) {
        throw new Error(
          `[TechOS] A required DATABASE_URL_* environment variable is not set. ` +
          `Ensure all 10 variables are in your .env.local file.`
        );
      }
      _sql = neon(url);
    }
    return _sql;
  }

  return {
    /**
     * Execute one SQL statement.
     * Accepts a plain string or a { sql, args } object (same interface as the
     * old Turso client, so no call-site changes are needed anywhere).
     * Converts `?` placeholders to PostgreSQL's `$N` numbered style.
     * Uses sql.query() — the Neon v1.x API for conventional (non-template) calls.
     */
    async execute(
      query: string | { sql: string; args?: unknown[] }
    ): Promise<{ rows: Record<string, unknown>[] }> {
      let queryStr: string;
      let params: unknown[] = [];

      if (typeof query === "string") {
        queryStr = query;
      } else {
        queryStr = query.sql;
        params   = query.args ?? [];
      }

      // Replace every `?` with $1, $2, … (Turso → PostgreSQL placeholder style)
      let idx = 0;
      const pgQuery = queryStr.replace(/\?/g, () => `$${++idx}`);

      // sql.query() is the Neon v1.x conventional call API.
      // It returns a QueryResult: { rows, rowCount, command, fields }.
      // We only need .rows; the rest is discarded.
      const result = await getSql().query(pgQuery, params);
      return { rows: (result.rows as Record<string, unknown>[]).map(normaliseRow) };
    },

    /**
     * Run multiple statements sequentially — mirrors the old Turso db.batch().
     * Only used by runCleanup().
     */
    async batch(queries: { sql: string; args?: unknown[] }[]): Promise<void> {
      for (const q of queries) {
        await this.execute(q);
      }
    },
  };
}

// ─── One client per Neon project (one per table) ─────────────────────────────
// Arrow functions ensure env vars are read lazily (at first query time).
export const dbAdmins        = makeDb(() => process.env.DATABASE_URL_ADMINS!);
export const dbStudents      = makeDb(() => process.env.DATABASE_URL_STUDENTS!);
export const dbAttendance    = makeDb(() => process.env.DATABASE_URL_ATTENDANCE!);
export const dbAnnouncements = makeDb(() => process.env.DATABASE_URL_ANNOUNCEMENTS!);
export const dbEvents        = makeDb(() => process.env.DATABASE_URL_EVENTS!);
export const dbEventRegs     = makeDb(() => process.env.DATABASE_URL_EVENT_REGISTRATIONS!);
export const dbAdminNotifs   = makeDb(() => process.env.DATABASE_URL_ADMIN_NOTIFICATIONS!);
export const dbStudentNotifs = makeDb(() => process.env.DATABASE_URL_STUDENT_NOTIFICATIONS!);
export const dbRateLimits    = makeDb(() => process.env.DATABASE_URL_RATE_LIMITS!);
export const dbCaptcha       = makeDb(() => process.env.DATABASE_URL_CAPTCHA!);

// ─── PostgreSQL schema strings (one per Neon project) ────────────────────────
export const SCHEMAS: Record<string, string> = {
  admins: `
    CREATE TABLE IF NOT EXISTS admins (
      id            SERIAL PRIMARY KEY,
      name          TEXT   NOT NULL,
      admin_id      TEXT   NOT NULL UNIQUE,
      password_hash TEXT,
      created_at    BIGINT NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
  `,

  students: `
    CREATE TABLE IF NOT EXISTS students (
      id            SERIAL PRIMARY KEY,
      name          TEXT   NOT NULL,
      student_id    TEXT   NOT NULL UNIQUE,
      password_hash TEXT,
      created_at    BIGINT NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
  `,

  attendance: `
    CREATE TABLE IF NOT EXISTS attendance (
      id              SERIAL  PRIMARY KEY,
      student_db_id   INTEGER NOT NULL,
      date            TEXT    NOT NULL,
      status          TEXT    NOT NULL CHECK(status IN ('present','absent')),
      marked_by_admin INTEGER NOT NULL,
      created_at      BIGINT  NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)),
      UNIQUE(student_db_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_db_id, date);
    CREATE INDEX IF NOT EXISTS idx_attendance_date         ON attendance(date);
  `,

  announcements: `
    CREATE TABLE IF NOT EXISTS announcements (
      id              SERIAL  PRIMARY KEY,
      title           TEXT    NOT NULL,
      description     TEXT    NOT NULL,
      announced_date  TEXT    NOT NULL,
      posted_by_admin INTEGER NOT NULL,
      created_at      BIGINT  NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
  `,

  events: `
    CREATE TABLE IF NOT EXISTS events (
      id              SERIAL  PRIMARY KEY,
      title           TEXT    NOT NULL,
      description     TEXT    NOT NULL,
      event_date      TEXT    NOT NULL,
      last_reg_date   TEXT    NOT NULL,
      status          TEXT    NOT NULL DEFAULT 'live' CHECK(status IN ('live','paused')),
      form_token      TEXT    NOT NULL UNIQUE,
      posted_by_admin INTEGER NOT NULL,
      created_at      BIGINT  NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
  `,

  event_registrations: `
    CREATE TABLE IF NOT EXISTS event_registrations (
      id           SERIAL  PRIMARY KEY,
      event_id     INTEGER NOT NULL,
      student_name TEXT    NOT NULL,
      semester     INTEGER NOT NULL,
      department   TEXT    NOT NULL,
      roll         TEXT    NOT NULL,
      ip_hash      TEXT    NOT NULL,
      created_at   BIGINT  NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000)),
      UNIQUE(event_id, roll)
    );
    CREATE INDEX IF NOT EXISTS idx_event_registrations ON event_registrations(event_id);
  `,

  admin_notifications: `
    CREATE TABLE IF NOT EXISTS admin_notifications (
      id         SERIAL PRIMARY KEY,
      message    TEXT   NOT NULL,
      created_at BIGINT NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
  `,

  student_notifications: `
    CREATE TABLE IF NOT EXISTS student_notifications (
      id            SERIAL  PRIMARY KEY,
      student_db_id INTEGER NOT NULL,
      message       TEXT    NOT NULL,
      created_at    BIGINT  NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
    CREATE INDEX IF NOT EXISTS idx_student_notifications ON student_notifications(student_db_id);
  `,

  rate_limits: `
    CREATE TABLE IF NOT EXISTS rate_limits (
      id           SERIAL  PRIMARY KEY,
      key          TEXT    NOT NULL UNIQUE,
      count        INTEGER NOT NULL DEFAULT 1,
      window_start BIGINT  NOT NULL
    );
  `,

  captcha_tokens: `
    CREATE TABLE IF NOT EXISTS captcha_tokens (
      id         SERIAL PRIMARY KEY,
      token      TEXT   NOT NULL UNIQUE,
      answer     TEXT   NOT NULL,
      created_at BIGINT NOT NULL DEFAULT (FLOOR(EXTRACT(EPOCH FROM NOW()) * 1000))
    );
  `,
};

// ─── Cleanup (called by /api/cron/cleanup) ────────────────────────────────────
export async function runCleanup() {
  const now  = Date.now();
  const d365 = now - 365 * 24 * 60 * 60 * 1000;
  const d120 = now - 120 * 24 * 60 * 60 * 1000;
  const d60  = now -  60 * 24 * 60 * 60 * 1000;
  const d1   = now -       60 * 60 * 1000;

  await Promise.all([
    dbAttendance.execute({    sql: "DELETE FROM attendance WHERE created_at < ?",            args: [d365] }),
    dbAdminNotifs.execute({   sql: "DELETE FROM admin_notifications WHERE created_at < ?",   args: [d120] }),
    dbStudentNotifs.execute({ sql: "DELETE FROM student_notifications WHERE created_at < ?", args: [d120] }),
    dbAnnouncements.execute({ sql: "DELETE FROM announcements WHERE created_at < ?",         args: [d120] }),
    dbEvents.execute({        sql: "DELETE FROM events WHERE created_at < ?",                args: [d60]  }),
    dbCaptcha.execute({       sql: "DELETE FROM captcha_tokens WHERE created_at < ?",        args: [d1]   }),
    dbRateLimits.execute({    sql: "DELETE FROM rate_limits WHERE window_start < ?",         args: [now - 3_600_000] }),
  ]);
}

// ─── Rate-limit helper ────────────────────────────────────────────────────────
export async function checkRateLimit(key: string, maxRequests = 3): Promise<boolean> {
  const now  = Date.now();
  const hour = 3_600_000;

  const row = await dbRateLimits.execute({
    sql:  "SELECT count, window_start FROM rate_limits WHERE key = ?",
    args: [key],
  });

  if (row.rows.length === 0) {
    await dbRateLimits.execute({
      sql:  "INSERT INTO rate_limits (key, count, window_start) VALUES (?,1,?)",
      args: [key, now],
    });
    return true;
  }

  const { count, window_start } = row.rows[0] as {
    count: number | bigint | string;
    window_start: number | bigint | string;
  };
  const countN       = Number(count);
  const windowStartN = Number(window_start);

  if (now - windowStartN > hour) {
    await dbRateLimits.execute({
      sql:  "UPDATE rate_limits SET count=1, window_start=? WHERE key=?",
      args: [now, key],
    });
    return true;
  }

  if (countN >= maxRequests) return false;

  await dbRateLimits.execute({
    sql:  "UPDATE rate_limits SET count=count+1 WHERE key=?",
    args: [key],
  });
  return true;
}

// ─── Notification helpers ─────────────────────────────────────────────────────
export async function notifyAdmins(message: string) {
  await dbAdminNotifs.execute({
    sql:  "INSERT INTO admin_notifications (message) VALUES (?)",
    args: [message],
  });
}

export async function notifyStudent(studentDbId: number, message: string) {
  await dbStudentNotifs.execute({
    sql:  "INSERT INTO student_notifications (student_db_id, message) VALUES (?,?)",
    args: [studentDbId, message],
  });
}

export async function adminExists(id: number): Promise<boolean> {
  const r = await dbAdmins.execute({
    sql:  "SELECT id FROM admins WHERE id = ?",
    args: [id],
  });
  return r.rows.length > 0;
}

export async function studentExists(id: number): Promise<boolean> {
  const r = await dbStudents.execute({
    sql:  "SELECT id FROM students WHERE id = ?",
    args: [id],
  });
  return r.rows.length > 0;
}
