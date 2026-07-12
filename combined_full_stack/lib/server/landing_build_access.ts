import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProjectId } from "./types";

export type landing_build_access_token = string & { __brand: "landing_build_access_token" };

// AI : SECURITY — HMAC gate for /api/demo/state?buildId=… so build IDs alone are not enumerable.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function signingSecret(): string {
  // AI : TODO security — require LANDING_BUILD_ACCESS_SECRET in hosted deploys; never fall through to
  // AI : the hardcoded local-dev string (or service-role key reuse) outside NODE_ENV=development.
  return (
    process.env.LANDING_BUILD_ACCESS_SECRET?.trim() ||
    process.env.LANDING_DEMO_PROXY_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "local-dev-landing-build-access"
  );
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payload: string): string {
  return b64url(createHmac("sha256", signingSecret()).update(payload).digest());
}

export function mintLandingBuildAccessToken(buildId: ProjectId): landing_build_access_token {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${buildId}.${exp}`;
  return `${payload}.${signPayload(payload)}` as landing_build_access_token;
}

export function verifyLandingBuildAccessToken(
  buildId: string,
  token: string | null | undefined,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expRaw, sig] = parts;
  if (id !== buildId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${id}.${expRaw}`;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
