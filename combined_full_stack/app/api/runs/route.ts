import { NextResponse, type NextRequest, after } from "next/server";
import { apiError, billingResponse, requireAuthStore } from "@/lib/server/api_context";
import { HTTP, unknownDoc, unknownProject } from "@/lib/server/api-errors";
import { assertCanStartRun, billRunUsage, getBillingUserKey } from "@/lib/server/billing_account";
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

interface RunRequest {
  projectId: ProjectId;
  inputDocId: DocId;
  inputDocIds?: DocId[];
  inputDocsByModule?: Partial<Record<ModuleId, DocId[]>>;
  model?: ModelId;
  allowDuplicateRuns?: boolean;
  // AI : "testing" flags Testing-tab runs in Logging; anything else is a normal app run.
  source?: RunSource;
}

export async function POST(req: NextRequest) {
  const ctx = await requireAuthStore("llm");
  if (ctx instanceof NextResponse) return ctx;
  const { auth, store } = ctx;

  const { projectId, inputDocId, inputDocIds, inputDocsByModule, model, allowDuplicateRuns, source } = (await req.json()) as RunRequest;
  const runSource = source === RunSource.Testing ? RunSource.Testing : undefined;

  let resolvedModel: ModelId | undefined;
  try {
    resolvedModel = parseOptionalRequestModel(model);
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST);
    throw err;
  }

  apiLog.info(`POST /api/runs`, { projectId, inputDocId, inputDocIds, inputDocsByModule, model: resolvedModel, source: runSource, ownerId: auth.userId });

  await ensureModelOptionsFresh();

  if (!store.project(projectId)) {
    apiLog.warn(`unknown project`, { projectId });
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND);
  }
  const project = store.project(projectId)!;
  const inputModules = orderedInputModules(project.modules);
  const assignment: InputDocsAssignment = {};
  const contentByDocId: Partial<Record<string, string>> = {};
  const byModule =
    inputDocsByModule && Object.keys(inputDocsByModule).length ? inputDocsByModule : undefined;
  if (byModule) {
    for (const m of inputModules) {
      const ids = byModule[m.id] ?? [];
      if (ids.length < inputMinCountForModule(m)) {
        return apiError(`input "${m.label}" needs at least ${inputMinCountForModule(m)} document(s)`, 400);
      }
      const docs = ids.flatMap((docId) => {
        if (store.docContent(docId) === undefined) return [];
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
    const orderedDocIds = [inputDocId, ...(inputDocIds ?? [])];
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
    return apiError(inferenceInputIssueMessage(inputIssues), 400);
  }

  const resolvedByModule = inputDocsByModuleFromAssignment(inputModules, assignment);
  const { fingerprint, inputDocIds: fingerprintInputDocIds, project: migratedProject } = computeRunFingerprintForRequest(
    store,
    project,
    resolvedModel,
    inputDocId,
    inputDocIds,
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

  after(async () => {
    await withJobLogging(auth.userId, jobId, jobDb, async () => {
      apiLog.info(`after() pipeline starting`, { jobId, projectId, inputDocId, model: resolvedModel });
      try {
        if (!allowDuplicateRuns) {
          const cached = findMatchingRun(store, migratedProject, projectId, fingerprint, resolvedModel);
          if (cached) {
            apiLog.info(`run deduped — reusing prior ok run`, { jobId, cachedRunId: cached.id, fingerprint });
            await finishJob(auth.userId, jobId, { run: cached, deduped: true, cachedRunId: cached.id }, jobDb);
            return;
          }
        }
        const run = await runPipeline(store, projectId, inputDocId, {
          model: resolvedModel,
          inputDocIds,
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
            await billRunUsage(billingKey, run.billedCents);
          } catch (billErr) {
            apiLog.warn(`post-run billing failed`, { jobId, runId: run.id, error: (billErr as Error).message });
          }
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
        await finishJob(auth.userId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });
  return NextResponse.json({ jobId });
}
