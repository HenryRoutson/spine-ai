import { parseFetchJson, readApiErrorBody, JSON_HEADERS, FETCH_NO_STORE } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { sanitizeClientStepPayload } from "@/lib/client-step-payload"
import {
  awaitJobCompletion,
  mergeStepStates,
  pollJobProgress,
  type ClientStepSubmitPayload,
} from "@/lib/run-engine"
import type {
  DocId,
  DocRef,
  ModuleId,
  PipelineRun,
  RunJob,
  RunJobId,
  StepProgress,
} from "@/lib/types"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"
import type { ClientStepSpec } from "@/lib/run-types"

// AI : must match EMBED_SESSION_HEADER on the server.
const EMBED_SESSION_HEADER = "x-embed-session"

function withEmbedSession(
  headers: HeadersInit | undefined,
  embedSessionToken?: string,
): HeadersInit | undefined {
  if (!embedSessionToken) return headers
  return { ...(headers ?? {}), [EMBED_SESSION_HEADER]: embedSessionToken }
}

export async function fetchSharedLink(id: string): Promise<SharedLinkPublicView> {
  const res = await fetch(API_ROUTES.sharedLink(id), FETCH_NO_STORE)
  const body = await parseFetchJson<{ link: SharedLinkPublicView; error?: string }>(
    res,
    "load shared link",
  )
  if (!body.link) throw new Error("load shared link: missing link in response")
  return body.link
}

export async function uploadSharedDoc(
  linkId: string,
  moduleId: ModuleId,
  file: File,
  embedSessionToken?: string,
): Promise<DocRef> {
  const form = new FormData()
  form.set("file", file)
  form.set("moduleId", moduleId)
  const res = await fetch(API_ROUTES.sharedLinkDocs(linkId), {
    method: "POST",
    body: form,
    headers: withEmbedSession(undefined, embedSessionToken),
  })
  return parseFetchJson<DocRef>(res, "upload shared doc")
}

export async function startSharedRun(
  linkId: string,
  inputDocsByModule: Partial<Record<ModuleId, DocId[]>>,
  viewerName?: string,
  embedSessionToken?: string,
): Promise<{ jobId: RunJobId; progressToken: string }> {
  const res = await fetch(API_ROUTES.sharedLinkRun(linkId), {
    method: "POST",
    headers: withEmbedSession(JSON_HEADERS, embedSessionToken),
    body: JSON.stringify({ inputDocsByModule, viewerName }),
  })
  return parseFetchJson<{ jobId: RunJobId; progressToken: string }>(res, "start shared run")
}

export async function pollSharedProgress(
  linkId: string,
  jobId: RunJobId,
  token: string,
): Promise<RunJob> {
  const url = `${API_ROUTES.sharedLinkProgress(linkId)}?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`
  return pollJobProgress(url, "shared run progress")
}

async function submitSharedClientStep(
  linkId: string,
  jobId: RunJobId,
  token: string,
  payload: ClientStepSubmitPayload,
  opts?: { stepLabel?: string },
): Promise<void> {
  const res = await fetch(API_ROUTES.sharedLinkClientStep(linkId), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ jobId, token, ...sanitizeClientStepPayload(payload) }),
  })
  if (res.ok) return
  const body = await readApiErrorBody(res)
  if (res.status === 409 && body?.error?.includes("not waiting for client code")) return
  const stepHint = opts?.stepLabel ? ` "${opts.stepLabel}"` : ""
  throw new Error(body?.error ?? `Client code step${stepHint} failed`)
}

export async function awaitSharedRun(
  linkId: string,
  jobId: RunJobId,
  token: string,
  callbacks:
    | {
        onStep: (steps: StepProgress[]) => void
        onHumanReview?: (spec: ClientStepSpec) => Promise<"approved" | "rejected">
        onChatbot?: (spec: ClientStepSpec) => Promise<import("@/lib/chatbot-step").ChatbotResultValue>
      }
    | ((steps: StepProgress[]) => void),
  intervalMs = 700,
): Promise<PipelineRun> {
  const clientStepContext = { stepLabel: undefined as string | undefined }
  const { run } = await awaitJobCompletion(
    () => pollSharedProgress(linkId, jobId, token),
    (payload) =>
      submitSharedClientStep(linkId, jobId, token, payload, { stepLabel: clientStepContext.stepLabel }),
    callbacks,
    intervalMs,
    clientStepContext,
  )
  return run
}

export async function fetchSharedDownload(
  linkId: string,
  runId: string,
  jobId: string,
  token: string,
) {
  const url = `${API_ROUTES.sharedLinkDownload(linkId)}?runId=${encodeURIComponent(runId)}&jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`
  const res = await fetch(url, FETCH_NO_STORE)
  return parseFetchJson<{
    runId: string
    status: string
    outputs: { label: string; kind: string; status: string; json?: string; preview: string }[]
    markdown: string
  }>(res, "shared run download")
}

export { mergeStepStates }
