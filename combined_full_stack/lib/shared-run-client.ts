import { readApiErrorBody, JSON_HEADERS, FETCH_NO_STORE } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { mergeStepStates } from "@/lib/run-engine"
import type { DocId, DocRef, ModuleId, PipelineRun, RunJobId, StepProgress } from "@/lib/types"
import type { SharedLinkPublicView } from "@/lib/shared-link-types"

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
): Promise<{ steps: StepProgress[]; run?: PipelineRun; error?: string }> {
  const url = `${API_ROUTES.sharedLinkProgress(linkId)}?jobId=${encodeURIComponent(jobId)}&token=${encodeURIComponent(token)}`
  const res = await fetch(url, FETCH_NO_STORE)
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? "Progress poll failed")
  return body
}

export async function awaitSharedRun(
  linkId: string,
  jobId: RunJobId,
  token: string,
  onStep: (steps: StepProgress[]) => void,
  intervalMs = 700,
): Promise<PipelineRun> {
  for (;;) {
    const job = await pollSharedProgress(linkId, jobId, token)
    onStep(job.steps)
    if (job.run) return job.run
    if (job.error) throw new Error(job.error)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
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
