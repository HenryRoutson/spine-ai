import { NextResponse, type NextRequest, after } from "next/server";
import { cookies } from "next/headers";
import { apiError } from "@/lib/server/api_context";
import {
  assertCanStartRun,
  billRunUsage,
  billingKeyForUser,
} from "@/lib/server/billing_account";
import { confidentialUploadWarning } from "@/lib/confidential-upload";
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
  createJob,
  finishJob,
  jobProgress,
  openJobDb,
  pauseJob,
  withJobLogging,
} from "@/lib/server/run_jobs";
import {
  getSharedLink,
  incrementSharedLinkRunCount,
  loadDefaultDocContent,
  newSessionId,
  openStoreForUser,
  overlayStoreForSharedRun,
  registerSharedProgressToken,
  sessionDocContent,
  sessionDocsForModule,
} from "@/lib/server/shared_links";
import { isAuthSession, requireAuth } from "@/lib/server/require_auth";
import { logger } from "@/lib/server/server_logger";
import type { DocId, DocRef, ModuleId, SharedLinkId } from "@/lib/server/types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "shared_run_session";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

type RunBody = {
  inputDocsByModule?: Partial<Record<ModuleId, DocId[]>>;
  viewerName?: string;
  sessionId?: string;
};

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
        const loaded = loadDefaultDocContent(linkId, m.id, def.filename);
        if (loaded) {
          const id = defaultDocId(linkId, m.id, def.filename);
          const doc: DocRef = {
            id,
            name: loaded.name,
            type: loaded.type,
            label: "inference",
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
  const { id: linkId } = await ctx.params;
  const link = await getSharedLink(linkId as SharedLinkId);
  if (!link) return apiError("link not found", 404);

  const jar = await cookies();
  let sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) sessionId = newSessionId();

  const body = (await req.json().catch(() => ({}))) as RunBody;
  if (link.viewerNameRequired && !body.viewerName?.trim()) {
    return apiError("name required", 400);
  }

  if (link.fundingMode === "viewer_signs_in") {
    const auth = await requireAuth();
    if (!isAuthSession(auth)) return apiError("sign in required", 401);
  }

  const sharerStore = await openStoreForUser(link.ownerId);
  const overlay = overlayStoreForSharedRun(
    sharerStore,
    link.id,
    sessionId,
    link,
    orderedInputModules(link.snapshot.modules),
  );

  const project = link.snapshot;
  const inputModules = orderedInputModules(project.modules);
  const { assignment, contentByDocId } = await resolveAssignment(
    link.id,
    sessionId,
    link,
    body.inputDocsByModule,
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

  let billingKey = billingKeyForUser(link.ownerId);
  if (link.fundingMode === "viewer_signs_in") {
    const auth = await requireAuth();
    if (!isAuthSession(auth)) return apiError("sign in required", 401);
    billingKey = billingKeyForUser(auth.userId);
  }

  try {
    await assertCanStartRun(billingKey);
  } catch (err) {
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

  const jobDb = await openJobDb();
  const jobId = await createJob(link.ownerId, jobDb);
  const progressToken = registerSharedProgressToken(link.id, link.ownerId, jobId);

  const res = NextResponse.json({ jobId, progressToken, sessionId });
  res.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

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
            source: "shared_link",
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
        if (run.billedCents > 0) {
          try {
            await billRunUsage(billingKey, run.billedCents);
          } catch {
            /* post-run billing */
          }
        }
        await incrementSharedLinkRunCount(link.id);
        await finishJob(link.ownerId, jobId, { run }, jobDb);
      } catch (err) {
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
