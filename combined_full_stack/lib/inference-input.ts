import { docsForProject } from "@/lib/project-docs"
import { INPUT_TYPES, type DocId, type DocRef, type InputType, type InputTypeSpec, type ModuleId, type PipelineModule, type PipelineRun, type Project } from "@/lib/types"

export function inputTypesForModule(inputModule: PipelineModule): InputType[] {
  if (!inputModule.inputType) return []
  return Array.isArray(inputModule.inputType) ? inputModule.inputType : [inputModule.inputType]
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

export function defaultDocForInputModule(
  docs: DocRef[],
  project: Project,
  inputModule: PipelineModule,
  preferred?: DocRef | null,
  excludeIds: ReadonlySet<DocRef["id"]> = new Set(),
): DocRef | undefined {
  const passable = passableDocsForInputModule(docs, project, inputModule).filter((d) => !excludeIds.has(d.id))
  if (preferred && passable.some((d) => d.id === preferred.id)) return preferred
  return passable[0]
}

// AI : one doc per input slot — name/type restrictions + no reuse across multi-input pipelines.
export function defaultInputDocsForModules(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
  preferred?: DocRef | null,
): Partial<Record<PipelineModule["id"], DocRef>> {
  const out: Partial<Record<PipelineModule["id"], DocRef>> = {}
  const used = new Set<DocRef["id"]>()
  for (const m of inputModules) {
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
): Partial<Record<ModuleId, DocRef>> {
  return defaultInputDocsForModules(docs, project, inputModules, preferred ?? null)
}

export function resolveInputDocs(
  docs: DocRef[],
  project: Project,
  inputModules: PipelineModule[],
  savedDocIds: Partial<Record<ModuleId, DocId>>,
  preferred?: DocRef | null,
): Partial<Record<ModuleId, DocRef>> {
  const defaults = buildDefaultInputDocs(docs, project, inputModules, preferred)
  if (!Object.keys(savedDocIds).length) return defaults
  const out: Partial<Record<ModuleId, DocRef>> = { ...defaults }
  for (const m of inputModules) {
    const savedId = savedDocIds[m.id]
    if (!savedId) continue
    const doc = docs.find((d) => d.id === savedId)
    if (doc && docMatchesInputModule(doc, m)) out[m.id] = doc
  }
  return out
}

export function inputDocIdsForModules(
  inputModules: PipelineModule[],
  inputDocs: Partial<Record<ModuleId, DocRef>>,
): DocId[] {
  return inputModules.map((m) => inputDocs[m.id]!.id as DocId)
}


// AI : resolve every input slot for dedup (incl. legacy runs with only inputDocId).
export function buildRunInputDocIds(
  docs: DocRef[],
  project: Project,
  inputDocId: DocId,
  extraInputDocIds: DocId[] = [],
  seedDocNames?: string[],
): DocId[] {
  const inputMods = orderedInputModules(project.modules)
  const explicit = [inputDocId, ...extraInputDocIds].filter(Boolean) as DocId[]
  const names = seedDocNames ?? project.seedDocNames
  const scoped = names?.length ? docs.filter((d) => new Set(names).has(d.name)) : docs
  const inputQueue: DocId[] = []
  const used = new Set<DocId>()
  for (let i = 0; i < inputMods.length; i++) {
    const mod = inputMods[i]
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
