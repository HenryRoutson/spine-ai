import { FETCH_CREDENTIALS, formatApiError, readApiErrorBody } from "@/lib/api-client"
import type { DocRef, ModelOptionPublic, PipelineRun, Project } from "@/lib/types"

export const STATE_STREAM_EVENT = {
  PROJECTS: "projects",
  MODEL_OPTIONS: "modelOptions",
  DOCS: "docs",
  RUNS: "runs",
  DONE: "done",
  ERROR: "error",
} as const

export type StateStreamChunk = {
  projects?: Project[]
  modelOptions?: ModelOptionPublic[]
  docs?: DocRef[]
  runs?: PipelineRun[]
}

export type StateStreamHandlers = {
  onChunk?: (chunk: StateStreamChunk) => void
}

// AI : progressive hydrate from NDJSON GET /api/state — UI can render before runs finish.
export async function readStateStream(
  url: string,
  handlers: StateStreamHandlers = {},
  signal?: AbortSignal,
): Promise<StateStreamChunk> {
  const res = await fetch(url, { credentials: FETCH_CREDENTIALS, signal })
  if (!res.ok) throw new Error(formatApiError(url, res, await readApiErrorBody(res)))

  const type = res.headers.get("content-type") ?? ""
  if (!type.includes("ndjson")) {
    const data = (await res.json()) as StateStreamChunk & { allRuns?: PipelineRun[] }
    const merged: StateStreamChunk = {
      projects: data.projects,
      modelOptions: data.modelOptions,
      docs: data.docs,
      runs: data.runs,
    }
    handlers.onChunk?.(merged)
    return merged
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error("State stream unavailable")

  const decoder = new TextDecoder()
  let buffer = ""
  const merged: StateStreamChunk = {}

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      const evt = JSON.parse(line) as {
        type: string
        projects?: Project[]
        modelOptions?: ModelOptionPublic[]
        docs?: DocRef[]
        runs?: PipelineRun[]
        error?: string
      }
      if (evt.type === STATE_STREAM_EVENT.ERROR) {
        throw new Error(typeof evt.error === "string" ? evt.error : "State stream failed")
      }
      const chunk: StateStreamChunk = {}
      if (evt.type === STATE_STREAM_EVENT.PROJECTS && evt.projects) {
        chunk.projects = evt.projects
        merged.projects = evt.projects
      }
      if (evt.type === STATE_STREAM_EVENT.MODEL_OPTIONS && evt.modelOptions) {
        chunk.modelOptions = evt.modelOptions
        merged.modelOptions = evt.modelOptions
      }
      if (evt.type === STATE_STREAM_EVENT.DOCS && evt.docs) {
        chunk.docs = evt.docs
        merged.docs = evt.docs
      }
      if (evt.type === STATE_STREAM_EVENT.RUNS && evt.runs) {
        chunk.runs = evt.runs
        merged.runs = evt.runs
      }
      if (Object.keys(chunk).length) handlers.onChunk?.(chunk)
    }
  }

  return merged
}
