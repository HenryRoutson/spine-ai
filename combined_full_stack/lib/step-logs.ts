import type { JobLogEntry, ModuleId } from "@/lib/types"

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
