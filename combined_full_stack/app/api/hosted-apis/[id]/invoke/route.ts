import { NextResponse, type NextRequest, after } from "next/server";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { hostedApiInvokeBodySchema, parseHostedApiId, parseRequestJson } from "@/lib/server/api_schemas";
import { assertCanStartRun } from "@/lib/server/billing_account";
import {
  billHostedApiRun,
  callerFundsHostedApi,
  hostedApiBillingKey,
  SPINE_API_KEY_HEADER,
  SPINE_BILLING_KEY_HEADER,
} from "@/lib/server/hosted_api_billing";
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
  openCrossUserJobDb,
  pauseJob,
  withJobLogging,
} from "@/lib/server/run_jobs";
import {
  adjustHostedApiSpend,
  assertHostedApiCanAcceptRun,
  HostedApiAuthError,
  HostedApiDisabledError,
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
import { UserBillingKeyError, verifyUserBillingKey } from "@/lib/server/user_billing_keys";
import { HostedApiFundingMode, RunSource, type DocId, type HostedApiId, type ModuleId } from "@/lib/server/types";
import type { user_id_string } from "@/lib/server/require_auth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const invokeLog = logger("api:hosted-apis:invoke");

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth?.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim();
}

function deployApiKey(req: NextRequest): string | null {
  return req.headers.get(SPINE_API_KEY_HEADER)?.trim() || bearerToken(req);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const apiId = parseHostedApiId(id);
  if (!apiId) return apiError("api not found", 404);

  const deployKey = deployApiKey(req);
  if (!deployKey) {
    return apiError("Authorization: Bearer <api_key> or X-Spine-Api-Key required", 401);
  }

  let api;
  try {
    api = await verifyHostedApiKey(apiId, deployKey);
  } catch (err) {
    if (err instanceof HostedApiAuthError) return apiError(err.message, 401);
    throw err;
  }

  let callerUserId: user_id_string | undefined;
  if (callerFundsHostedApi(api.fundingMode)) {
    const billingKeyRaw = req.headers.get(SPINE_BILLING_KEY_HEADER)?.trim();
    if (!billingKeyRaw) {
      return apiError("X-Spine-Billing-Key required for caller-paid APIs", 401);
    }
    try {
      callerUserId = await verifyUserBillingKey(billingKeyRaw);
    } catch (err) {
      if (err instanceof UserBillingKeyError) return apiError(err.message, 401);
      throw err;
    }
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
  if (inputIssues.length) return apiError(inferenceInputIssueMessage(inputIssues, inputModules), 400);

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

  const billingKey = hostedApiBillingKey(api.ownerId, api.fundingMode, callerUserId);
  const reserveCents = api.spendLimitCents != null ? PUBLIC_RUN_SPEND_RESERVE_CENTS : 0;
  try {
    assertHostedApiCanAcceptRun(api);
    await assertCanStartRun(billingKey);
  } catch (err) {
    if (err instanceof HostedApiDisabledError) {
      return apiError(err.message, 403, "deployment_disabled");
    }
    if (err instanceof HostedApiSpendLimitError) {
      return apiError(err.message, 402, "spend_limit_reached");
    }
    const code = (err as { code?: string }).code;
    if (code === "insufficient_funds") {
      return apiError(
        api.fundingMode === HostedApiFundingMode.OwnerPays
          ? "API owner has insufficient credit"
          : "Not enough credit — top up in Billing",
        402,
        code,
      );
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

  const jobDb = await openCrossUserJobDb();
  const jobId = await createJob(api.ownerId, jobDb);
  let progressToken: string;
  try {
    progressToken = await registerSharedProgressToken(
      apiId as unknown as import("@/lib/server/types").SharedLinkId,
      api.ownerId,
      jobId,
    );
  } catch {
    return apiError("Could not start run — progress auth unavailable.", 503, "progress_token_failed");
  }

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
            triggerUserId: callerUserId,
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
            const bill = await billHostedApiRun(billingKey, api.ownerId, api, billed);
            if (reserveCents > 0) {
              const settled = await adjustHostedApiSpend(apiId, bill.totalCents - reserveCents);
              if (!settled) {
                invokeLog.warn(`spend limit exceeded after run — revoking api`, {
                  apiId,
                  billed: bill.totalCents,
                  reserveCents,
                });
                await revokeHostedApi(api.ownerId, apiId);
              }
            } else {
              await recordHostedApiSpend(apiId, bill.totalCents);
            }
          } catch (billErr) {
            invokeLog.warn(`post-run billing failed — revoking api`, {
              apiId,
              jobId,
              billed,
              error: (billErr as Error).message,
            });
            await revokeHostedApi(api.ownerId, apiId);
          }
        } else if (reserveCents > 0) {
          await adjustHostedApiSpend(apiId, -reserveCents).catch(() => {});
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
