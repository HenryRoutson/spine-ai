import { NextResponse, type NextRequest } from "next/server";
import { apiError, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownProject } from "@/lib/server/api-errors";
import { computeRunFingerprintForRequest, findMatchingRun } from "@/lib/server/run_fingerprint";
import type { DocId, ModelId, ProjectId } from "@/lib/server/types";

export const dynamic = "force-dynamic";

interface MatchRequest {
  projectId: ProjectId;
  inputDocId: DocId;
  inputDocIds?: DocId[];
  model?: ModelId;
}

// AI : probe whether this pipeline + inputs already have a completed run — powers Inference restore on tab return.
export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore();
  if (ctx instanceof NextResponse) return ctx;
  const { store } = ctx;

  const { projectId, inputDocId, inputDocIds, model } = (await req.json()) as MatchRequest;
  if (!store.project(projectId)) return apiError(unknownProject(projectId), HTTP.NOT_FOUND);

  const project = store.project(projectId)!;
  const { fingerprint } = computeRunFingerprintForRequest(store, project, model, inputDocId, inputDocIds);
  const cachedRun = findMatchingRun(store, project, projectId, fingerprint, model);

  return NextResponse.json({
    fingerprint,
    cachedRunId: cachedRun?.id ?? null,
    run: cachedRun ?? null,
  });
}
