import { createHmac, timingSafeEqual } from "node:crypto";
import type { ProjectId } from "./types";

export type landing_build_access_token = string & { __brand: "landing_build_access_token" };

// AI : SECURITY — HMAC gate for /api/demo/state?buildId=… so build IDs alone are not enumerable.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const LOCAL_DEV_LANDING_BUILD_SECRET = "local-dev-landing-build-access";
export const LANDING_BUILD_SECRET_REQUIRED =
  "LANDING_BUILD_ACCESS_SECRET or LANDING_DEMO_PROXY_SECRET required on hosted deploys";

function isHostedLandingBuild(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

// AI : DONE (jank-landing-secret) — hosted deploys fail closed; never sign with the service-role key.
export function resolveLandingBuildSigningSecret(): string | null {
  const secret =
    process.env.LANDING_BUILD_ACCESS_SECRET?.trim() ||
    process.env.LANDING_DEMO_PROXY_SECRET?.trim();
  if (secret) return secret;
  if (isHostedLandingBuild()) return null;
  return LOCAL_DEV_LANDING_BUILD_SECRET;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payload: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(payload).digest());
}

export function mintLandingBuildAccessToken(buildId: ProjectId): landing_build_access_token {
  const secret = resolveLandingBuildSigningSecret();
  if (!secret) throw new Error(LANDING_BUILD_SECRET_REQUIRED);
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${buildId}.${exp}`;
  return `${payload}.${signPayload(payload, secret)}` as landing_build_access_token;
}

export function verifyLandingBuildAccessToken(
  buildId: string,
  token: string | null | undefined,
): boolean {
  const secret = resolveLandingBuildSigningSecret();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expRaw, sig] = parts;
  if (id !== buildId) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const payload = `${id}.${expRaw}`;
  const expected = signPayload(payload, secret);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
