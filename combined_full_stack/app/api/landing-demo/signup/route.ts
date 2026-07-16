import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { landingSignupBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  LandingProxyAuthError,
  assertLandingProxyAllowed,
  clientIpForLandingDemo,
} from "@/lib/server/landing_proxy_auth";
import { landingDemoCorsHeaders } from "@/lib/server/landing_demo_cors";
import { saveLandingPageSignup } from "@/lib/server/landing_page_signups";
import { logger } from "@/lib/server/server_logger";

export const dynamic = "force-dynamic";

const routeLog = logger("api/landing-demo/signup");

function jsonWithCors(req: Request, body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: landingDemoCorsHeaders(req) });
}

export async function OPTIONS(req: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: landingDemoCorsHeaders(req) });
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertLandingProxyAllowed(req.headers);
  } catch (err) {
    if (err instanceof LandingProxyAuthError) {
      return jsonWithCors(req, { error: "unauthorized", code: err.code }, HTTP.UNAUTHORIZED);
    }
    throw err;
  }

  const limited = await enforceIpRateLimit(req, "landing_demo_signup");
  if (limited) {
    return NextResponse.json(await limited.json(), {
      status: limited.status,
      headers: { ...landingDemoCorsHeaders(req), ...Object.fromEntries(limited.headers.entries()) },
    });
  }

  const body = await parseRequestJson(req, landingSignupBodySchema);
  if ("validationError" in body) return jsonWithCors(req, { error: body.validationError }, HTTP.BAD_REQUEST);

  try {
    // AI : TODO security — require magic-link/OTP proof of email ownership before unlock build/replay.
    const ip = clientIpForLandingDemo(req.headers);
    await saveLandingPageSignup(body.email, ip);
    return jsonWithCors(req, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    routeLog.warn("landing signup failed", { error: message });
    return jsonWithCors(req, { error: message }, HTTP.BAD_REQUEST);
  }
}
