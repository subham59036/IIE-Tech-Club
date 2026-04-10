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
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const [k, ...v] = line.split("=");
    if (k && !k.startsWith("#") && v.length) {
      process.env[k.trim()] = v.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

import { createClient } from "@libsql/client";
import { SCHEMA }        from "../src/lib/db";

async function init() {
  const db = createClient({
    url:       process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  console.log("🔗 Connected to Turso database.");
  console.log("⚙️  Running schema migrations…");

  // Split on semicolons, filter empty, execute each statement
  const statements = SCHEMA.split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const sql of statements) {
    await db.execute(sql + ";");
  }

  console.log("✅  Database initialised successfully.");
  console.log("");
  console.log("📝  Next step: create your first admin account.");
  console.log("    You can do this from the login page – use ID A001 and any");
  console.log("    password (it will be set as the permanent password on first login).");
  console.log("");
  console.log("    Or insert one directly:");
  console.log("    INSERT INTO admins (name, admin_id) VALUES ('Your Name', 'A001');");

  db.close();
}

init().catch((e) => {
  console.error("❌  Init failed:", e);
  process.exit(1);
});
