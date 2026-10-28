import { checkLandingReplayProxyRateLimit } from "@/lib/rate_limit";
import { proxyLandingDemoPost } from "@/lib/spine-proxy";

export async function POST(req: Request): Promise<Response> {
  return proxyLandingDemoPost(req, {
    path: "/api/landing-demo/session-replay",
    checkRateLimit: checkLandingReplayProxyRateLimit,
  });
}
