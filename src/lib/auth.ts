/**
 * lib/auth.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * JWT helpers using `jose` (edge-runtime compatible).
 * Cookies are httpOnly + sameSite=lax + secure (production).
 *
 * ► CHANGE: Set JWT_SECRET in .env.local to a strong random string.
 *   Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionUser } from "@/types";

// ─── Secret ──────────────────────────────────────────────────────────────────
// ► CHANGE: Add JWT_SECRET to your .env.local
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "REPLACE_THIS_WITH_A_STRONG_RANDOM_SECRET_64_CHARS"
);

const COOKIE_NAME = "techos_session";
const SEVEN_DAYS  = 7 * 24 * 60 * 60; // seconds

// ─── Create JWT ──────────────────────────────────────────────────────────────
export async function createToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
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
// rememberMe = true  → persistent 7-day cookie
// rememberMe = false → session cookie (cleared when browser closes)
export async function setSessionCookie(user: SessionUser, rememberMe: boolean) {
  const token       = await createToken(user);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    ...(rememberMe ? { maxAge: SEVEN_DAYS } : {}),
  });
}

// ─── Clear session cookie ─────────────────────────────────────────────────────
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Read current session from cookie ────────────────────────────────────────
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token       = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── Read token string (used in middleware) ───────────────────────────────────
export function getTokenFromCookieHeader(cookieHeader: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
