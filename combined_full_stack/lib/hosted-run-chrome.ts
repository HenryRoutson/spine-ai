import type { ModuleId } from "@/lib/types"

// AI : hosted {{run}} chrome — hide upload jargon when the visitor has nothing to provide.

export function hostedRunHidesInputSlots(
  inputModuleIds: ModuleId[],
  defaultDocs: { moduleId: ModuleId }[],
): boolean {
  if (inputModuleIds.length === 0) return true
  return inputModuleIds.every((id) => defaultDocs.some((d) => d.moduleId === id))
}
