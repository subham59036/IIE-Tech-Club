/**
 * middleware.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Edge middleware (runs before every matched request).
 * Protects /admin and /student routes using JWT cookie validation.
 * Uses `jose` directly (edge-compatible – no Node.js APIs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "REPLACE_THIS_WITH_A_STRONG_RANDOM_SECRET_64_CHARS"
);

const COOKIE_NAME = "techos_session";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token        = req.cookies.get(COOKIE_NAME)?.value;

  // ─── Helper: redirect to login ─────────────────────────────────────────────
  const toLogin = () => NextResponse.redirect(new URL("/", req.url));

  // ─── Parse and verify token (silently fails to null on any error) ──────────
  let payload: { role?: string } | null = null;
  if (token) {
    try {
      const { payload: p } = await jwtVerify(token, secret);
      payload = p as { role?: string };
    } catch {
      payload = null;
    }
  }

  // ─── /admin/* requires admin role ─────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!payload || payload.role !== "admin") return toLogin();
  }

  // ─── /student/* requires student role ────────────────────────────────────
  if (pathname.startsWith("/student")) {
    if (!payload || payload.role !== "student") return toLogin();
  }

  // ─── /event/* is public – no auth needed ─────────────────────────────────
  // ─── / (login) redirect authenticated users to their dashboard ───────────
  if (pathname === "/") {
    if (payload?.role === "admin")   return NextResponse.redirect(new URL("/admin",   req.url));
    if (payload?.role === "student") return NextResponse.redirect(new URL("/student", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on these paths
  matcher: ["/", "/admin/:path*", "/student/:path*"],
};
