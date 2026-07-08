import { clientIpFromHeaders } from "@/lib/rate_limit";

export const LANDING_PROXY_CLIENT_IP_HEADER = "x-spine-client-ip";
export const LANDING_PROXY_SECRET_HEADER = "x-spine-proxy-secret";

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
  // AI : off Vercel (local dev) the landing demo is called directly — no proxy secret to check.
  if (!process.env.VERCEL) return;
  // AI : SECURITY — fail closed on Vercel. Without a configured secret the public LLM demo endpoint
  // AI : would otherwise be open to anyone; refuse rather than silently no-op the auth check.
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
