/**
 * scripts/init-db.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Run ONCE to create all tables in your Turso database.
 * Usage: npm run db:init
 *
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// Environment is loaded manually below — no extra process import needed
import { readFileSync, existsSync } from "node:fs";
import { resolve }                  from "node:path";

// Load .env.local manually for script context
const envPath = resolve(process.cwd(), ".env.production");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && !k.startsWith("#") && v.length) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}


async function init() {
  const { SCHEMA } = await import("../src/lib/db");
  const { createClient } = await import("@libsql/client");
  const db = createClient({
    url:       process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log("🔗 Connected to Turso database.");
  console.log("⚙️  Running schema migrations…");

  // Split on semicolons, filter empty, execute each statement
  const statements = SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^PRAGMA\b/i.test(s));

  for (const sql of statements) {
    await db.execute(sql + ";");
  }

  await db.execute(
    "INSERT OR IGNORE INTO admins (name, admin_id) VALUES ('Default Admin', 'A001');"
  );
  console.log("🌱  Default admin seeded: ID = A001  (no password yet).");

  console.log("");
  console.log("📝  Next step: log in with ID A001.");
  console.log("    The admin row has been seeded with no password_hash.");
  console.log("    Whatever password you enter on first login becomes the permanent password.");
  console.log("");
  console.log("    To add more admins later, use the admin dashboard or insert directly:");
  console.log("    INSERT OR IGNORE INTO admins (name, admin_id) VALUES ('Name', 'A002');");

  db.close();
}

init().catch((e) => {
  console.error("❌  Init failed:", e);
  process.exit(1);
});
