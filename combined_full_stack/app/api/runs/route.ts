import { NextResponse, type NextRequest, after } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc, unknownProject } from "@/lib/server/api-errors";
import { parseRequestJson, runBodySchema } from "@/lib/server/api_schemas";
import { assertCanStartRun, billRunUsage, getBillingUserKey } from "@/lib/server/billing_account";
import { recordActivityEvent } from "@/lib/server/user_activity";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { runPipeline } from "@/lib/server/run_engine";
import { computeRunFingerprintForRequest, findMatchingRun } from "@/lib/server/run_fingerprint";
import {
  MAX_CONCURRENT_RUNS_PER_USER,
  countActiveJobs,
  createJob,
  finishJob,
  jobProgress,
  openJobDb,
  pauseJob,
  withJobLogging,
} from "@/lib/server/run_jobs";
import { logger } from "@/lib/server/server_logger";
import {
  orderedInputModules,
  inputDocsByModuleFromAssignment,
  moduleInputReady,
  docsForInputModule,
  inputMinCountForModule,
  type InputDocsAssignment,
} from "@/lib/inference-input";
import {
  collectInferenceInputIssues,
  inferenceInputIssueMessage,
} from "@/lib/inference-validity";
import { RunSource, type DocId, type DocRef, type ModelId, type ModuleId, type ProjectId } from "@/lib/server/types";
import { UnknownModelError, parseOptionalRequestModel } from "@/lib/server/model_catalog";
import { ensureModelOptionsFresh } from "@/lib/server/openrouter_models";

const apiLog = logger("api:runs");

// AI : todo §8 — after() keeps the pipeline alive once the response is sent (Vercel
// AI : freezes plain dangling promises); maxDuration is the Fluid-compute ceiling.
// AI : Next.js requires numeric literals — keep in sync with lib/server/route-config.ts.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const parsed = await parseRequestJson(req, runBodySchema);
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const { projectId, inputDocId, inputDocIds, inputDocsByModule, model, allowDuplicateRuns, source } = parsed;
  const runSource = source === "testing" ? RunSource.Testing : undefined;
  const pid = projectId as ProjectId;
  const primaryDocId = inputDocId as DocId;

  let resolvedModel: ModelId | undefined;
  try {
    resolvedModel = parseOptionalRequestModel(model);
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }

  apiLog.info(`POST /api/runs`, { projectId, inputDocId, inputDocIds, inputDocsByModule, model: resolvedModel, source: runSource, ownerId: auth.userId });

  await ensureModelOptionsFresh();

  if (!store.project(pid)) {
    apiLog.warn(`unknown project`, { projectId: pid });
    return apiError(unknownProject(pid), HTTP.NOT_FOUND);
  }
  const project = store.project(pid)!;
  const inputModules = orderedInputModules(project.modules);
  const assignment: InputDocsAssignment = {};
  const contentByDocId: Partial<Record<string, string>> = {};
  const byModule =
    inputDocsByModule && Object.keys(inputDocsByModule).length ? inputDocsByModule : undefined;
  if (byModule) {
    for (const m of inputModules) {
      const ids = (byModule[m.id] ?? []) as DocId[];
      if (ids.length < inputMinCountForModule(m)) {
        return apiError(`input "${m.label}" needs at least ${inputMinCountForModule(m)} document(s)`, 400);
      }
      const docs = ids.flatMap((docId) => {
        if (store.docContent(docId as DocId) === undefined) return [];
        const doc = store.docs().find((d: DocRef) => d.id === docId);
        return doc ? [{ docId, doc }] : [];
      });
      if (docs.length !== ids.length) {
        const missing = ids.find((id) => !docs.some((d) => d.docId === id));
        return apiError(unknownDoc(missing ?? "unknown"), HTTP.NOT_FOUND);
      }
      for (const { docId, doc } of docs) {
        contentByDocId[docId] = store.docContent(docId)!;
      }
      assignment[m.id] = docs.map((d) => d.doc);
    }
  } else {
    const orderedDocIds = [primaryDocId, ...((inputDocIds ?? []) as DocId[])];
    for (let i = 0; i < inputModules.length; i++) {
      const docId = orderedDocIds[i];
      if (!docId) continue;
      if (store.docContent(docId) === undefined) {
        apiLog.warn(`unknown doc`, { docId });
        return apiError(unknownDoc(docId), HTTP.NOT_FOUND);
      }
      const doc = store.docs().find((d: DocRef) => d.id === docId);
      if (!doc) return apiError(unknownDoc(docId), HTTP.NOT_FOUND);
      assignment[inputModules[i].id] = doc;
      contentByDocId[docId] = store.docContent(docId)!;
    }
  }
  for (const m of inputModules) {
    if (!moduleInputReady(m, assignment)) {
      return apiError(`input "${m.label}" needs at least ${inputMinCountForModule(m)} document(s)`, 400);
    }
  }
  const inputIssues = collectInferenceInputIssues(inputModules, {}, contentByDocId, assignment);
  if (inputIssues.length) {
    return apiError(inferenceInputIssueMessage(inputIssues, inputModules), 400);
  }

  const resolvedByModule = inputDocsByModuleFromAssignment(inputModules, assignment);
  const { fingerprint, inputDocIds: fingerprintInputDocIds, project: migratedProject } = computeRunFingerprintForRequest(
    store,
    project,
    resolvedModel,
    primaryDocId,
    inputDocIds as DocId[] | undefined,
    resolvedByModule,
  );

  const billingKey = await getBillingUserKey();
  const jobDb = await openJobDb();

  try {
    apiLog.info(`billing gate`, { billingKey });
    await assertCanStartRun(billingKey);
    apiLog.info(`billing gate ok`);
  } catch (err) {
    const billed = billingResponse(err);
    const message = (err as Error).message;
    if (billed) {
      apiLog.warn(`billing rejected`, { code: (err as { code?: string }).code, message });
      return billed;
    }
    apiLog.error(`billing error`, { error: message });
    throw err;
  }

  if (countActiveJobs(auth.userId) >= MAX_CONCURRENT_RUNS_PER_USER) {
    apiLog.warn(`concurrent run limit`, { ownerId: auth.userId, max: MAX_CONCURRENT_RUNS_PER_USER });
    return apiError("Too many runs in progress — wait for one to finish.", HTTP.TOO_MANY_REQUESTS, "concurrent_runs");
  }

  const jobId = await createJob(auth.userId, jobDb);
  apiLog.info(`job created — scheduling pipeline`, { jobId, ownerId: auth.userId });
  void recordActivityEvent({
    userId: auth.userId,
    category: "run_start",
    action: `Started pipeline run`,
    projectId: pid,
    detail: { jobId, model: resolvedModel, inputDocId },
  });

  after(async () => {
    await withJobLogging(auth.userId, jobId, jobDb, async () => {
      apiLog.info(`after() pipeline starting`, { jobId, projectId, inputDocId, model: resolvedModel });
      try {
        if (!allowDuplicateRuns) {
          const cached = findMatchingRun(store, migratedProject, pid, fingerprint, resolvedModel);
          if (cached) {
            apiLog.info(`run deduped — reusing prior ok run`, { jobId, cachedRunId: cached.id, fingerprint });
            await finishJob(auth.userId, jobId, { run: cached, deduped: true, cachedRunId: cached.id }, jobDb);
            return;
          }
        }
        const run = await runPipeline(store, pid, primaryDocId, {
          model: resolvedModel,
          inputDocIds: inputDocIds as DocId[] | undefined,
          inputDocsByModule: resolvedByModule,
          fingerprint,
          fingerprintInputDocIds,
          cacheOwnerId: auth.userId,
          ...(runSource ? { runMeta: { source: runSource } } : {}),
          // AI : never block the pipeline on Supabase job upserts — progress is memory-hot during the run.
          onStep: (p) => {
            void jobProgress(auth.userId, jobId, p, jobDb).catch((err) =>
              apiLog.error(`jobProgress failed`, { jobId, moduleId: p.moduleId, error: (err as Error).message }),
            );
          },
        });
        apiLog.info(`pipeline finished — flushing store`, { jobId, runId: run.id, status: run.status });
        await store.flush(); // AI : SupabaseStore queues addRun — persist before the job reports done
        if (run.billedCents > 0) {
          try {
            await billRunUsage(billingKey, run.billedCents, {
              flowType: "usage_run",
              refId: run.id,
              detail: { jobId, projectId: pid, model: resolvedModel },
            });
          } catch (billErr) {
            apiLog.warn(`post-run billing failed`, { jobId, runId: run.id, error: (billErr as Error).message });
          }
        }
        void recordActivityEvent({
          userId: auth.userId,
          category: "run_complete",
          action: `Pipeline run ${run.status}`,
          projectId: pid,
          costCents: run.billedCents,
          detail: { jobId, runId: run.id, status: run.status, stepCount: run.steps.length },
        });
        if (run.billedCents > 0) {
          void recordActivityEvent({
            userId: auth.userId,
            category: "llm_call",
            action: `Pipeline inference billed`,
            projectId: pid,
            costCents: run.billedCents,
            detail: { jobId, runId: run.id, model: resolvedModel },
          });
        }
        await finishJob(auth.userId, jobId, { run }, jobDb);
        apiLog.info(`job finished ok`, { jobId, runId: run.id });
      } catch (err) {
        if (err instanceof PipelinePausedError) {
          await pauseJob(auth.userId, jobId, err.checkpoint, jobDb);
          apiLog.info(`pipeline paused for client code`, { jobId, moduleId: err.checkpoint.clientStep.moduleId });
          return;
        }
        apiLog.error(`pipeline threw`, { jobId, error: (err as Error).message, stack: (err as Error).stack });
        void recordActivityEvent({
          userId: auth.userId,
          category: "error",
          action: "Pipeline run failed",
          projectId: pid,
          detail: { jobId, error: (err as Error).message },
        });
        await finishJob(auth.userId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });
  return NextResponse.json({ jobId });
}
