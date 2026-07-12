import { clientIpFromHeaders } from "@/lib/rate_limit";
import {
  LANDING_PROXY_CLIENT_IP_HEADER,
  LANDING_PROXY_SECRET_HEADER,
} from "@shared/landing-proxy/headers";

export { LANDING_PROXY_CLIENT_IP_HEADER, LANDING_PROXY_SECRET_HEADER };

function landingProxySecret(): string | undefined {
  return process.env.LANDING_DEMO_PROXY_SECRET?.trim();
}

export function isValidLandingProxyRequest(headers: Headers): boolean {
  const secret = landingProxySecret();
  if (!secret) return false;
  return headers.get(LANDING_PROXY_SECRET_HEADER) === secret;
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
  if (!landingProxySecret() || !isValidLandingProxyRequest(headers)) {
    throw new LandingProxyAuthError();
  }
}

export class LandingProxyAuthError extends Error {
  constructor() {
    super("Landing demo proxy unauthorized");
    this.name = "LandingProxyAuthError";
  }
}
