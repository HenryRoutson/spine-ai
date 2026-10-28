import type { JobLogEntry, ModuleId, PipelineRun } from "@/lib/types"

// AI : completed runs keep per-step serverLogs on the persisted PipelineRun — use that so
// AI : concurrent jobs can't bleed into the inference trace after finish.
export function logsByModuleFromRun(run: PipelineRun, moduleIds: ModuleId[]): Map<ModuleId, JobLogEntry[]> {
  const buckets = new Map<ModuleId, JobLogEntry[]>(moduleIds.map((id) => [id, []]))
  for (const step of run.steps) {
    if (step.serverLogs?.length) buckets.set(step.moduleId, step.serverLogs)
  }
  return buckets
}

// AI : bucket streamed job logs by pipeline module — unattributed lines follow the active step.
export function partitionLogsByModule(
  logs: JobLogEntry[],
  moduleIds: ModuleId[],
  activeModuleId?: ModuleId,
): Map<ModuleId, JobLogEntry[]> {
  const buckets = new Map<ModuleId, JobLogEntry[]>(moduleIds.map((id) => [id, []]))
  for (const entry of logs) {
    const target =
      entry.moduleId && buckets.has(entry.moduleId)
        ? entry.moduleId
        : activeModuleId && buckets.has(activeModuleId)
          ? activeModuleId
          : undefined
    if (target) buckets.get(target)!.push(entry)
  }
  return buckets
}
