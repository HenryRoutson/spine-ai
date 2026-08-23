import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { landingSignupBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  LandingProxyAuthError,
  assertLandingProxyAllowed,
  clientIpForLandingDemo,
} from "@/lib/server/landing_proxy_auth";
import { landingDemoJson, landingDemoOptions, landingDemoRateLimited } from "@/lib/server/landing_demo_cors";
import { saveLandingPageSignup } from "@/lib/server/landing_page_signups";
import { logger } from "@/lib/server/server_logger";

export const dynamic = "force-dynamic";

const routeLog = logger("api/landing-demo/signup");

export async function OPTIONS(req: Request): Promise<NextResponse> {
  return landingDemoOptions(req);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertLandingProxyAllowed(req.headers);
  } catch (err) {
    if (err instanceof LandingProxyAuthError) {
      return landingDemoJson(req, { error: "unauthorized", code: err.code }, HTTP.UNAUTHORIZED);
    }
    throw err;
  }

  const limited = await enforceIpRateLimit(req, "landing_demo_signup");
  if (limited) return landingDemoRateLimited(req, limited);

  const body = await parseRequestJson(req, landingSignupBodySchema);
  if ("validationError" in body) return landingDemoJson(req, { error: body.validationError }, HTTP.BAD_REQUEST);

  try {
    // AI : TODO security — require magic-link/OTP proof of email ownership before unlock build/replay.
    const ip = clientIpForLandingDemo(req.headers);
    await saveLandingPageSignup(body.email, ip);
    return landingDemoJson(req, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    routeLog.warn("landing signup failed", { error: message });
    return landingDemoJson(req, { error: message }, HTTP.BAD_REQUEST);
  }
}
