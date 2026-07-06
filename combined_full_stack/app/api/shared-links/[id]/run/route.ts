import { NextResponse, type NextRequest, after } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/server/api_context";
import { HTTP } from "@/lib/server/api-errors";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate_limit";
import type { RateLimitKey } from "@/lib/rate_limit_config";
import { secureSessionCookieOptions } from "@/lib/server/cookie_options";
import { parseRequestJson, parseSharedLinkId, sharedLinkRunBodySchema } from "@/lib/server/api_schemas";
import { assertCanStartRun } from "@/lib/server/billing_account";
import {
  billSharedLinkRun,
  sharedLinkBillingKey,
  viewerFundsSharedRun,
} from "@/lib/server/shared_link_billing";
import { PUBLIC_RUN_SPEND_RESERVE_CENTS } from "@/lib/billing_config";
import {
  orderedInputModules,
  inputDocsByModuleFromAssignment,
  moduleInputReady,
  inputMinCountForModule,
  type InputDocsAssignment,
} from "@/lib/inference-input";
import {
  collectInferenceInputIssues,
  inferenceInputIssueMessage,
} from "@/lib/inference-validity";
import { sharedRunNotes } from "@/lib/shared-link-types";
import { hashContent } from "@/lib/server/store";
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
  adjustSharedLinkSpend,
  assertSharedLinkCanAcceptRun,
  getSharedLink,
  incrementSharedLinkRunCount,
  newSessionId,
  openStoreForUser,
  recordSharedLinkSpend,
  registerSharedProgressToken,
  reserveSharedLinkSpend,
  revokeSharedLink,
  SharedLinkSpendLimitError,
} from "@/lib/server/shared_links";
import {
  loadDefaultDocContent,
  overlayStoreForSharedRun,
  sessionDocContent,
  sessionDocsForModule,
} from "@/lib/server/shared-link-session";
import { isAuthSession, requireAuth, type user_id_string } from "@/lib/server/require_auth";
import { logger } from "@/lib/server/server_logger";
import { DocLabel, RunSource } from "@/lib/server/types";
import type { DocId, DocRef, ModuleId, SharedLinkId } from "@/lib/server/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "shared_run_session";
const runLog = logger("api:shared-links:run");
import { MAX_UPLOAD_BYTES } from "@/lib/server/upload_constants";

function defaultDocId(linkId: SharedLinkId, moduleId: ModuleId, filename: string): DocId {
  return hashContent(`shared_default:${linkId}:${moduleId}:${filename}`);
}

async function resolveAssignment(
  linkId: SharedLinkId,
  sessionId: string,
  link: NonNullable<Awaited<ReturnType<typeof getSharedLink>>>,
  byModule: Partial<Record<ModuleId, DocId[]>> | undefined,
): Promise<{ assignment: InputDocsAssignment; contentByDocId: Record<string, string> }> {
  const inputModules = orderedInputModules(link.snapshot.modules);
  const assignment: InputDocsAssignment = {};
  const contentByDocId: Record<string, string> = {};

  for (const m of inputModules) {
    const viewerIds = byModule?.[m.id] ?? [];
    const docs: DocRef[] = [];

    if (viewerIds.length) {
      for (const docId of viewerIds) {
        const content = sessionDocContent(linkId, sessionId, docId);
        if (content === undefined) continue;
        const meta = sessionDocsForModule(linkId, sessionId, m.id).find((d) => d.id === docId);
        if (!meta) continue;
        docs.push(meta);
        contentByDocId[docId] = content;
      }
    } else {
      const def = link.defaultDocs.find((d) => d.moduleId === m.id);
      if (def) {
        const loaded = loadDefaultDocContent(linkId, m.id, def.filename, link.defaultDocs);
        if (loaded) {
          const id = defaultDocId(linkId, m.id, def.filename);
          const doc: DocRef = {
            id,
            name: loaded.name,
            type: loaded.type,
            label: DocLabel.Inference,
            sizeKb: Math.max(1, Math.round(loaded.content.length / 1024)),
            uploadedAt: Date.now(),
            preview: loaded.content.slice(0, 180),
          };
          docs.push(doc);
          contentByDocId[id] = loaded.content;
        }
      }
    }
    if (docs.length) assignment[m.id] = docs;
  }
  return { assignment, contentByDocId };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const linkId = parseSharedLinkId(id);
  if (!linkId) return apiError("link not found", 404);

  const ip = clientIpFromHeaders(req.headers);
  const runLimitKey = `shared-run:${linkId}:${ip}` as RateLimitKey;
  const runLimited = await checkRateLimit(runLimitKey, "shared_run");
  if (!runLimited.ok) {
    return apiError("Too many runs on this link — try again later.", HTTP.TOO_MANY_REQUESTS, "rate_limited");
  }

  const link = await getSharedLink(linkId);
  if (!link) return apiError("link not found", 404);

  const jar = await cookies();
  let sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) sessionId = newSessionId();

  const parsed = await parseRequestJson(req, sharedLinkRunBodySchema, {});
  if ("validationError" in parsed) return apiError(parsed.validationError, HTTP.BAD_REQUEST);
  const body = parsed;
  if (link.viewerNameRequired && !body.viewerName?.trim()) {
    return apiError("name required", 400);
  }

  const sharerStore = await openStoreForUser(link.ownerId);
  const overlay = overlayStoreForSharedRun(
    sharerStore,
    link.id,
    sessionId,
    link.defaultDocs,
    orderedInputModules(link.snapshot.modules),
  );

  const project = link.snapshot;
  const inputModules = orderedInputModules(project.modules);
  const { assignment, contentByDocId } = await resolveAssignment(
    link.id,
    sessionId,
    link,
    body.inputDocsByModule as Partial<Record<ModuleId, DocId[]>> | undefined,
  );

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

  const model = link.defaultModel ?? project.modules.find((m) => m.kind === "llm")?.model ?? "qwen-2.5-72b";
  const { fingerprint, inputDocIds: fingerprintInputDocIds } = computeRunFingerprintForRequest(
    overlay,
    project,
    model,
    primary,
    rest,
    resolvedByModule,
  );

  let viewerUserId: user_id_string | undefined;
  if (viewerFundsSharedRun(link.fundingMode)) {
    const auth = await requireAuth();
    if (!isAuthSession(auth)) return apiError("sign in required", 401);
    viewerUserId = auth.userId;
  }
  const billingKey = sharedLinkBillingKey(link.ownerId, link.fundingMode, viewerUserId);

  try {
    assertSharedLinkCanAcceptRun(link);
    await assertCanStartRun(billingKey);
  } catch (err) {
    if (err instanceof SharedLinkSpendLimitError) {
      return apiError(err.message, 402, "spend_limit_reached");
    }
    const code = (err as { code?: string }).code;
    if (code === "insufficient_funds") {
      return apiError(
        link.fundingMode === "sharer_pays"
          ? "Link owner has insufficient credit"
          : "Not enough credit — subscribe or top up",
        402,
        code,
      );
    }
    throw err;
  }

  const reserveCents = link.spendLimitCents != null ? PUBLIC_RUN_SPEND_RESERVE_CENTS : 0;
  if (reserveCents > 0) {
    const reserved = await reserveSharedLinkSpend(link.id, reserveCents);
    if (!reserved) {
      return apiError("This link has reached its spending limit.", 402, "spend_limit_reached");
    }
  }

  if (countActiveJobs(link.ownerId) >= MAX_CONCURRENT_RUNS_PER_USER) {
    return apiError("Too many runs in progress — wait for one to finish.", HTTP.TOO_MANY_REQUESTS, "concurrent_runs");
  }

  const jobDb = await openJobDb();
  const jobId = await createJob(link.ownerId, jobDb);
  const progressToken = registerSharedProgressToken(link.id, link.ownerId, jobId);

  const res = NextResponse.json({ jobId, progressToken, sessionId });
  res.cookies.set(SESSION_COOKIE, sessionId, secureSessionCookieOptions(60 * 60 * 24 * 30));

  after(async () => {
    await withJobLogging(link.ownerId, jobId, jobDb, async () => {
      try {
        const run = await runPipeline(overlay, link.projectId, primary, {
          model,
          inputDocIds: rest,
          inputDocsByModule: resolvedByModule,
          fingerprint,
          fingerprintInputDocIds,
          cacheOwnerId: link.ownerId,
          projectOverride: project,
          runMeta: {
            source: RunSource.SharedLink,
            sharedLinkId: link.id,
            viewerName: body.viewerName?.trim(),
            viewerSessionId: sessionId,
            notes: sharedRunNotes(body.viewerName),
          },
          onStep: (p) => {
            void jobProgress(link.ownerId, jobId, p, jobDb).catch(() => {});
          },
        });
        await sharerStore.flush();
        const billed = run.billedCents;
        if (billed > 0) {
          try {
            const bill = await billSharedLinkRun(billingKey, link.ownerId, link, billed);
            if (reserveCents > 0) {
              const settled = await adjustSharedLinkSpend(link.id, bill.totalCents - reserveCents);
              if (!settled) {
                runLog.warn(`spend limit exceeded after run — revoking link`, {
                  linkId: link.id,
                  billed: bill.totalCents,
                  reserveCents,
                });
                await revokeSharedLink(link.ownerId, link.id);
              }
            } else {
              await recordSharedLinkSpend(link.id, bill.totalCents);
            }
          } catch (billErr) {
            runLog.warn(`post-run billing failed — revoking link`, {
              linkId: link.id,
              jobId,
              billed,
              error: (billErr as Error).message,
            });
            await revokeSharedLink(link.ownerId, link.id);
          }
        } else if (reserveCents > 0) {
          await adjustSharedLinkSpend(link.id, -reserveCents).catch(() => {});
        }
        await incrementSharedLinkRunCount(link.id);
        await finishJob(link.ownerId, jobId, { run }, jobDb);
      } catch (err) {
        if (reserveCents > 0 && !(err instanceof PipelinePausedError)) {
          await adjustSharedLinkSpend(link.id, -reserveCents).catch(() => {});
        }
        if (err instanceof PipelinePausedError) {
          await pauseJob(link.ownerId, jobId, err.checkpoint, jobDb);
          return;
        }
        await finishJob(link.ownerId, jobId, { error: (err as Error).message }, jobDb);
      }
    });
  });

  return res;
}
