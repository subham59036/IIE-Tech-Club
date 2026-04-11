/**
 * lib/auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT helpers using `jose` (edge-runtime compatible).
 * Cookies are httpOnly + sameSite=lax + secure (production).
 *
 * Cookie behaviour:
 *   rememberMe = true  → persistent cookie (maxAge 7 days), JWT exp 7d
 *   rememberMe = false → session cookie (no maxAge), JWT exp 8h
 *                        The short JWT exp ensures that even if a browser
 *                        restores session cookies, the token is invalid
 *                        within 8 hours of closing — no ghost logins.
 *
 * Logout behaviour:
 *   clearSessionCookie() overwrites the cookie with an empty value and
 *   maxAge=0 rather than calling delete() — the explicit expiry is the
 *   only reliable cross-browser / Vercel way to kill a cookie immediately.
 *
 * ► CHANGE: Set JWT_SECRET in .env.local to a strong random string.
 *   Generate: openssl rand -hex 64
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies }            from "next/headers";
import type { SessionUser }   from "@/types";

// ─── Secret ──────────────────────────────────────────────────────────────────
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "REPLACE_THIS_WITH_A_STRONG_RANDOM_SECRET_64_CHARS"
);

export const COOKIE_NAME = "techos_session";
const SEVEN_DAYS         = 7 * 24 * 60 * 60; // seconds

// ─── Cookie base options (shared between set and clear) ───────────────────────
function cookieBase() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path:     "/",
  };
}

// ─── Create JWT ──────────────────────────────────────────────────────────────
// `rm` (rememberMe flag) is embedded in the payload so profile updates can
// preserve the original persistence preference without an extra DB round-trip.
export async function createToken(user: SessionUser, rememberMe: boolean): Promise<string> {
  return new SignJWT({ ...user, rm: rememberMe ? 1 : 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    // Remember-me → 7 days.  Session-only → 8 hours (guards against
    // browsers that restore session cookies across restarts).
    .setExpirationTime(rememberMe ? "7d" : "8h")
    .sign(secret);
}

// ─── Verify JWT ──────────────────────────────────────────────────────────────
export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

// ─── Set session cookie ───────────────────────────────────────────────────────
export async function setSessionCookie(user: SessionUser, rememberMe: boolean) {
  const token       = await createToken(user, rememberMe);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    ...cookieBase(),
    // Only add maxAge for persistent sessions.
    // Session cookies (no maxAge) are cleared when the browser session ends,
    // AND the JWT itself expires in 8h as a hard backstop.
    ...(rememberMe ? { maxAge: SEVEN_DAYS } : {}),
  });
}

// ─── Clear session cookie ─────────────────────────────────────────────────────
// IMPORTANT: we use set() with maxAge=0 + expires=epoch rather than delete().
// cookieStore.delete() is sometimes unreliable on Vercel/edge runtimes because
// it does not always send the Set-Cookie header with the correct attributes
// (path, secure, sameSite) needed for the browser to actually remove the cookie.
// Setting an expired value is the RFC-compliant way to forcibly remove a cookie.
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    ...cookieBase(),
    maxAge:  0,
    expires: new Date(0), // belt-and-suspenders: epoch date also expires it
  });
}

// ─── Read current session from cookie ────────────────────────────────────────
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── Read the rememberMe flag from the current JWT ───────────────────────────
// Used by the profile-update route to re-issue the cookie with the same
// persistence the user originally chose at login.
export async function getRememberMe(): Promise<boolean> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret);
    return (payload as { rm?: number }).rm === 1;
  } catch {
    return false;
  }
}

// ─── Read token string (used in middleware) ───────────────────────────────────
export function getTokenFromCookieHeader(cookieHeader: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
