import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { loadEnvOnce } from "./load_env";

export const SESSION_COOKIE = "dashboard_session";

function accessKey(): string | undefined {
  loadEnvOnce();
  return process.env.DASHBOARD_ACCESS_KEY?.trim();
}

export function verifyAccessKey(candidate: string | null | undefined): boolean {
  const key = accessKey();
  if (!key || !candidate) return false;
  try {
    const a = Buffer.from(candidate);
    const b = Buffer.from(key);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  // AI : block backslash and protocol-relative open redirects.
  if (raw.includes("\\") || raw.includes("://")) return "/";
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("//") || decoded.includes("://") || decoded.includes("\\")) return "/";
  } catch {
    return "/";
  }
  return raw;
}

export function hasAccessKeyConfigured(): boolean {
  return !!accessKey();
}

export function sessionToken(): string | null {
  const key = accessKey();
  if (!key) return null;
  return createHmac("sha256", key).update("dashboard-v1").digest("hex");
}

export function isSessionCookieValid(cookieValue: string | undefined): boolean {
  const token = sessionToken();
  if (!token || !cookieValue) return false;
  try {
    const a = Buffer.from(cookieValue);
    const b = Buffer.from(token);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isAuthenticated(req: NextRequest): boolean {
  return isSessionCookieValid(req.cookies.get(SESSION_COOKIE)?.value);
}

export function isLocalhostOnly(req: NextRequest): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const host = (req.headers.get("host") ?? "").toLowerCase();
  return (
    host === "localhost" ||
    host.startsWith("localhost:") ||
    host === "127.0.0.1" ||
    host.startsWith("127.0.0.1:") ||
    host === "[::1]" ||
    host.startsWith("[::1]:")
  );
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    maxAge: 60 * 60 * 12,
  };
}
