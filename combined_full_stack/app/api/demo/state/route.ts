import { NextResponse, type NextRequest } from "next/server";
import { DEMO_DEFAULT_PROJECT_ID } from "@/lib/demo-constants";
import { getDemoState } from "@/lib/server/demo_store";
import type { ProjectId } from "@/lib/server/types";

// AI : unauthenticated read-only state for the marketing-site live preview iframe.
export async function GET(req: NextRequest) {
  const projectId = (req.nextUrl.searchParams.get("projectId") as ProjectId | null) ?? DEMO_DEFAULT_PROJECT_ID;
  return NextResponse.json(await getDemoState(projectId));
}
