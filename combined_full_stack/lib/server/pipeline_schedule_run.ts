import { after } from "next/server";
import { HTTP } from "@/lib/server/api-errors";
import { billingResponse } from "@/lib/server/api_context";
import { assertCanStartRun, billRunUsage } from "@/lib/server/billing_account";
import { billingKeyForProject } from "@/lib/server/team_billing";
import {
  collectInferenceInputIssues,
  inferenceInputIssueMessage,
} from "@/lib/inference-validity";
import {
  inputDocsByModuleFromAssignment,
  inputMinCountForModule,
  moduleInputReady,
  orderedInputModules,
  type InputDocsAssignment,
} from "@/lib/inference-input";
import { pipelineScheduleRunNotes } from "@/lib/schedule-types";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { runPipeline } from "@/lib/server/run_engine";
import { computeRunFingerprintForRequest } from "@/lib/server/run_fingerprint";
import {
  MAX_CONCURRENT_RUNS_PER_USER,
  countActiveJobs,
  createJob,
  finishJob,
  jobProgress,
  openCrossUserJobDb,
  pauseJob,
  withJobLogging,
} from "@/lib/server/run_jobs";
import { openStoreForUser } from "@/lib/server/hosted_apis";
import { markScheduleFired, type ClaimedSchedule } from "@/lib/server/pipeline_schedules";
import { logger } from "@/lib/server/server_logger";
import { resolveRunInputDoc, snapshotDocNamesById } from "@/lib/server/store";
import { DEFAULT_MODEL, RunSource, type DocId, type DocRef, type ModuleId } from "@/lib/server/types";
import type { user_id_string } from "@/lib/server/require_auth";

const runLog = logger("pipeline-schedules:run");

export type QueueScheduleRunResult =
  | { ok: true; jobId: string }
  | { ok: false; status: number; message: string; code?: string };

export async function queueScheduledRun(row: ClaimedSchedule): Promise<QueueScheduleRunResult> {
  const ownerId = row.ownerId as user_id_string;
  const store = await openStoreForUser(ownerId);
  const project = store.project(row.projectId);
  if (!project) {
    await markScheduleFired(row, { runAt: Date.now(), error: "project missing" });
    return { ok: false, status: HTTP.NOT_FOUND, message: "project missing" };
  }

  const inputModules = orderedInputModules(project.modules);
  const namesById = snapshotDocNamesById(store);
  const assignment: InputDocsAssignment = {};
  const contentByDocId: Partial<Record<string, string>> = {};
  const docsByModule: Partial<Record<ModuleId, DocId[]>> = {};
  for (const doc of row.defaultDocs) {
    const ids = docsByModule[doc.moduleId] ?? [];
    ids.push(doc.docId);
    docsByModule[doc.moduleId] = ids;
  }

  for (const m of inputModules) {
    const ids = docsByModule[m.id] ?? [];
    if (ids.length < inputMinCountForModule(m)) {
      const message = `input "${m.label}" needs at least ${inputMinCountForModule(m)} document(s)`;
      await markScheduleFired(row, { runAt: Date.now(), error: message });
      return { ok: false, status: 400, message };
    }
    const docs: DocRef[] = [];
    for (const docId of ids) {
      const resolved = await resolveRunInputDoc(store, docId, namesById);
      if (!resolved) {
        const message = `unknown doc ${docId}`;
        await markScheduleFired(row, { runAt: Date.now(), error: message });
        return { ok: false, status: HTTP.NOT_FOUND, message };
      }
      const content = store.docContent(resolved.docId);
      if (content === undefined) {
        const message = `missing content for doc ${docId}`;
        await markScheduleFired(row, { runAt: Date.now(), error: message });
        return { ok: false, status: HTTP.NOT_FOUND, message };
      }
      docs.push(resolved.doc);
      contentByDocId[resolved.docId] = content;
    }
    assignment[m.id] = docs;
  }

  for (const m of inputModules) {
    if (!moduleInputReady(m, assignment)) {
      const message = `input "${m.label}" needs at least ${inputMinCountForModule(m)} document(s)`;
      await markScheduleFired(row, { runAt: Date.now(), error: message });
      return { ok: false, status: 400, message };
    }
  }
  const inputIssues = collectInferenceInputIssues(inputModules, {}, contentByDocId, assignment, {
    models: project.models,
    typeAliases: project.typeAliases,
  });
  if (inputIssues.length) {
    const message = inferenceInputIssueMessage(inputIssues, inputModules);
    await markScheduleFired(row, { runAt: Date.now(), error: message });
    return { ok: false, status: 400, message };
  }

  const resolvedByModule = inputDocsByModuleFromAssignment(inputModules, assignment);
  const flatIds = inputModules.flatMap((m) => (resolvedByModule[m.id] ?? []).map((d) => d as DocId));
  const [primary, ...rest] = flatIds;
  if (!primary) {
    await markScheduleFired(row, { runAt: Date.now(), error: "no input documents" });
    return { ok: false, status: 400, message: "no input documents" };
  }

  const model = row.defaultModel ?? project.modules.find((m) => m.kind === "llm")?.model ?? DEFAULT_MODEL;
  const { fingerprint, inputDocIds: fingerprintInputDocIds } = computeRunFingerprintForRequest(
    store,
    project,
    model,
    primary,
    rest,
    resolvedByModule,
  );

  const billingKey = await billingKeyForProject(ownerId, project);
  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
    const billed = billingResponse(err);
    const message = (err as Error).message;
    await markScheduleFired(row, { runAt: Date.now(), error: message });
    if (billed) {
      return { ok: false, status: billed.status, message, code: "insufficient_funds" };
    }
    throw err;
  }

  if (countActiveJobs(ownerId) >= MAX_CONCURRENT_RUNS_PER_USER) {
    await markScheduleFired(row, { runAt: Date.now(), error: "too many concurrent runs" });
    return {
      ok: false,
      status: HTTP.TOO_MANY_REQUESTS,
      message: "Too many runs in progress — wait for one to finish.",
      code: "concurrent_runs",
    };
  }

  const jobDb = await openCrossUserJobDb();
  const jobId = await createJob(ownerId, jobDb);
  after(async () => {
    await withJobLogging(ownerId, jobId, jobDb, async () => {
      try {
        const run = await runPipeline(store, row.projectId, primary, {
          model,
          inputDocIds: rest,
          inputDocsByModule: resolvedByModule,
          fingerprint,
          fingerprintInputDocIds,
          cacheOwnerId: ownerId,
          runMeta: {
            source: RunSource.Schedule,
            scheduleId: row.id,
            notes: pipelineScheduleRunNotes(row.name),
          },
          onStep: (p) => {
            void jobProgress(ownerId, jobId, p, jobDb).catch(() => {});
          },
        });
        await store.flush();
        if (run.billedCents > 0) {
          try {
            await billRunUsage(billingKey, run.billedCents, {
              flowType: "usage_run",
              refId: run.id,
              detail: { jobId, projectId: row.projectId, model, scheduleId: row.id },
            });
          } catch (billErr) {
            runLog.warn(`post-run billing failed`, { jobId, error: (billErr as Error).message });
          }
        }
        await markScheduleFired(row, {
          runAt: Date.now(),
          error: run.status === "error" ? "pipeline finished with errors" : undefined,
        });
        await finishJob(ownerId, jobId, { run }, jobDb);
      } catch (err) {
        if (err instanceof PipelinePausedError) {
          await pauseJob(ownerId, jobId, err.checkpoint, jobDb);
          await markScheduleFired(row, { runAt: Date.now(), error: "paused for client step" });
          return;
        }
        const message = (err as Error).message;
        runLog.error(`scheduled pipeline threw`, { jobId, error: message });
        await markScheduleFired(row, { runAt: Date.now(), error: message });
        await finishJob(ownerId, jobId, { error: message }, jobDb);
      }
    });
  });
  return { ok: true, jobId };
}
