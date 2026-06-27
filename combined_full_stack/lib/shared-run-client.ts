import { readApiErrorBody, JSON_HEADERS, FETCH_NO_STORE } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import {
  awaitJobCompletion,
  mergeStepStates,
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

export async function fetchSharedLink(id: string): Promise<SharedLinkPublicView> {
  const res = await fetch(API_ROUTES.sharedLink(id), FETCH_NO_STORE)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Failed to load link")
  return body.link as SharedLinkPublicView
}

export async function uploadSharedDoc(
  linkId: string,
  moduleId: ModuleId,
  file: File,
): Promise<DocRef> {
  const form = new FormData()
  form.set("file", file)
  form.set("moduleId", moduleId)
  const res = await fetch(API_ROUTES.sharedLinkDocs(linkId), { method: "POST", body: form })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Upload failed")
  return body as DocRef
}

export async function startSharedRun(
  linkId: string,
  inputDocsByModule: Partial<Record<ModuleId, DocId[]>>,
  viewerName?: string,
): Promise<{ jobId: RunJobId; progressToken: string }> {
  const res = await fetch(API_ROUTES.sharedLinkRun(linkId), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ inputDocsByModule, viewerName }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Run failed")
  return { jobId: body.jobId, progressToken: body.progressToken }
}

export async function pollSharedProgress(
  linkId: string,
  jobId: RunJobId,
  token: string,
): Promise<RunJob> {
  const url = `${API_ROUTES.sharedLinkProgress(linkId)}?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`
  const res = await fetch(url, FETCH_NO_STORE)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Progress poll failed")
  return body as RunJob
}

async function submitSharedClientStep(
  linkId: string,
  jobId: RunJobId,
  token: string,
  payload: ClientStepSubmitPayload,
): Promise<void> {
  const res = await fetch(API_ROUTES.sharedLinkClientStep(linkId), {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ jobId, token, ...payload }),
  })
  if (res.ok) return
  const body = await readApiErrorBody(res)
  if (res.status === 409 && body?.error?.includes("not waiting for client code")) return
  throw new Error(body?.error ?? "Client step failed")
}

export async function awaitSharedRun(
  linkId: string,
  jobId: RunJobId,
  token: string,
  callbacks:
    | { onStep: (steps: StepProgress[]) => void; onHumanReview?: (spec: ClientStepSpec) => Promise<"approved" | "rejected"> }
    | ((steps: StepProgress[]) => void),
  intervalMs = 700,
): Promise<PipelineRun> {
  const { run } = await awaitJobCompletion(
    () => pollSharedProgress(linkId, jobId, token),
    (payload) => submitSharedClientStep(linkId, jobId, token, payload),
    callbacks,
    intervalMs,
  )
  return run
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function fetchSharedDownload(
  linkId: string,
  runId: string,
  jobId: string,
  token: string,
) {
  const url = `${API_ROUTES.sharedLinkDownload(linkId)}?runId=${encodeURIComponent(runId)}&jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`
  const res = await fetch(url, FETCH_NO_STORE)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Download failed")
  return body as {
    runId: string
    status: string
    outputs: { label: string; kind: string; status: string; json?: string; preview: string }[]
    markdown: string
  }
}

export { mergeStepStates }
