import { clientIpFromHeaders } from "@/lib/rate_limit";
import {
  LANDING_PROXY_CLIENT_IP_HEADER,
  LANDING_PROXY_SECRET_HEADER,
} from "@shared/landing-proxy/headers";

export { LANDING_PROXY_CLIENT_IP_HEADER, LANDING_PROXY_SECRET_HEADER };

// AI : diagnostic codes — never include secret values; safe to return to landing proxy / ops logs.
export type landing_proxy_auth_failure =
  | "proxy_secret_not_configured"
  | "proxy_header_missing"
  | "proxy_secret_mismatch";

// AI : bracket access avoids Next build-time inlining of undefined when the var was added after deploy.
function landingProxySecret(): string | undefined {
  const raw = process.env["LANDING_DEMO_PROXY_SECRET"];
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function isValidLandingProxyRequest(headers: Headers): boolean {
  const secret = landingProxySecret();
  if (!secret) return false;
  return headers.get(LANDING_PROXY_SECRET_HEADER) === secret;
}

function proxyAuthFailure(headers: Headers): landing_proxy_auth_failure | null {
  const secret = landingProxySecret();
  if (!secret) return "proxy_secret_not_configured";
  const presented = headers.get(LANDING_PROXY_SECRET_HEADER);
  if (!presented) return "proxy_header_missing";
  if (presented !== secret) return "proxy_secret_mismatch";
  return null;
}

// AI : landing page sets client IP via authenticated proxy header — ignore spoofed X-Forwarded-For.
export function clientIpForLandingDemo(headers: Headers): string {
  if (isValidLandingProxyRequest(headers)) {
    const proxyIp = headers.get(LANDING_PROXY_CLIENT_IP_HEADER)?.trim();
    if (proxyIp) return proxyIp;
  }
  return clientIpFromHeaders(headers);
}

export function assertLandingProxyAllowed(headers: Headers): void {
  // AI : SECURITY — only skip proxy auth in true local-dev. Self-hosted / Railway / Docker prod
  // AI : must present LANDING_DEMO_PROXY_SECRET even when VERCEL is unset.
  // AI : TODO security — document LANDING_DEMO_PROXY_SECRET as required on every hosted deploy
  // AI : (not just Vercel); misconfigured self-host without the secret fails closed (good) but
  // AI : operators need a clear setup checklist.
  const isLocalDev = process.env.NODE_ENV === "development" && !process.env.VERCEL;
  if (isLocalDev) return;
  // AI : SECURITY — fail closed in any hosted environment. Without a configured secret the public
  // AI : LLM demo endpoint would otherwise be open to anyone; refuse rather than silently no-op.
  const failure = proxyAuthFailure(headers);
  if (failure) {
    console.error("[landing-proxy-auth]", failure, {
      hasSecret: Boolean(landingProxySecret()),
      hasHeader: Boolean(headers.get(LANDING_PROXY_SECRET_HEADER)),
    });
    throw new LandingProxyAuthError(failure);
  }
}

export class LandingProxyAuthError extends Error {
  readonly code: landing_proxy_auth_failure;

  constructor(code: landing_proxy_auth_failure = "proxy_secret_mismatch") {
    super("Landing demo proxy unauthorized");
    this.name = "LandingProxyAuthError";
    this.code = code;
  }
}
