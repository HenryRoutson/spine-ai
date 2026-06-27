// AI : TODO refactor — split assignment/resolution (buildRunInputDocIds, resolveInputDocs) from picker helpers (passableDocsForInputModule).
import { docsForProject } from "@/lib/project-docs"
import { INPUT_TYPES, type DocId, type DocRef, type InputType, type InputTypeSpec, type ModuleId, type PipelineModule, type PipelineRun, type Project } from "@/lib/types"

export type InputDocsAssignment = Partial<Record<ModuleId, DocRef | DocRef[]>>

export function inputMinCountForModule(inputModule: PipelineModule): number {
  return Math.max(1, inputModule.inputMinCount ?? 1)
}

export function isMultiDocInputModule(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && (inputMinCountForModule(inputModule) > 1 || !!inputModule.outIsList)
}

export function docsForInputModule(assignment: InputDocsAssignment, moduleId: ModuleId): DocRef[] {
  const v = assignment[moduleId]
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

export function moduleInputReady(inputModule: PipelineModule, assignment: InputDocsAssignment): boolean {
  return docsForInputModule(assignment, inputModule.id).length >= inputMinCountForModule(inputModule)
}

export function inputTypesForModule(inputModule: PipelineModule): InputType[] {
  if (!inputModule.inputType) return []
  return Array.isArray(inputModule.inputType) ? inputModule.inputType : [inputModule.inputType]
}

// AI : OCR toggle when the input accepts PDF (scans) and/or Image (photos, handwriting).
export function inputTypesNeedOcr(types: InputType[]): boolean {
  return types.includes("pdf") || types.includes("image")
}

export function inputModuleNeedsOcr(inputModule: PipelineModule): boolean {
  return inputModule.kind === "input" && inputTypesNeedOcr(inputTypesForModule(inputModule))
}

export function upstreamInputModule(
  module: PipelineModule,
  modules: PipelineModule[],
): PipelineModule | undefined {
  const idx = modules.findIndex((m) => m.id === module.id)
  for (let i = idx - 1; i >= 0; i--) {
    const m = modules[i]
    if (m?.kind === "input") return m
  }
  return undefined
}

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

export function inputNameRestrictionLabel(inputModule: PipelineModule): string | undefined {
  const s = inputModule.inputNameContains?.trim()
  return s || undefined
}

export type InputDocExclusionReason = "wrong-type" | "name-mismatch"

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

// AI : one input step — project-scoped inference docs matching any of the slot's allowed types.
export function passableDocsForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
): DocRef[] {
  const scoped = docsForProject(docs, project)
  return scoped.filter((d) => d.label === "inference" && docMatchesInputModule(d, inputModule))
}

// AI : project inference docs that fail this slot's type or name rules — shown muted in the picker.
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

export function orderedInputModules(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === "input")
}

// AI : seeded example filenames first — matches docs[] order in seeds/*.json.
function sortPassableBySeedOrder(docs: DocRef[], project: Project): DocRef[] {
  const names = project.seedDocNames;
  if (!names?.length) return docs;
  const rank = new Map(names.map((n, i) => [n, i]));
  return [...docs].sort((a, b) => (rank.get(a.name) ?? 999) - (rank.get(b.name) ?? 999));
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
  );
  if (preferred && passable.some((d) => d.id === preferred.id)) return preferred
  return passable[0]
}

// AI : template filenames first, then remaining inference docs alphabetically.
function sortMultiInputDocs(docs: DocRef[]): DocRef[] {
  return [...docs].sort((a, b) => {
    const aTemplate = /template/i.test(a.name) ? 0 : 1
    const bTemplate = /template/i.test(b.name) ? 0 : 1
    if (aTemplate !== bTemplate) return aTemplate - bTemplate
    return a.name.localeCompare(b.name)
  })
}

// AI : assign docs per input slot — multi-doc slots get every matching unused inference doc.
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
    );
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

export function inputTypeLabel(type?: InputTypeSpec): string {
  if (!type) return "file"
  const types = Array.isArray(type) ? type : [type]
  const labels = types.map((t) => INPUT_TYPES.find((x) => x.value === t)?.label ?? t)
  if (labels.length <= 2) return labels.join(" or ")
  return `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
}

const FILE_ACCEPT: Partial<Record<InputType, string>> = {
  pdf: ".pdf",
  word: ".doc,.docx",
  excel: ".xls,.xlsx,.csv",
  json: ".json",
  text: ".txt,.md",
  web: ".html,.htm",
  image: ".png,.jpg,.jpeg,.webp",
}

export function inputTypeAccept(type?: InputTypeSpec): string | undefined {
  const types = !type ? [] : Array.isArray(type) ? type : [type]
  const exts = types.map((t) => FILE_ACCEPT[t]).filter(Boolean)
  return exts.length ? exts.join(",") : undefined
}

export function buildDefaultInputDocs(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
  preferred?: DocRef | null,
): InputDocsAssignment {
  return defaultInputDocsForModules(docs, project, inputModules, preferred ?? null)
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
      // AI : union saved picks with default seed docs so new example files (e.g. more students) auto-appear
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
    const docs = docsForInputModule(assignment, m.id)
    if (docs.length) out[m.id] = docs.map((d) => d.id as DocId)
  }
  return out
}

// AI : legacy flat doc list — one id per slot unless explicit by-module map is provided.
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
      out[m.id] = rest.length ? rest : [flatDocIds[i]!]
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


// AI : resolve every input slot for dedup (incl. legacy runs with only inputDocId).
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
