import type { cron_expr_string, iana_timezone_string } from "@/lib/cron-expr"
import type { DocId, ModelId, ModuleId, PipelineScheduleId, ProjectId, pipeline_function_id } from "./types"

export type { PipelineScheduleId }

export type ScheduleDefaultDoc = {
  moduleId: ModuleId
  docId: DocId
}

export type PipelineScheduleRecord = {
  id: PipelineScheduleId
  projectId: ProjectId
  name: string
  cron: cron_expr_string
  timezone: iana_timezone_string
  enabled: boolean
  defaultModel?: ModelId
  defaultDocs: ScheduleDefaultDoc[]
  nextRunAt: number
  lastRunAt?: number
  lastClaimedAt?: number
  lastError?: string
  runCount: number
  createdAt: number
  functionId: pipeline_function_id
}

export type PipelineScheduleRuntime = {
  tickUrl: string | null
  tickConfigured: boolean
  cronJobReady: boolean
  lastTickAt?: number
}

export const PIPELINE_SCHEDULE_NOTES_PREFIX = "(cron)"

export function pipelineScheduleRunNotes(name: string): string {
  return `${PIPELINE_SCHEDULE_NOTES_PREFIX} ${name}`
}

export function scheduleDocsFromByModule(
  byModule: Partial<Record<string, string[]>> | undefined,
): ScheduleDefaultDoc[] {
  const out: ScheduleDefaultDoc[] = []
  for (const [moduleId, ids] of Object.entries(byModule ?? {})) {
    for (const docId of ids ?? []) {
      out.push({ moduleId: moduleId as ModuleId, docId: docId as DocId })
    }
  }
  return out
}

export function scheduleDocsToByModule(
  docs: ScheduleDefaultDoc[],
): Partial<Record<ModuleId, DocId[]>> {
  const out: Partial<Record<ModuleId, DocId[]>> = {}
  for (const doc of docs) {
    const ids = out[doc.moduleId] ?? []
    ids.push(doc.docId)
    out[doc.moduleId] = ids
  }
  return out
}
