// AI : GUI useStore → SpineSession bridge — mutations commit through session; React owns HTTP hydrate/debounce.

import { emptySessionSnapshot, SpineSession } from "@/lib/core/session"
import type { PersistPort, SessionSnapshot } from "@/lib/core/types"
import type { DocId, DocRef, ModuleId, PipelineRun, Project } from "@/lib/types"

export type GuiSessionSyncInput = {
  projects: Project[]
  activeProjectId: string
  model: string
  docs: DocRef[]
  runs: PipelineRun[]
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  pendingCreates: Project[]
  deletedProjectIds: string[]
}

// AI : map React store slices → SessionSnapshot for hydrate + ViewModels.
export function buildGuiSessionSnapshot(
  input: GuiSessionSyncInput,
  prev?: SessionSnapshot,
): SessionSnapshot {
  const base = prev ?? emptySessionSnapshot()
  return {
    ...base,
    projects: input.projects,
    activeProjectId: input.activeProjectId,
    model: input.model,
    docs: input.docs,
    runs: input.runs,
    inferenceInputDocIds: input.inferenceInputDocIds,
    pendingCreates: input.pendingCreates,
    deletedProjectIds: input.deletedProjectIds,
  }
}

export type GuiSpineSessionHandlers = {
  onPersist: (snap: SessionSnapshot) => void
  scheduleProjectSave: (project: Project) => void
}

export function createGuiSpineSession(handlers: GuiSpineSessionHandlers): SpineSession {
  const persist: PersistPort = {
    load: () => null,
    save: (snap) => {
      handlers.onPersist(snap)
      const active =
        snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
      if (active && !active.teamReadOnly) handlers.scheduleProjectSave(active)
    },
  }
  return new SpineSession({ persist })
}
