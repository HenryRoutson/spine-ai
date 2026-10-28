import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { landingBuildPipelineBodySchema, parseRequestJson } from "@/lib/server/api_schemas";
import {
  LandingProxyAuthError,
  assertLandingProxyAllowed,
  clientIpForLandingDemo,
} from "@/lib/server/landing_proxy_auth";
import { landingDemoCorsHeaders, landingDemoJson, landingDemoOptions, landingDemoRateLimited } from "@/lib/server/landing_demo_cors";
import { LandingBudgetError } from "@/lib/server/landing_page_demo";
import { hasLandingPageSignup } from "@/lib/server/landing_page_signups";
import { buildLandingPipelineFromTask } from "@/lib/server/landing_pipeline_build";
import { LANDING_DEMO_STREAM_EVENT } from "@/lib/landing-demo-stream";
import { logger } from "@/lib/server/server_logger";

// AI : build agent + example-file run — needs the same ceiling as /api/runs.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const routeLog = logger("api/landing-demo/build-pipeline");

export async function OPTIONS(req: Request): Promise<NextResponse> {
  return landingDemoOptions(req);
}

export async function POST(req: Request): Promise<Response> {
  try {
    assertLandingProxyAllowed(req.headers);
  } catch (err) {
    if (err instanceof LandingProxyAuthError) {
      return landingDemoJson(req, { error: "unauthorized", code: err.code }, HTTP.UNAUTHORIZED);
    }
    throw err;
  }

  const limited = await enforceIpRateLimit(req, "landing_demo_build");
  if (limited) return landingDemoRateLimited(req, limited);

  const body = await parseRequestJson(req, landingBuildPipelineBodySchema);
  if ("validationError" in body) return landingDemoJson(req, { error: body.validationError }, HTTP.BAD_REQUEST);

  try {
    const registered = await hasLandingPageSignup(body.email);
    if (!registered) {
      return landingDemoJson(req, { error: "Enter your email before generating a pipeline.", code: "email_required" }, HTTP.BAD_REQUEST);
    }

    const ip = clientIpForLandingDemo(req.headers);
    const encoder = new TextEncoder();
    const bodyStream = new ReadableStream({
      async start(controller) {
        const push = (payload: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        };
        try {
          const result = await buildLandingPipelineFromTask(body.task, ip, {
            onThinkingDelta: (text) =>
              push({ type: LANDING_DEMO_STREAM_EVENT.THINKING_DELTA, text }),
            onThinkingDone: (text) =>
              push({ type: LANDING_DEMO_STREAM_EVENT.THINKING_DONE, text }),
            onMessageDelta: (text) =>
              push({ type: LANDING_DEMO_STREAM_EVENT.MESSAGE_DELTA, text }),
            onPhase: (phase) => push({ type: LANDING_DEMO_STREAM_EVENT.PHASE, phase }),
          });
          push({ type: LANDING_DEMO_STREAM_EVENT.DONE, result });
        } catch (err) {
          if (err instanceof LandingBudgetError) {
            push({ type: LANDING_DEMO_STREAM_EVENT.ERROR, error: err.message, code: err.code });
          } else {
            const message = err instanceof Error ? err.message : "Pipeline build failed";
            routeLog.warn("landing build failed", { error: message });
            push({ type: LANDING_DEMO_STREAM_EVENT.ERROR, error: message });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(bodyStream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        // AI : disable proxy buffering so LLM token deltas reach the browser live.
        "X-Accel-Buffering": "no",
        ...landingDemoCorsHeaders(req),
      },
    });
  } catch (err) {
    if (err instanceof LandingBudgetError) {
      return landingDemoJson(req, { error: err.message, code: err.code }, HTTP.UNAVAILABLE);
    }
    const message = err instanceof Error ? err.message : "Pipeline build failed";
    routeLog.warn("landing build failed", { error: message });
    return landingDemoJson(req, { error: message }, HTTP.BAD_REQUEST);
  }
}
