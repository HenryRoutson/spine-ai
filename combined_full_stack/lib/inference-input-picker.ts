import {
  inputNameRestrictionLabel,
  inputTypeLabel,
  inputTypesForModule,
  isMultiDocInputModule,
  type InputDocsAssignment,
} from "@/lib/inference-input-core"
import { docsForProject } from "@/lib/project-docs"
import type { DocRef, PipelineModule, Project } from "@/lib/types"

export { inputNameRestrictionLabel } from "@/lib/inference-input-core"

export type InputDocExclusionReason = "wrong-type" | "name-mismatch"

export function docNameMatchesInputModule(doc: DocRef, inputModule: PipelineModule): boolean {
  const required = inputModule.inputNameContains?.trim()
  if (!required) return true
  return doc.name.toLowerCase().includes(required.toLowerCase())
}

export function docMatchesInputModule(doc: DocRef, inputModule: PipelineModule): boolean {
  const allowed = inputTypesForModule(inputModule)
  if (!allowed.length) return false
  if (!allowed.includes(doc.type)) return false
  return docNameMatchesInputModule(doc, inputModule)
}

export function exclusionReasonForInputModule(
  doc: DocRef,
  inputModule: PipelineModule,
): InputDocExclusionReason | undefined {
  const allowed = inputTypesForModule(inputModule)
  if (!allowed.length || !allowed.includes(doc.type)) return "wrong-type"
  if (!docNameMatchesInputModule(doc, inputModule)) return "name-mismatch"
  return undefined
}

export function exclusionReasonLabel(reason: InputDocExclusionReason, inputModule: PipelineModule): string {
  if (reason === "wrong-type") return `wrong type — needs ${inputTypeLabel(inputModule.inputType)}`
  const required = inputNameRestrictionLabel(inputModule)
  return required ? `name must contain "${required}"` : "does not match this input"
}

export function passableDocsForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
): DocRef[] {
  const scoped = docsForProject(docs, project)
  return scoped.filter((d) => d.label === "inference" && docMatchesInputModule(d, inputModule))
}

export function excludedDocsForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
): { doc: DocRef; reason: InputDocExclusionReason }[] {
  const scoped = docsForProject(docs, project).filter((d) => d.label === "inference")
  return scoped.flatMap((doc) => {
    if (docMatchesInputModule(doc, inputModule)) return []
    const reason = exclusionReasonForInputModule(doc, inputModule)
    return reason ? [{ doc, reason }] : []
  })
}

function sortPassableBySeedOrder(docs: DocRef[], project: Project): DocRef[] {
  const names = project.seedDocNames
  if (!names?.length) return docs
  const rank = new Map(names.map((n, i) => [n, i]))
  return [...docs].sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999))
}

export function defaultDocForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
  preferred?: DocRef | null,
  excludeIds: ReadonlySet<DocRef["id"]> = new Set(),
): DocRef | undefined {
  const passable = sortPassableBySeedOrder(
    passableDocsForInputModule(docs, project, inputModule).filter((d) => !excludeIds.has(d.id)),
    project,
  )
  if (preferred && passable.some((d) => d.id === preferred.id)) return preferred
  return passable[0]
}

function sortMultiInputDocs(docs: DocRef[]): DocRef[] {
  return [...docs].sort((a, b) => {
    const aTemplate = /template/i.test(a.name) ? 0 : 1
    const bTemplate = /template/i.test(b.name) ? 0 : 1
    if (aTemplate !== bTemplate) return aTemplate - bTemplate
    return a.name.localeCompare(b.name)
  })
}

export function defaultInputDocsForModules(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
  preferred?: DocRef | null,
): InputDocsAssignment {
  const out: InputDocsAssignment = {}
  const used = new Set<DocRef["id"]>()
  for (const m of inputModules) {
    const passable = sortPassableBySeedOrder(
      passableDocsForInputModule(docs, project, m).filter((d) => !used.has(d.id)),
      project,
    )
    if (!passable.length) continue
    if (isMultiDocInputModule(m)) {
      const picked = sortMultiInputDocs(passable)
      picked.forEach((d) => used.add(d.id))
      out[m.id] = picked
      continue
    }
    const doc = defaultDocForInputModule(docs, project, m, preferred, used)
    if (!doc) continue
    out[m.id] = doc
    used.add(doc.id)
  }
  return out
}

export function buildDefaultInputDocs(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
  preferred?: DocRef | null,
): InputDocsAssignment {
  return defaultInputDocsForModules(docs, project, inputModules, preferred ?? null)
}
