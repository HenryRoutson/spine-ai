import { checkLandingProxyRateLimit } from "@/lib/rate_limit";
import { proxyLandingDemoPost } from "@/lib/spine-proxy";

export async function POST(req: Request): Promise<Response> {
  return proxyLandingDemoPost(req, {
    path: "/api/landing-demo/signup",
    checkRateLimit: checkLandingProxyRateLimit,
    unreachableDetail: "If the app runs elsewhere, set SPINE_API_URL on the landing page to match.",
  });
}
