import { NextResponse, type NextRequest, after } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { hostedApiInvokeBodySchema, parseHostedApiId, parseRequestJson } from "@/lib/server/api_schemas";
import {
  assertCanStartRun,
  billRunUsage,
  billingKeyForUser,
} from "@/lib/server/billing_account";
import {
  orderedInputModules,
  inputDocsByModuleFromAssignment,
  moduleInputReady,
  inputMinCountForModule,
} from "@/lib/inference-input";
import {
  collectInferenceInputIssues,
  inferenceInputIssueMessage,
} from "@/lib/inference-validity";
import { PUBLIC_RUN_SPEND_RESERVE_CENTS } from "@/lib/billing_config";
import { hostedApiRunNotes } from "@/lib/hosted-api-types";
import { PipelinePausedError } from "@/lib/server/run_checkpoint";
import { runPipeline } from "@/lib/server/run_engine";
import { computeRunFingerprintForRequest } from "@/lib/server/run_fingerprint";
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
import {
  adjustHostedApiSpend,
  assertHostedApiCanAcceptRun,
  HostedApiAuthError,
  HostedApiSpendLimitError,
  incrementHostedApiRequestCount,
  openStoreForUser,
  overlayStoreForHostedRun,
  recordHostedApiSpend,
  reserveHostedApiSpend,
  resolveHostedApiAssignment,
  revokeHostedApi,
  verifyHostedApiKey,
} from "@/lib/server/hosted_apis";
import { registerSharedProgressToken } from "@/lib/server/shared_links";
import { logger } from "@/lib/server/server_logger";
import { RunSource, type DocId, type HostedApiId, type ModuleId } from "@/lib/server/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const invokeLog = logger("api:hosted-apis:invoke");

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const apiId = parseHostedApiId(id);
  if (!apiId) return apiError("api not found", 404);

  const key = bearerToken(req);
  if (!key) return apiError("Authorization: Bearer <api_key> required", 401);

  let api;
  try {
    api = await verifyHostedApiKey(apiId, key);
  } catch (err) {
    if (err instanceof HostedApiAuthError) return apiError(err.message, 401);
    throw err;
  }

  const ip = clientIpFromHeaders(req.headers);
  const limitKey = `hosted-api:${apiId}:${ip}` as RateLimitKey;
  const limited = await checkRateLimit(limitKey, "hosted_api");
  if (!limited.ok) {
    return apiError("Too many API requests — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  const parsed = await parseRequestJson(req, hostedApiInvokeBodySchema, {});
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const body = parsed;

  const ownerStore = await openStoreForUser(api.ownerId);
  const project = api.snapshot;
  const inputModules = orderedInputModules(project.modules);
  const { assignment, contentByDocId } = resolveHostedApiAssignment(
    apiId,
    api,
    inputModules,
    body.inputsByModule as Partial<Record<ModuleId, import("@/lib/server/hosted_apis").HostedApiInlineInput[]>> | undefined,
  );
  const overlay = overlayStoreForHostedRun(ownerStore, assignment, contentByDocId);

  for (const m of inputModules) {
    if (!moduleInputReady(m, assignment)) {
      return apiError(`input "${m.label}" needs at least ${inputMinCountForModule(m)} document(s)`, 400);
    }
  }
  const inputIssues = collectInferenceInputIssues(inputModules, {}, contentByDocId, assignment);
  if (inputIssues.length) return apiError(inferenceInputIssueMessage(inputIssues), 400);

  const resolvedByModule = inputDocsByModuleFromAssignment(inputModules, assignment);
  const flatIds = inputModules.flatMap((m) => (resolvedByModule[m.id] ?? []).map((d) => d as DocId));
  const [primary, ...rest] = flatIds;
  if (!primary) return apiError("no input documents", 400);

  const model = api.defaultModel ?? project.modules.find((m) => m.kind === "llm")?.model ?? "qwen-2.5-72b";
  const { fingerprint, inputDocIds: fingerprintInputDocIds } = computeRunFingerprintForRequest(
    overlay,
    project,
    model,
    primary,
    rest,
    resolvedByModule,
  );

  const billingKey = billingKeyForUser(api.ownerId);
  const reserveCents = api.spendLimitCents != null ? PUBLIC_RUN_SPEND_RESERVE_CENTS : 0;
  try {
    assertHostedApiCanAcceptRun(api);
    await assertCanStartRun(billingKey);
  } catch (err) {
    if (err instanceof HostedApiSpendLimitError) {
      return apiError(err.message, 402, "spend_limit_reached");
    }
    const code = (err as { code?: string }).code;
    if (code === "insufficient_funds") {
      return apiError("API owner has insufficient credit", 402, code);
    }
    throw err;
  }
  if (reserveCents > 0) {
    const reserved = await reserveHostedApiSpend(apiId, reserveCents);
    if (!reserved) {
      return apiError("This API has reached its spending limit.", 402, "spend_limit_reached");
    }
  }

  if (countActiveJobs(api.ownerId) >= MAX_CONCURRENT_RUNS_PER_USER) {
    return apiError("Too many runs in progress — wait for one to finish.", HTTP.TOO_MANY_REQUESTS, "concurrent_runs");
  }

  const jobDb = await openJobDb();
  const jobId = await createJob(api.ownerId, jobDb);
  const progressToken = registerSharedProgressToken(apiId as unknown as import("@/lib/server/types").SharedLinkId, api.ownerId, jobId);

  after(async () => {
    await withJobLogging(api.ownerId, jobId, jobDb, async () => {
      try {
        const run = await runPipeline(overlay, api.projectId, primary, {
          model,
          inputDocIds: rest,
          inputDocsByModule: resolvedByModule,
          fingerprint,
          fingerprintInputDocIds,
          cacheOwnerId: api.ownerId,
          projectOverride: project,
          runMeta: {
            source: RunSource.HostedApi,
            hostedApiId: apiId,
            notes: hostedApiRunNotes(),
          },
          onStep: (p) => {
            void jobProgress(api.ownerId, jobId, p, jobDb).catch(() => {});
          },
        });
        await ownerStore.flush();
        const billed = run.billedCents;
        if (billed > 0) {
          try {
            await billRunUsage(billingKey, billed);
          } catch (billErr) {
            invokeLog.warn(`post-run billing failed — revoking api`, {
              apiId,
              jobId,
              billed,
              error: (billErr as Error).message,
            });
            await revokeHostedApi(api.ownerId, apiId);
          }
        }
        if (reserveCents > 0) {
          const settled = await adjustHostedApiSpend(apiId, billed - reserveCents);
          if (!settled) {
            invokeLog.warn(`spend limit exceeded after run — revoking api`, { apiId, billed, reserveCents });
            await revokeHostedApi(api.ownerId, apiId);
          }
        } else if (billed > 0) {
          await recordHostedApiSpend(apiId, billed);
        }
        await incrementHostedApiRequestCount(apiId);
        await finishJob(api.ownerId, jobId, { run }, jobDb);
      } catch (err) {
        if (reserveCents > 0 && !(err instanceof PipelinePausedError)) {
          await adjustHostedApiSpend(apiId, -reserveCents).catch(() => {});
        }
        if (err instanceof PipelinePausedError) {
          await pauseJob(api.ownerId, jobId, err.checkpoint, jobDb);
          return;
        }
        await finishJob(api.ownerId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });

  return NextResponse.json({ jobId, progressToken });
}
