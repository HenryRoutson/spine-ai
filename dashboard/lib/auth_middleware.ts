import type { NextRequest } from "next/server";

export const SESSION_COOKIE = "dashboard_session";

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

function accessKey(): string | undefined {
  return process.env.DASHBOARD_ACCESS_KEY?.trim();
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sessionTokenHex(key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode("dashboard-v1"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// AI : edge middleware verifies the HMAC token (Web Crypto — matches auth.ts node HMAC).
export async function hasValidSessionCookie(req: NextRequest): Promise<boolean> {
  const key = accessKey();
  if (!key) return false;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (!cookie) return false;
  const expected = await sessionTokenHex(key);
  return timingSafeEqualStrings(cookie, expected);
}
