/**
 * scripts/init-db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Run ONCE to create all tables across all 10 Neon projects.
 * Usage: npm run db:init
 *
 * Neon v1.x API note:
 *   sql(string, params)       ← REMOVED in v1.x, throws at runtime
 *   sql.query(string, params) ← the correct v1.x conventional-call API
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve }                  from "node:path";

// ─── Load env file synchronously before anything else ────────────────────────
const envFile = existsSync(resolve(process.cwd(), ".env.production"))
  ? ".env.production"
  : ".env.local";
const envPath = resolve(process.cwd(), envFile);

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && !k.startsWith("#") && v.length) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
  console.log(`📂 Loaded env from ${envFile}`);
}

// ─── Table → env var mapping ──────────────────────────────────────────────────
const TABLE_ENVS: Record<string, string> = {
  admins:                "DATABASE_URL_ADMINS",
  students:              "DATABASE_URL_STUDENTS",
  attendance:            "DATABASE_URL_ATTENDANCE",
  announcements:         "DATABASE_URL_ANNOUNCEMENTS",
  events:                "DATABASE_URL_EVENTS",
  event_registrations:   "DATABASE_URL_EVENT_REGISTRATIONS",
  admin_notifications:   "DATABASE_URL_ADMIN_NOTIFICATIONS",
  student_notifications: "DATABASE_URL_STUDENT_NOTIFICATIONS",
  rate_limits:           "DATABASE_URL_RATE_LIMITS",
  captcha_tokens:        "DATABASE_URL_CAPTCHA",
};

// ─── Main async function ──────────────────────────────────────────────────────
// All await calls live inside here — this avoids the CJS top-level-await error.
async function init() {
  // Dynamic imports are valid inside async functions even in CJS output.
  // We import here (not at the file top) so env vars are guaranteed loaded first.
  const { neon }    = await import("@neondatabase/serverless");
  const { SCHEMAS } = await import("../src/lib/db");

  async function initTable(tableName: string, envVar: string) {
    const url = process.env[envVar];
    if (!url) {
      console.error(`❌  ${envVar} is not set — skipping "${tableName}"`);
      return;
    }

    // neon() returns a NeonQueryFunction. In Neon v1.x the conventional
    // (non-template) way to run a plain SQL string is via .query().
    const sqlFn = neon(url);
    console.log(`\n🔗  [${tableName}] Connecting…`);

    // Each schema string may contain multiple statements separated by semicolons
    // (e.g. CREATE TABLE + CREATE INDEX). Split and run each one individually
    // because Neon's HTTP driver executes a single statement per request.
    const statements = (SCHEMAS[tableName] ?? "")
      .split(";")
      .map((s: string) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      // sql.query(string) — the Neon v1.x API for a conventional function call
      await sqlFn.query(stmt + ";");
    }

    console.log(`✅  [${tableName}] Tables/indexes created.`);
  }

  console.log("═══════════════════════════════════════════");
  console.log("  TechOS — Neon Database Initialisation");
  console.log("═══════════════════════════════════════════");

  // Init all 10 tables in parallel (each hits its own independent Neon project)
  await Promise.all(
    Object.entries(TABLE_ENVS).map(([table, env]) => initTable(table, env))
  );

  // ── Seed the default admin row ────────────────────────────────────────────
  const adminsUrl = process.env.DATABASE_URL_ADMINS;
  if (adminsUrl) {
    const sqlFn = neon(adminsUrl);
    // sql.query() with $N params — the correct v1.x parameterised-query API
    await sqlFn.query(
      "INSERT INTO admins (name, admin_id) VALUES ($1, $2) ON CONFLICT (admin_id) DO NOTHING",
      ["Default Admin", "A001"]
    );
    console.log("\n🌱  Default admin seeded: ID = A001  (no password yet).");
  }

  console.log("");
  console.log("📝  Next step: log in with ID A001.");
  console.log("    Whatever password you enter on first login becomes permanent.");
  console.log("");
  console.log("    To add more admins later, use the dashboard or:");
  console.log("    INSERT INTO admins (name, admin_id) VALUES ('Name','A002') ON CONFLICT DO NOTHING;");
  console.log("═══════════════════════════════════════════");
}

init().catch((e) => {
  console.error("❌  Init failed:", e);
  process.exit(1);
});
