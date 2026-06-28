import { invariant } from "@/lib/assert"
import type { DocId, DocRef, ModuleId, PipelineModule, PipelineRun, Project } from "@/lib/types"
import {
  docsForInputModule,
  inputMinCountForModule,
  isMultiDocInputModule,
  orderedInputModules,
  type InputDocsAssignment,
} from "./inference-input-core"
import { buildDefaultInputDocs, docMatchesInputModule } from "./inference-input-picker"

function sortMultiInputDocs(docs: DocRef[]): DocRef[] {
  return [...docs].sort((a, b) => {
    const aTemplate = /template/i.test(a.name) ? 0 : 1
    const bTemplate = /template/i.test(b.name) ? 0 : 1
    if (aTemplate !== bTemplate) return aTemplate - bTemplate
    return a.name.localeCompare(b.name)
  })
}

export function resolveInputDocs(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
  savedDocIds: Partial<Record<ModuleId, DocId | DocId[]>>,
  preferred?: DocRef | null,
): InputDocsAssignment {
  const defaults = buildDefaultInputDocs(docs, project, inputModules, preferred)
  if (!Object.keys(savedDocIds).length) return defaults
  const out: InputDocsAssignment = { ...defaults }
  for (const m of inputModules) {
    const saved = savedDocIds[m.id]
    if (!saved) continue
    const ids = Array.isArray(saved) ? saved : [saved]
    const resolved = ids.flatMap((id) => {
      const doc = docs.find((d) => d.id === id)
      return doc && docMatchesInputModule(doc, m) ? [doc] : []
    })
    if (!resolved.length) continue
    if (isMultiDocInputModule(m)) {
      const defaultDocs = docsForInputModule(defaults, m.id)
      const seen = new Set(resolved.map((d) => d.id))
      const merged = sortMultiInputDocs([
        ...resolved,
        ...defaultDocs.filter((d) => !seen.has(d.id)),
      ])
      out[m.id] =
        merged.length >= inputMinCountForModule(m)
          ? merged
          : defaultDocs.length
            ? defaultDocs
            : merged
      continue
    }
    out[m.id] = resolved[0]
  }
  return out
}

export function flattenInputDocIds(
  inputModules: PipelineModule[],
  inputDocs: InputDocsAssignment,
): DocId[] {
  return inputModules.flatMap((m) => docsForInputModule(inputDocs, m.id).map((d) => d.id as DocId))
}

export function inputDocIdsForModules(
  inputModules: PipelineModule[],
  inputDocs: InputDocsAssignment,
): DocId[] {
  return flattenInputDocIds(inputModules, inputDocs)
}

export function inputDocsByModuleFromAssignment(
  inputModules: PipelineModule[],
  assignment: InputDocsAssignment,
): Partial<Record<ModuleId, DocId[]>> {
  const out: Partial<Record<ModuleId, DocId[]>> = {}
  for (const m of inputModules) {
    const moduleDocs = docsForInputModule(assignment, m.id)
    if (moduleDocs.length) out[m.id] = moduleDocs.map((d) => d.id as DocId)
  }
  return out
}

export function inputDocsByModuleFromFlat(
  inputModules: PipelineModule[],
  flatDocIds: DocId[],
): Partial<Record<ModuleId, DocId[]>> {
  const out: Partial<Record<ModuleId, DocId[]>> = {}
  let i = 0
  for (const m of inputModules) {
    if (i >= flatDocIds.length) break
    if (isMultiDocInputModule(m)) {
      const rest = flatDocIds.slice(i)
      invariant(rest.length > 0, `flat doc ids exhausted before multi-doc module ${m.id}`)
      out[m.id] = rest
      break
    }
    out[m.id] = [flatDocIds[i]!]
    i += 1
  }
  return out
}

export function flattenInputDocIdsFromByModule(
  inputModules: PipelineModule[],
  byModule: Partial<Record<ModuleId, DocId[]>>,
): DocId[] {
  return inputModules.flatMap((m) => byModule[m.id] ?? [])
}

export function buildRunInputDocIds(
  docs: DocRef[],
  project: Project,
  inputDocId: DocId,
  extraInputDocIds: DocId[] = [],
  seedDocNames?: string[],
  explicitByModule?: Partial<Record<ModuleId, DocId[]>>,
): DocId[] {
  const inputMods = orderedInputModules(project.modules)
  if (explicitByModule && Object.keys(explicitByModule).length) {
    return flattenInputDocIdsFromByModule(inputMods, explicitByModule)
  }
  const explicit = [inputDocId, ...extraInputDocIds].filter(Boolean) as DocId[]
  if (explicit.length > inputMods.length) {
    return explicit
  }
  const names = seedDocNames ?? project.seedDocNames
  const scoped = names?.length ? docs.filter((d) => new Set(names).has(d.name)) : docs
  const inputQueue: DocId[] = []
  const used = new Set<DocId>()
  for (let i = 0; i < inputMods.length; i++) {
    const mod = inputMods[i]
    if (isMultiDocInputModule(mod)) {
      const seeded = scoped
        .filter(
          (d) =>
            d.label === "inference" &&
            !used.has(d.id) &&
            docMatchesInputModule(d, mod),
        )
        .map((d) => d.id as DocId)
      seeded.forEach((id) => {
        inputQueue.push(id)
        used.add(id)
      })
      continue
    }
    const explicitId = explicit[i]
    if (explicitId) {
      inputQueue.push(explicitId)
      used.add(explicitId)
      continue
    }
    const fallback = scoped
      .filter(
        (d) =>
          d.label === "inference" &&
          !used.has(d.id) &&
          docMatchesInputModule(d, mod),
      )
      .reverse()[0]?.id
    if (fallback) {
      inputQueue.push(fallback)
      used.add(fallback)
    }
  }
  return inputQueue
}

export function resolveRunInputDocIds(docs: DocRef[], project: Project, run: PipelineRun): DocId[] {
  if (run.inputDocIds?.length) return run.inputDocIds
  if (!run.inputDocId) return []
  return buildRunInputDocIds(docs, project, run.inputDocId, [])
}

export function runInputDocIdsMatch(
  docs: DocRef[],
  project: Project,
  run: PipelineRun,
  orderedInputDocIds: DocId[],
): boolean {
  const resolved = resolveRunInputDocIds(docs, project, run)
  if (resolved.length !== orderedInputDocIds.length) return false
  return resolved.every((id, i) => id === orderedInputDocIds[i])
}

export function docLabel(docs: DocRef[], docId?: DocId): string {
  if (!docId) return "—"
  return docs.find((d) => d.id === docId)?.name ?? docId
}

export function runInputDocsSummary(docs: DocRef[], project: Project, run: PipelineRun): string {
  const ids = resolveRunInputDocIds(docs, project, run)
  if (!ids.length) return "—"
  if (ids.length === 1) return docLabel(docs, ids[0])
  return ids.map((id) => docLabel(docs, id)).join(", ")
}
