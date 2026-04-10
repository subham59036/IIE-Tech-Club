/**
 * POST /api/auth/logout
 * Clears the session cookie and redirects to login.
 */

import { NextResponse }   from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
