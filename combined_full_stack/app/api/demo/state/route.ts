import { NextResponse, type NextRequest } from "next/server";
import { DEMO_DEFAULT_PROJECT_ID } from "@/lib/demo-constants";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { verifyLandingBuildAccessToken } from "@/lib/server/landing_build_access";
import { getDemoState } from "@/lib/server/demo_store";
import type { ProjectId } from "@/lib/server/types";

// AI : unauthenticated read-only state for the marketing-site live preview iframe.
// AI : SECURITY — landing builds require a signed access token (minted at build time).
export async function GET(req: NextRequest) {
  const buildId = req.nextUrl.searchParams.get("buildId");
  const accessToken = req.nextUrl.searchParams.get("accessToken");
  if (buildId && !verifyLandingBuildAccessToken(buildId, accessToken)) {
    return apiError("invalid or missing build access token", HTTP.FORBIDDEN);
  }
  const projectId =
    (req.nextUrl.searchParams.get("projectId") as ProjectId | null) ??
    (buildId as ProjectId | null) ??
    DEMO_DEFAULT_PROJECT_ID;
  return NextResponse.json(await getDemoState(projectId, buildId));
}
