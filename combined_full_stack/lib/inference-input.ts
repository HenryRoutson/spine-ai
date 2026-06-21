import { docsForProject } from "@/lib/project-docs"
import type { DocRef, InputType, PipelineModule, Project } from "@/lib/types"

export function docMatchesInputModule(doc: DocRef, inputModule: PipelineModule): boolean {
  if (!inputModule.inputType) return false
  return doc.type === inputModule.inputType
}

// AI : one input step — project-scoped inference docs matching that slot's inputType only.
export function passableDocsForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
): DocRef[] {
  const scoped = docsForProject(docs, project)
  return scoped.filter((d) => d.label === "inference" && docMatchesInputModule(d, inputModule))
}

export function orderedInputModules(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === "input")
}

export function defaultDocForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
  preferred?: DocRef | null,
): DocRef | undefined {
  const passable = passableDocsForInputModule(docs, project, inputModule)
  if (preferred && passable.some((d) => d.id === preferred.id)) return preferred
  return passable[0]
}

export function inputTypeLabel(type?: InputType): string {
  return type ?? "file"
}
