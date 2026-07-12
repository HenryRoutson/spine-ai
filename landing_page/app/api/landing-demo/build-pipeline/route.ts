import { checkLandingProxyRateLimit } from "@/lib/rate_limit";
import { proxyLandingDemoPost } from "@/lib/spine-proxy";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return proxyLandingDemoPost(req, {
    path: "/api/landing-demo/build-pipeline",
    checkRateLimit: checkLandingProxyRateLimit,
    stream: true,
    unreachableDetail:
      "The landing page calls that server to build your pipeline — start it from combined_full_stack (npm run dev, usually port 3000). If the app runs elsewhere, set SPINE_API_URL on the landing page to match.",
  });
}
