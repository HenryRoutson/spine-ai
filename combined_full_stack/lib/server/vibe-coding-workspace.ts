// AI : in-memory file tree for the Vibe coding harness — OpenCode/Pi-shaped, never disk, never secrets.
import { isLockedStructureModel } from "./builtin_models"
import { stripBuiltinTypeAliases, withBuiltinTypeAliases } from "./builtin_types"
import { formatTypeExprPy } from "@/lib/type-expr-parse"
import { fieldToTypeExpr } from "./type_expr"
import {
  buildFewShotPromptBlock,
  structureOutForAssistant,
  type AssistantTestDocCatalogEntry,
} from "./assistant-prompt"
import { isManagedLockedStep } from "./validity-sync"
import { customCodeEntriesForModule } from "@/lib/custom_code_entries"
import { functionsOnProject, activeFunction } from "@/lib/pipeline-functions"
import {
  ChatbotMode,
  DocLabel,
  IfConditionKind,
  InputType,
  ModuleKind,
  type ModelId,
  type PipelineModule,
  type Project,
  type StructureModel,
} from "./types"

export const VIBE_THINKING_MAX_TOKENS = 4096
export const VIBE_HARNESS_MAX_TURNS = 8
export const VIBE_HARNESS_MAX_TOKENS = 8192
export const VIBE_HARNESS_MAX_FILE_CHARS = 48_000
export const VIBE_HARNESS_MAX_FILES = 48
export const VIBE_HARNESS_MAX_TOOLS_PER_TURN = 12

const READONLY_PATHS = new Set(["AGENTS.md", "examples/few-shot.md"])

export type VibeWorkspaceFiles = Map<string, string>

export type VibeWorkspace = {
  files: VibeWorkspaceFiles
  seed: Record<string, string>
}

export type VibeWorkspaceDraft = {
  message: string
  modules: unknown[] | null
  models: unknown[] | null
  typeAliases: unknown[] | null
  docs: Array<{ name: string; type: string; content: string; label?: string }> | null
  documentationUpdate: string | null
  projectNameUpdate: string | null
  targetFunctionName: string | null
  proposedActions: unknown[] | null
  errors: string[]
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function authoringModules(modules: PipelineModule[]): PipelineModule[] {
  return modules
    .filter((m) => !isManagedLockedStep(m))
    .map((m) =>
      m.forkBranches
        ? { ...m, forkBranches: m.forkBranches.map((b) => ({ ...b, modules: authoringModules(b.modules) })) }
        : m,
    )
}

function serializeField(f: StructureModel["fields"][number], models: StructureModel[]) {
  const typeExpr = f.typeExpr ? formatTypeExprPy(fieldToTypeExpr(f), models) : undefined
  return {
    name: f.name,
    type: typeExpr ?? f.type,
    optional: f.optional,
    description: f.description ?? "",
    ...(f.examples?.length ? { examples: f.examples } : {}),
    ...(f.negativeExamples?.length ? { negativeExamples: f.negativeExamples } : {}),
    ...(f.ref ? { ref: models.find((m) => m.id === f.ref)?.name ?? f.ref } : {}),
    ...(typeExpr ? { typeExpr } : {}),
  }
}

function serializeModel(m: StructureModel, models: StructureModel[]) {
  return {
    name: m.name,
    description: m.description ?? "",
    fields: m.fields.map((f) => serializeField(f, models)),
    ...(m.params?.length ? { params: m.params } : {}),
  }
}

function serializeModule(m: PipelineModule, models: StructureModel[]): Record<string, unknown> {
  const spec: Record<string, unknown> = {
    kind: m.kind,
    label: m.label,
  }
  if (m.note?.trim()) spec.note = m.note
  const structureIn = models.find((x) => x.id === m.inStructureId)?.name
  if (structureIn && m.kind !== ModuleKind.Input && m.kind !== ModuleKind.Assemble && m.kind !== ModuleKind.Fork && m.kind !== ModuleKind.IfElse && m.kind !== ModuleKind.Parallel) {
    spec.structureIn = structureIn
  }
  const structureOut = structureOutForAssistant(m, models)
  if (structureOut) spec.structureOut = structureOut
  if (m.kind === ModuleKind.Input && m.inputType) {
    spec.inputType = Array.isArray(m.inputType) ? m.inputType[0] : m.inputType
  }
  if (m.inputNameContains) spec.inputNameContains = m.inputNameContains
  if (m.inputDescription) spec.inputDescription = m.inputDescription
  if (m.inputMinCount && m.inputMinCount > 1) spec.inputMinCount = m.inputMinCount
  if (m.prompt) spec.prompt = m.prompt
  const code = customCodeEntriesForModule(m)[0]?.code ?? m.code
  if (code) spec.code = code
  if (m.model) spec.model = m.model
  if (m.kind === ModuleKind.Assemble && m.assembleBindings) spec.assembleBindings = m.assembleBindings
  if (m.kind === ModuleKind.Chatbot) {
    spec.chatbotMode = m.chatbotMode === ChatbotMode.Single ? "single" : "until-exit"
    if (m.maxTurns) spec.maxTurns = m.maxTurns
  }
  if (m.kind === ModuleKind.Fork) {
    spec.forkJoin = m.forkJoin ?? "product"
    spec.forkBranches = (m.forkBranches ?? []).map((b) => ({
      label: b.label,
      modules: authoringModules(b.modules).map((child) => serializeModule(child, models)),
    }))
  }
  if (m.kind === ModuleKind.IfElse) {
    if (m.ifCondition?.kind === IfConditionKind.Equals) {
      spec.ifCondition = { kind: "equals", path: m.ifCondition.path, value: m.ifCondition.value }
    } else if (m.ifCondition?.path) {
      spec.ifCondition = { kind: "path", path: m.ifCondition.path }
    }
    spec.forkBranches = (m.forkBranches ?? []).map((b) => ({
      label: b.label,
      modules: authoringModules(b.modules).map((child) => serializeModule(child, models)),
    }))
  }
  if (m.kind === ModuleKind.N8n) {
    if (m.n8nNodeType) spec.n8nNodeType = m.n8nNodeType
    if (m.n8nParameters) spec.n8nParameters = m.n8nParameters
    if (m.n8nCode) spec.n8nCode = m.n8nCode
  }
  if (m.kind === ModuleKind.Connect) {
    if (m.connectActionId) spec.connectActionId = m.connectActionId
    if (m.connectParameters) spec.connectParameters = m.connectParameters
  }
  if (m.kind === ModuleKind.Parallel && m.parallelBranches?.length) {
    spec.parallelBranches = m.parallelBranches.map((b) => ({
      field: b.field,
      prompt: b.prompt,
      structureOut: models.find((x) => x.id === b.outStructureId)?.name ?? b.outStructureId,
      ...(b.model ? { model: b.model } : {}),
      ...(b.note ? { note: b.note } : {}),
    }))
  }
  return spec
}

function structureFileName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, "_") || "Model"
  return `structures/${safe}.json`
}

function testFileName(name: string): string {
  const base = name.trim().replace(/^\/+/, "").split("/").pop() ?? "sample.txt"
  return `tests/${base.replace(/[^A-Za-z0-9._-]/g, "_") || "sample.txt"}`
}

function testTypeFromName(name: string): "text" | "json" | "markdown" | "latex" {
  if (name.endsWith(".json")) return "json"
  if (name.endsWith(".md")) return "markdown"
  if (name.endsWith(".tex") || name.endsWith(".latex")) return "latex"
  return "text"
}

export function buildVibeAgentsMarkdown(): string {
  return `# Spine vibe coding workspace

This is a **file workspace**, not a chat dump. Edit files, then \`run_tests\`. The user still has to Approve — write \`message.md\` in present/future tense ("I'll add…").

## Where this runs
- LLM calls go through the **server OpenRouter** path (billed). The workspace is **RAM only** — never disk, never \`process.env\`, never API keys.
- There is **no shell**. You cannot npm/pytest. \`run_tests\` is the harness: parse files → materialize → I/O validate → custom-code syntax check → graph lint.
- After Approve, \`proposed_actions.json\` may request a live \`run_test\` / \`run_inference\` (those hit the engine + LLM).

## Files
- \`pipeline.json\` — FULL modules array for the **target function** (authoring format: names, not ids). Omit auto steps (Convert to text, Parse to structure, Link Quotes).
- \`structures/<Name>.json\` — user pydantic models. Built-ins (Document, QuoteSpan, …) are locked — do not redefine.
- \`aliases.json\` — user type aliases only (not quote_string_t / text_quote_t).
- \`docs.md\` — project Docs tab markdown. Refresh when pipeline/models change.
- \`tests/*\` — synthetic inference docs (text/json/markdown only).
- \`project.json\` — name + functions. Set \`targetFunctionName\` to add/edit a named function without replacing Main.
- \`message.md\` — short user-facing proposal.
- \`proposed_actions.json\` — optional \`[{ "type": "run_test" }]\` or \`run_inference\`.
- \`examples/few-shot.md\` — valid JSON shapes. Read when unsure.
- \`VALIDATION.md\` — last \`run_tests\` output (server-written).

## Spine I/O (this is what usually fails)
- Linear left-to-right. Step N+1 consumes exactly what step N emits (name + single vs list).
- \`structureIn\` is the **item** name (never \`list[...]\`).
- \`structureOut\` for llm-batch / example-select / chunk: item name only (kind already emits a list).
- \`structureOut\` for input / llm / custom-code: write \`list[Name]\` when the step emits a list.
- Blank projects already have Input + Output. Replace that pipeline; do not treat it as finished.
- Input of pdf/word/image/web/text: \`structureOut\` is Document or \`list[Document]\` — never a parsed model.
- Many same-kind files → one input with \`list[Document]\` + llm-batch. Two different kinds → process first, then combine (raw side file immediately before combine) **or** assemble after both are parsed. Never a third upload.
- Independent extracts on one input → fork + product join, not one mega-llm, not parallel.
- custom-code is a **TypeScript arrow** \`(rows) => …\`, never Python. After Link Quotes, quoted fields are \`{ text, quote }\` — use \`.text\`.
- Spreadsheet goals end at \`list[Row]\` → output. Do not fold CSV strings.
- Prompts are not templates — no \`{state.X}\`. Previous JSON is appended at runtime.

## Loop
1. Read \`AGENTS.md\`, \`project.json\`, \`pipeline.json\`.
2. Write structures, then pipeline, then tests, then docs.md / message.md.
3. \`run_tests\`. Fix from \`VALIDATION.md\`. Repeat.
4. \`done\` when checks are clean (or explain remaining issues in message.md).
`
}

export function normalizeVibePath(raw: string): string | null {
  const trimmed = raw.trim().replace(/\\/g, "/")
  if (!trimmed || trimmed.includes("\0")) return null
  if (trimmed.startsWith("/") || trimmed.includes("..") || trimmed.includes(":")) return null
  return trimmed.replace(/^\.\//, "").replace(/\/+$/, "")
}

export function isReadonlyVibePath(path: string): boolean {
  return READONLY_PATHS.has(path) || path.startsWith("examples/")
}

export function isWritableVibePath(path: string): boolean {
  if (isReadonlyVibePath(path)) return false
  if (
    path === "pipeline.json" ||
    path === "project.json" ||
    path === "aliases.json" ||
    path === "docs.md" ||
    path === "message.md" ||
    path === "proposed_actions.json" ||
    path === "VALIDATION.md"
  ) {
    return true
  }
  if (path.startsWith("structures/") && path.endsWith(".json") && !path.slice("structures/".length).includes("/")) {
    return true
  }
  if (path.startsWith("tests/") && !path.slice("tests/".length).includes("/")) {
    return true
  }
  return false
}

export function listVibePaths(files: VibeWorkspaceFiles, prefix = ""): string[] {
  const p = prefix.replace(/\/+$/, "")
  const keys = [...files.keys()].sort()
  if (!p || p === ".") return keys
  return keys.filter((k) => k === p || k.startsWith(`${p}/`))
}

export function seedVibeWorkspace(args: {
  project: Project
  globalModel: ModelId
  testDocsCatalog?: AssistantTestDocCatalogEntry[]
}): VibeWorkspace {
  const { project, globalModel, testDocsCatalog = [] } = args
  const files: VibeWorkspaceFiles = new Map()
  const models = project.models
  const userModels = models.filter((m) => !isLockedStructureModel(m))
  const modules = authoringModules(project.modules)
  const aliases = stripBuiltinTypeAliases(withBuiltinTypeAliases(project.typeAliases ?? []))
  const fns = functionsOnProject(project)
  const active = activeFunction(project)

  files.set("AGENTS.md", buildVibeAgentsMarkdown())
  files.set("examples/few-shot.md", buildFewShotPromptBlock())
  files.set(
    "project.json",
    pretty({
      name: project.name,
      defaultModel: globalModel,
      activeFunction: active.name,
      functions: fns.map((fn) => fn.name),
      targetFunctionName: null,
    }),
  )
  files.set("pipeline.json", pretty(modules.map((m) => serializeModule(m, models))))
  files.set(
    "aliases.json",
    pretty(
      aliases.map((a) => ({
        name: a.name,
        description: a.description,
        expr: formatTypeExprPy(a.expr, models),
        ...(a.params?.length ? { params: a.params } : {}),
      })),
    ),
  )
  files.set("docs.md", project.documentation ?? "")
  files.set("message.md", "")
  for (const model of userModels) {
    files.set(structureFileName(model.name), pretty(serializeModel(model, models)))
  }
  for (const doc of testDocsCatalog) {
    if (
      doc.type === InputType.Pdf ||
      doc.type === InputType.Word ||
      doc.type === InputType.Excel ||
      doc.type === InputType.Image ||
      doc.type === InputType.Audio ||
      doc.type === InputType.Video ||
      doc.type === InputType.Web
    ) {
      continue
    }
    files.set(testFileName(doc.name), doc.preview ?? "")
  }

  const seed: Record<string, string> = {}
  for (const [path, content] of files) {
    if (isWritableVibePath(path) && path !== "VALIDATION.md" && path !== "message.md") {
      seed[path] = content
    }
  }
  return { files, seed }
}

function parseJsonFile(files: VibeWorkspaceFiles, path: string): { ok: true; value: unknown } | { ok: false; error: string } | { ok: true; value: undefined } {
  const raw = files.get(path)
  if (raw === undefined) return { ok: true, value: undefined }
  const trimmed = raw.trim()
  if (!trimmed) return { ok: true, value: undefined }
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown }
  } catch (err) {
    return { ok: false, error: `${path}: ${(err as Error).message}` }
  }
}

function changedFromSeed(files: VibeWorkspaceFiles, seed: Record<string, string>, path: string): boolean {
  return (files.get(path) ?? "") !== (seed[path] ?? "")
}

function structurePaths(files: VibeWorkspaceFiles): string[] {
  return [...files.keys()].filter((p) => p.startsWith("structures/") && p.endsWith(".json")).sort()
}

function testPaths(files: VibeWorkspaceFiles): string[] {
  return [...files.keys()].filter((p) => p.startsWith("tests/") && p !== "tests/").sort()
}

export function parseVibeWorkspaceFiles(files: VibeWorkspaceFiles, seed: Record<string, string>): VibeWorkspaceDraft {
  const errors: string[] = []
  const pipeline = parseJsonFile(files, "pipeline.json")
  if (!pipeline.ok) errors.push(pipeline.error)
  const aliases = parseJsonFile(files, "aliases.json")
  if (!aliases.ok) errors.push(aliases.error)
  const projectMeta = parseJsonFile(files, "project.json")
  if (!projectMeta.ok) errors.push(projectMeta.error)
  const actions = parseJsonFile(files, "proposed_actions.json")
  if (!actions.ok) errors.push(actions.error)

  const models: unknown[] = []
  for (const path of structurePaths(files)) {
    const parsed = parseJsonFile(files, path)
    if (!parsed.ok) {
      errors.push(parsed.error)
      continue
    }
    if (parsed.value !== undefined) models.push(parsed.value)
  }

  const docs: VibeWorkspaceDraft["docs"] = []
  for (const path of testPaths(files)) {
    const name = path.slice("tests/".length)
    const content = files.get(path) ?? ""
    docs.push({
      name,
      type: testTypeFromName(name),
      content,
      label: DocLabel.Inference,
    })
  }

  const meta = projectMeta.ok && projectMeta.value && typeof projectMeta.value === "object"
    ? (projectMeta.value as Record<string, unknown>)
    : {}
  const targetFunctionName =
    typeof meta.targetFunctionName === "string" && meta.targetFunctionName.trim()
      ? meta.targetFunctionName.trim()
      : null
  const projectNameUpdate =
    typeof meta.name === "string" && meta.name.trim() ? meta.name.trim() : null

  const structuresChanged =
    structurePaths(files).some((p) => changedFromSeed(files, seed, p)) ||
    Object.keys(seed).some((p) => p.startsWith("structures/") && !files.has(p))
  const testsChanged =
    testPaths(files).some((p) => changedFromSeed(files, seed, p)) ||
    Object.keys(seed).some((p) => p.startsWith("tests/") && !files.has(p))
  const aliasesChanged = changedFromSeed(files, seed, "aliases.json")
  const pipelineChanged = changedFromSeed(files, seed, "pipeline.json")
  const docsChanged = changedFromSeed(files, seed, "docs.md")
  const nameChanged = changedFromSeed(files, seed, "project.json") && !!projectNameUpdate

  const modules = pipeline.ok && Array.isArray(pipeline.value) ? pipeline.value : null
  const wrappedModules =
    pipeline.ok && pipeline.value && typeof pipeline.value === "object" && !Array.isArray(pipeline.value)
      ? (pipeline.value as { modules?: unknown }).modules
      : null
  const modulesOut = Array.isArray(modules)
    ? modules
    : Array.isArray(wrappedModules)
      ? wrappedModules
      : pipelineChanged
        ? null
        : null

  if (pipelineChanged && modulesOut === null) {
    errors.push("pipeline.json must be a JSON array of steps (or { \"modules\": [...] })")
  }

  return {
    message: (files.get("message.md") ?? "").trim(),
    modules: pipelineChanged ? modulesOut : null,
    models: structuresChanged ? models : null,
    typeAliases: aliasesChanged ? (aliases.ok && Array.isArray(aliases.value) ? aliases.value : []) : null,
    docs: testsChanged ? docs : null,
    documentationUpdate: docsChanged ? (files.get("docs.md") ?? "") : null,
    projectNameUpdate: nameChanged ? projectNameUpdate : null,
    targetFunctionName,
    proposedActions: actions.ok && Array.isArray(actions.value) ? actions.value : null,
    errors,
  }
}
