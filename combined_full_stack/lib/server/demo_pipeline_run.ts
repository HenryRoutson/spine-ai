// AI : /demo inference — run bundled seed/fork pipelines without a signed-in store row.
import { ephemeralPipelineStore } from "@/lib/server/landing_pipeline_run"
import { getDemoDocText, getDemoState } from "@/lib/server/demo_store"
import { runPipeline } from "@/lib/server/run_engine"
import { DEFAULT_MODEL, type DocId, type ModelId, type ModuleId, type PipelineRun, type ProjectId } from "@/lib/server/types"

export async function runDemoProject(opts: {
  projectId: ProjectId
  inputDocId: DocId
  inputDocIds?: DocId[]
  inputDocsByModule?: Partial<Record<ModuleId, DocId[]>>
  model?: ModelId
  buildId?: string | null
}): Promise<PipelineRun> {
  const state = await getDemoState(opts.projectId, opts.buildId)
  const project = state.projects.find((p) => p.id === opts.projectId)
  if (!project) throw new Error(`unknown project ${opts.projectId}`)

  const exampleDocs: { ref: (typeof state.docs)[number]; content: string }[] = []
  for (const ref of state.docs) {
    const content = await getDemoDocText(ref.id)
    if (content === undefined) continue
    exampleDocs.push({ ref, content })
  }
  const store = ephemeralPipelineStore(project, exampleDocs)

  return runPipeline(store, project.id, opts.inputDocId, {
    model: opts.model ?? DEFAULT_MODEL,
    inputDocIds: opts.inputDocIds,
    inputDocsByModule: opts.inputDocsByModule,
    persist: false,
    liveHtml: false,
    projectOverride: project,
    cacheOwnerId: `demo:${project.id}`,
    runMeta: { notes: "demo" },
  })
}
