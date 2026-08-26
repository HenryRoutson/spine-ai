// AI : TUI command catalog + suggest — one list drives hotkeys, / palette, and prompt autocomplete.
// AI : TODO (opt-browser-tui-controller) — already host-agnostic; browser terminal mode should import this, not fork it.

import { MODULE_META, type ModuleKind } from "@/lib/types"
import { USER_ADDABLE_MODULE_KINDS, asModuleKind } from "@/lib/module-kinds"
import {
  TUI_TAB_ALIASES,
  TUI_TAB_HOTKEY,
  TUI_TABS,
  type LogsView,
  type PipelineView,
  type TestingView,
  type TuiTab,
  type ValidationView,
} from "@/lib/core/view"
import { isLlmKind } from "@/lib/module-kinds"

export const TUI_SUGGEST_LIMIT = 7

export type TuiCommandId =
  | "new-project"
  | "configure-step"
  | "rename"
  | "add-model"
  | "add-step"
  | "vibe"
  | "apply"
  | "reject"
  | "delete"
  | "run-inference"
  | "run-test"
  | "errors-only"
  | "set-docs"
  | "quit"
  | `tab-${TuiTab}`

export type TuiCommand = {
  id: TuiCommandId
  key: string
  aliases: string[]
  label: string
  hint: string
  needsProject?: boolean
  needsProposal?: boolean
  needsSteps?: boolean
}

export type TuiCommandContext = {
  hasProject: boolean
  hasProposal: boolean
  hasSteps?: boolean
  tab?: TuiTab
  hasRuns?: boolean
  hasTests?: boolean
  validationOk?: boolean
}

export type TuiPane = "projects" | "steps" | "runs" | "tests" | "inputs"

export type StepEditId = "label" | "prompt" | "note" | "structure" | "remove"

export type StepEditAction = {
  id: StepEditId
  label: string
  hint: string
}

export type StepKindSuggest = {
  kind: ModuleKind
  label: string
  hint: string
}

export type TuiPrompt =
  | { kind: "rename"; buffer: string; selected?: number }
  | { kind: "model"; buffer: string; selected?: number }
  | { kind: "delete"; name: string }
  | { kind: "agent"; buffer: string; selected?: number }
  | { kind: "step"; buffer: string; selected?: number }
  | { kind: "pick-step"; buffer: string; selected?: number }
  | { kind: "edit-step"; stepId: string; buffer: string; selected?: number }
  | { kind: "step-field"; stepId: string; field: Exclude<StepEditId, "remove">; buffer: string; selected?: number }
  | { kind: "pick-run"; buffer: string; selected?: number }
  | { kind: "pick-test"; buffer: string; selected?: number }
  | { kind: "docs"; buffer: string; selected?: number }
  | { kind: "command"; buffer: string; selected?: number }
  | null

const ACTION_COMMANDS: TuiCommand[] = [
  { id: "new-project", key: "n", aliases: ["new", "create", "project"], label: "New project", hint: "Start a pipeline" },
  { id: "configure-step", key: "e", aliases: ["edit", "configure", "inspect", "step"], label: "Configure step", hint: "Switch step and edit prompt / structure / note", needsProject: true, needsSteps: true },
  { id: "add-model", key: "m", aliases: ["model", "structure", "schema"], label: "Add model", hint: "Named structure — fixes Input / Output", needsProject: true },
  { id: "add-step", key: "s", aliases: ["step", "llm", "module", "fork", "if-else"], label: "Add step", hint: "Insert llm, fork, if-else, combine, chunk, …", needsProject: true },
  { id: "vibe", key: "a", aliases: ["vibe", "agent", "ask"], label: "Ask vibe", hint: "Describe a change in plain language", needsProject: true },
  { id: "run-inference", key: "i", aliases: ["run", "infer", "inference"], label: "Run inference", hint: "Execute the pipeline — appears in Logging", needsProject: true },
  { id: "run-test", key: "t", aliases: ["test", "testing"], label: "Run test", hint: "Run *_testing.json and record the verdict", needsProject: true },
  { id: "errors-only", key: "f", aliases: ["filter", "errors", "failed"], label: "Toggle errors-only", hint: "Filter Logging to failing runs" },
  { id: "set-docs", key: "w", aliases: ["docs", "readme", "markdown", "write"], label: "Edit docs", hint: "Project markdown prepended to vibe prompts", needsProject: true },
  { id: "rename", key: "r", aliases: ["rename", "name"], label: "Rename project", hint: "Change the selected project name", needsProject: true },
  { id: "apply", key: "y", aliases: ["apply", "accept"], label: "Apply proposal", hint: "Accept the pending vibe diff", needsProposal: true },
  { id: "reject", key: "d", aliases: ["reject", "dismiss"], label: "Reject proposal", hint: "Drop the pending vibe diff", needsProposal: true },
  { id: "delete", key: "x", aliases: ["delete", "remove"], label: "Delete project", hint: "Remove the selected project", needsProject: true },
  { id: "quit", key: "q", aliases: ["quit", "exit"], label: "Quit", hint: "Leave the TUI" },
]

const TAB_COMMANDS: TuiCommand[] = TUI_TABS.map((tab) => ({
  id: `tab-${tab}` as const,
  key: TUI_TAB_HOTKEY[tab],
  aliases: [tab, ...Object.entries(TUI_TAB_ALIASES).flatMap(([alias, mapped]) => (mapped === tab ? [alias] : []))],
  label: `Go to ${tab}`,
  hint: `Switch tab`,
}))

export const TUI_COMMANDS: TuiCommand[] = [...ACTION_COMMANDS, ...TAB_COMMANDS]

// AI : TODO (gui-parity) — TUI still lacks vs GUI:
// AI :   structure/testing/diagnosis agents (CLI has spine agent structure|testing|diagnose)
// AI :   kind-specific step fields (webhook URL, parallel branches, chatbot mode, cache, model-per-step)
// AI :   rich structure editing (field types/examples, Excel derive, type aliases)
// AI :   share/marketplace mint, billing checkout, teams, human-review pause, Node custom-code host
// AI :   binary doc upload/remove, inference *_setup.json, run cancel, logging compare/hydrate
// AI : parametric types: structure view prints Report[T]; author params in GUI/JSON/assistant, not Ink.

export const EXAMPLE_MODEL_NAMES = ["Receipt", "Invoice", "Contract", "Finding"] as const

function haystack(cmd: TuiCommand): string {
  return `${cmd.key} ${cmd.label} ${cmd.aliases.join(" ")}`.toLowerCase()
}

export function commandAvailable(cmd: TuiCommand, ctx: TuiCommandContext): boolean {
  if (cmd.needsProject && !ctx.hasProject) return false
  if (cmd.needsProposal && !ctx.hasProposal) return false
  if (cmd.needsSteps && !ctx.hasSteps) return false
  return true
}

export function suggestCommands(query: string, ctx: TuiCommandContext, boostId?: TuiCommandId | null): TuiCommand[] {
  const q = query.trim().toLowerCase()
  const matched = q ? TUI_COMMANDS.filter((cmd) => haystack(cmd).includes(q)) : TUI_COMMANDS
  const available = matched.filter((cmd) => commandAvailable(cmd, ctx))
  const rest = matched.filter((cmd) => !commandAvailable(cmd, ctx))
  const ranked =
    !q && boostId
      ? [...available.filter((cmd) => cmd.id === boostId), ...available.filter((cmd) => cmd.id !== boostId), ...rest]
      : [...available, ...rest]
  return ranked.slice(0, TUI_SUGGEST_LIMIT)
}

export function suggestStepKinds(query: string): StepKindSuggest[] {
  const q = query.trim().toLowerCase()
  const rows: StepKindSuggest[] = USER_ADDABLE_MODULE_KINDS.map((kind) => ({
    kind: asModuleKind(kind),
    label: MODULE_META[asModuleKind(kind)].label,
    hint: MODULE_META[asModuleKind(kind)].description,
  }))
  const matched = q
    ? rows.filter((row) => `${row.kind} ${row.label} ${row.hint}`.toLowerCase().includes(q))
    : rows
  return matched.slice(0, TUI_SUGGEST_LIMIT)
}

export function suggestAgentPrompts(query: string, validation: ValidationView): string[] {
  const fromIssues = validation.issues.slice(0, 3).map((issue) => `Fix: ${issue.message}`)
  const canned = [
    "Add a Receipt model with vendor, total, and date",
    "Add an LLM step that extracts those fields from the document",
    "Wire Input and Output to the new structure",
  ]
  const all = [...fromIssues, ...canned]
  const q = query.trim().toLowerCase()
  return (q ? all.filter((line) => line.toLowerCase().includes(q)) : all).slice(0, TUI_SUGGEST_LIMIT)
}

export function suggestModelNames(query: string): string[] {
  const q = query.trim().toLowerCase()
  const matched = q ? EXAMPLE_MODEL_NAMES.filter((name) => name.toLowerCase().includes(q)) : [...EXAMPLE_MODEL_NAMES]
  return matched
}

export function suggestedCommandId(ctx: TuiCommandContext & { projectCount: number; validation: ValidationView }): TuiCommandId | null {
  if (ctx.projectCount === 0) return "new-project"
  if (ctx.hasProposal) return "apply"
  if (ctx.tab === "logging" && !ctx.hasRuns) return "run-inference"
  if (ctx.tab === "testing" && ctx.hasTests) return "run-test"
  if (ctx.tab === "inference" && ctx.validation.ok) return "run-inference"
  if (ctx.tab === "docs") return "set-docs"
  if (ctx.hasSteps && ctx.validation.issues.length) return "configure-step"
  const msg = ctx.validation.issues[0]?.message
  if (msg && /output model|structure to materialize/i.test(msg)) return "add-model"
  if (ctx.tab === "structure" && /structure|model/i.test(msg ?? "")) return "add-model"
  return null
}

export function nextActionHint(ctx: TuiCommandContext & { projectCount: number; validation: ValidationView }): string {
  const id = suggestedCommandId(ctx)
  const msg = ctx.validation.issues[0]?.message
  if (id === "new-project") return "next: create a project — press n, or type / new"
  if (id === "apply") return "next: apply the vibe proposal — press y, or / apply"
  if (id === "run-inference") {
    if (ctx.tab === "logging") return "next: run inference — press i  (then watch the trace here)"
    return "next: run the pipeline — press i  (results land in Logging)"
  }
  if (id === "run-test") return "next: run the selected test — press t"
  if (id === "set-docs") return "next: write project docs — press w, or e on this tab"
  if (id === "configure-step") return `next: configure a step — press e  (${msg})`
  if (id === "add-model") return `next: add a model — press m  (${msg})`
  if (id === "vibe") return `next: ask vibe to fix this — press a  (${msg})`
  if (ctx.tab === "logging") return "↑↓ switch run   e inspect   f errors-only   i run"
  if (ctx.tab === "testing") return "↑↓ switch test   t run   e pick"
  if (ctx.tab === "inference") return "i run pipeline   results appear in Logging (7)"
  return "↑↓ switch step   e configure   / search"
}

export function resolveSelectedStepId(pipeline: PipelineView | null, current: string): string {
  const steps = pipeline?.steps ?? []
  if (current && steps.some((s) => s.id === current)) return current
  return steps.find((s) => s.invalid.length)?.id ?? steps[0]?.id ?? ""
}

export function resolveSelectedRunId(logs: LogsView, current: string, errorsOnly: boolean): string {
  const runs = errorsOnly ? logs.runs.filter((r) => r.hasErrors) : logs.runs
  if (current && runs.some((r) => r.id === current)) return current
  return runs.find((r) => r.hasErrors)?.id ?? runs[0]?.id ?? ""
}

export function resolveSelectedTestName(testing: TestingView, current: string): string {
  const tests = testing.tests
  if (current && tests.some((t) => t.name === current)) return current
  return tests.find((t) => t.verdict === "fail")?.name ?? tests[0]?.name ?? ""
}

export function defaultPaneForTab(tab: TuiTab): TuiPane {
  if (tab === "pipeline") return "steps"
  if (tab === "logging") return "runs"
  if (tab === "testing") return "tests"
  if (tab === "inference") return "inputs"
  return "projects"
}

export function suggestPipelineSteps(query: string, pipeline: PipelineView | null): PipelineView["steps"] {
  const steps = pipeline?.steps ?? []
  const q = query.trim().toLowerCase()
  const matched = q ? steps.filter((s) => `${s.label} ${s.kind} ${s.invalid.join(" ")}`.toLowerCase().includes(q)) : steps
  return matched.slice(0, TUI_SUGGEST_LIMIT)
}

export function suggestLogRuns(query: string, logs: LogsView, errorsOnly: boolean): LogsView["runs"] {
  const runs = errorsOnly ? logs.runs.filter((r) => r.hasErrors) : logs.runs
  const q = query.trim().toLowerCase()
  const matched = q
    ? runs.filter((r) => `${r.id} ${r.status} ${r.inputLabel} ${r.notes ?? ""} ${r.testDoc ?? ""} ${r.errorSummary ?? ""}`.toLowerCase().includes(q))
    : runs
  return matched.slice(0, TUI_SUGGEST_LIMIT)
}

export function suggestTests(query: string, testing: TestingView): TestingView["tests"] {
  const q = query.trim().toLowerCase()
  const matched = q ? testing.tests.filter((t) => `${t.name} ${t.verdict}`.toLowerCase().includes(q)) : testing.tests
  return matched.slice(0, TUI_SUGGEST_LIMIT)
}

export function suggestStepEdits(
  query: string,
  opts: {
    kind: string
    label: string
    prompt?: string
    note?: string
    modelName?: string
    invalid: string[]
    modelCount: number
  },
): StepEditAction[] {
  const rows: StepEditAction[] = [
    {
      id: "structure",
      label: "Assign structure",
      hint: opts.modelName ? `now ${opts.modelName}` : opts.modelCount ? "pick a model for this step" : "add a model first (m)",
    },
    { id: "prompt", label: "Set prompt", hint: opts.prompt?.slice(0, 48) || "empty" },
    { id: "note", label: "Set note", hint: opts.note || "purpose / annotation" },
    { id: "label", label: "Rename step", hint: opts.label },
    { id: "remove", label: "Remove step", hint: `delete ${opts.label}` },
  ]
  const kinded = isLlmKind(opts.kind as ModuleKind) ? rows : rows.filter((row) => row.id !== "prompt")
  const boost: StepEditId | null = opts.invalid.some((line) => /structure|output model|materialize/i.test(line))
    ? "structure"
    : isLlmKind(opts.kind as ModuleKind) && !opts.prompt
      ? "prompt"
      : null
  const ranked = boost
    ? [...kinded.filter((row) => row.id === boost), ...kinded.filter((row) => row.id !== boost)]
    : kinded
  const q = query.trim().toLowerCase()
  return (q ? ranked.filter((row) => `${row.id} ${row.label} ${row.hint}`.toLowerCase().includes(q)) : ranked).slice(
    0,
    TUI_SUGGEST_LIMIT,
  )
}

export function suggestModelAssign(query: string, names: string[]): string[] {
  const q = query.trim().toLowerCase()
  return (q ? names.filter((name) => name.toLowerCase().includes(q)) : names).slice(0, TUI_SUGGEST_LIMIT)
}

export function wrapIndex(index: number, length: number, delta: number): number {
  if (length <= 0) return 0
  return (index + delta + length * 8) % length
}

export function selectedIndex(prompt: { selected?: number } | null | undefined, length: number): number {
  if (length <= 0) return 0
  return Math.min(prompt?.selected ?? 0, length - 1)
}

export function tabFromCommandId(id: TuiCommandId): TuiTab | undefined {
  if (!id.startsWith("tab-")) return undefined
  const tab = id.slice(4)
  return (TUI_TABS as readonly string[]).includes(tab) ? (tab as TuiTab) : undefined
}
