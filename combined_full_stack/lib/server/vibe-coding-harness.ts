// AI : OpenCode/Pi-shaped tool loop for Vibe — write files, run_tests, done. RAM workspace; OpenRouter stays server-side.
import { z } from "zod"
import { llmStructured } from "./llm"
import type { UsageLedger } from "./usage"
import type { AssistantTestDocCatalogEntry } from "./assistant-prompt"
import type { ModelId, Project } from "./types"
import {
  VIBE_HARNESS_MAX_FILE_CHARS,
  VIBE_HARNESS_MAX_FILES,
  VIBE_HARNESS_MAX_TOKENS,
  VIBE_HARNESS_MAX_TOOLS_PER_TURN,
  VIBE_HARNESS_MAX_TURNS,
  isReadonlyVibePath,
  isWritableVibePath,
  listVibePaths,
  normalizeVibePath,
  parseVibeWorkspaceFiles,
  seedVibeWorkspace,
  type VibeWorkspace,
  type VibeWorkspaceDraft,
} from "./vibe-coding-workspace"
import { buildVibeTopologyPromptBlock } from "./vibe-coding-topology"

// AI : write_file first — generic schema fill uses enum[0]; list_dir-first is why seed scored 0.
const HARNESS_TOOLS = ["write_file", "read_file", "run_tests", "list_dir", "delete_file", "done"] as const
type HarnessToolName = (typeof HARNESS_TOOLS)[number]

const harnessToolCallSchema = z.object({
  tool: z.enum(HARNESS_TOOLS),
  path: z.string().optional(),
  content: z.string().optional(),
  message: z.string().optional(),
})

export const vibeHarnessTurnSchema = z.object({
  tools: z.preprocess(
    (val) => (Array.isArray(val) ? val.slice(0, VIBE_HARNESS_MAX_TOOLS_PER_TURN) : val),
    z
      .array(harnessToolCallSchema)
      .max(VIBE_HARNESS_MAX_TOOLS_PER_TURN)
      .describe("1–12 tools this turn. Prefer write_file. Extra tools are dropped, not rejected. Empty tools is not done unless run_tests already PASSed."),
  ),
  note: z.string().optional().describe("Private scratch; not shown to the user"),
})

export type VibeHarnessTurn = z.infer<typeof vibeHarnessTurnSchema>
export type VibeHarnessToolCall = z.infer<typeof harnessToolCallSchema>

export type VibeHarnessChecksFn = (draft: VibeWorkspaceDraft, workspace: VibeWorkspace) => string

export type VibeHarnessResult = {
  draft: VibeWorkspaceDraft
  turns: number
  done: boolean
  message: string
}

function toolOrder(tool: HarnessToolName): number {
  if (tool === "write_file" || tool === "delete_file") return 0
  if (tool === "run_tests") return 1
  if (tool === "list_dir" || tool === "read_file") return 2
  return 3
}

export function executeVibeHarnessTool(
  call: VibeHarnessToolCall,
  workspace: VibeWorkspace,
  runChecks: VibeHarnessChecksFn,
): string {
  const tool = call.tool
  if (tool === "done") {
    return "done"
  }
  if (tool === "list_dir") {
    const prefix = call.path ? normalizeVibePath(call.path) : ""
    if (call.path && prefix === null) return `error: invalid path ${call.path}`
    const listed = listVibePaths(workspace.files, prefix ?? "")
    return listed.length ? listed.join("\n") : "(empty)"
  }
  if (tool === "read_file") {
    const path = call.path ? normalizeVibePath(call.path) : null
    if (!path) return "error: read_file requires a relative path"
    const content = workspace.files.get(path)
    if (content === undefined) return `error: not found: ${path}`
    return content.length > VIBE_HARNESS_MAX_FILE_CHARS
      ? `${content.slice(0, VIBE_HARNESS_MAX_FILE_CHARS)}\n…truncated`
      : content
  }
  if (tool === "write_file") {
    const path = call.path ? normalizeVibePath(call.path) : null
    if (!path) return "error: write_file requires a relative path"
    if (!isWritableVibePath(path)) {
      return isReadonlyVibePath(path)
        ? `error: ${path} is read-only`
        : `error: cannot write ${path} — allowed: pipeline.json, structures/*.json, tests/*, docs.md, message.md, project.json, aliases.json, proposed_actions.json`
    }
    const content = call.content ?? ""
    if (content.length > VIBE_HARNESS_MAX_FILE_CHARS) {
      return `error: file exceeds ${VIBE_HARNESS_MAX_FILE_CHARS} chars`
    }
    if (!workspace.files.has(path) && workspace.files.size >= VIBE_HARNESS_MAX_FILES) {
      return `error: workspace file cap (${VIBE_HARNESS_MAX_FILES})`
    }
    workspace.files.set(path, content)
    return `wrote ${path} (${content.length} chars)`
  }
  if (tool === "delete_file") {
    const path = call.path ? normalizeVibePath(call.path) : null
    if (!path) return "error: delete_file requires a path"
    if (!isWritableVibePath(path) || path === "pipeline.json" || path === "project.json") {
      return `error: cannot delete ${path}`
    }
    if (!workspace.files.has(path)) return `error: not found: ${path}`
    workspace.files.delete(path)
    return `deleted ${path}`
  }
  if (tool === "run_tests") {
    const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
    const report = runChecks(draft, workspace)
    workspace.files.set("VALIDATION.md", report)
    return report
  }
  return `error: unknown tool ${tool}`
}

export function harnessDraftHasPipelineWork(draft: VibeWorkspaceDraft): boolean {
  if (!Array.isArray(draft.modules) || draft.modules.length === 0) return false
  return draft.modules.some((m) => {
    if (!m || typeof m !== "object") return false
    const kind = String((m as { kind?: unknown }).kind ?? "")
    return kind !== "" && kind !== "input" && kind !== "output"
  })
}

export function isHarnessProposalPass(report: string, draft: VibeWorkspaceDraft): boolean {
  if (!/^PASS\b/m.test(report)) return false
  if (/Q&A only/i.test(report)) return false
  return harnessDraftHasPipelineWork(draft)
}

export function applyHarnessTurn(
  plan: VibeHarnessTurn,
  workspace: VibeWorkspace,
  runChecks: VibeHarnessChecksFn,
): { results: string[]; done: boolean; wrote: boolean } {
  const calls = [...plan.tools]
    .sort((a, b) => toolOrder(a.tool) - toolOrder(b.tool))
    .slice(0, VIBE_HARNESS_MAX_TOOLS_PER_TURN)
  const results: string[] = []
  let done = false
  let wrote = false
  let ranTests = false
  for (const call of calls) {
    const result = executeVibeHarnessTool(call, workspace, runChecks)
    results.push(`$ ${call.tool}${call.path ? ` ${call.path}` : ""}\n${result}`)
    if (call.tool === "write_file" || call.tool === "delete_file") wrote = true
    if (call.tool === "run_tests") ranTests = true
    if (call.tool === "run_tests") {
      const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
      if (isHarnessProposalPass(result, draft)) done = true
    }
    if (call.tool === "done") {
      const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
      const report = workspace.files.get("VALIDATION.md") ?? result
      if (isHarnessProposalPass(report, draft)) done = true
    }
  }
  // AI : always validate after writes — live models often skip run_tests and then look "done".
  if (wrote && !ranTests) {
    const result = executeVibeHarnessTool({ tool: "run_tests" }, workspace, runChecks)
    results.push(`$ run_tests (auto)\n${result}`)
    const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
    if (isHarnessProposalPass(result, draft)) done = true
  }
  return { results, done, wrote }
}

function buildHarnessSystemPrompt(): string {
  return `You are a coding agent editing a Spine project in an in-memory file workspace (OpenCode / Pi loop: write files, run_tests, repeat).

This file loop is ON only when SPINE_VIBE_HARNESS=1. Return JSON { "tools": [...], "note"?: string }.

Tools: write_file, read_file, run_tests, list_dir, delete_file, done.
- No shell, no network, no package installs. run_tests = parse → materialize → I/O validate → custom-code syntax → graph lint.
- Workspace is RAM on this server. Never ask for API keys or write secrets.
- AGENTS.md and examples/few-shot.md are read-only.
- The first user message ALREADY includes AGENTS.md, project.json, and pipeline.json. Do not spend a turn only on list_dir or read_file.
- Blank projects start with Input + Output — REPLACE pipeline.json this turn. Do not leave only those two steps.
- Many same-kind files (receipts, notes, invoices) → one input list[Document] + llm-batch (NOT a single llm).
- Two different doc kinds (policy + company pack) → two inputs, parse each, then assemble or combine (side file immediately before combine).
- Non-JSON inputs (text/pdf/word/image/web): structureOut is Document or list[Document]. Typed rows belong on a later llm/llm-batch.
${buildVibeTopologyPromptBlock()}
- run_tests FAILs topology even when I/O is valid — rebuild the named spine; do not call done.
- Write structures/*.json, pipeline.json, tests/*, docs.md, message.md. Up to 12 tools per turn; more files → next turn.
- message.md is future tense ("I'll add…") — the user still has to Approve.
- After writes, run_tests. Call done only when VALIDATION.md starts with PASS (not Q&A-only).
- Empty tools is ignored unless tests already PASSed a real pipeline.

Example (copy the shape, change names for the task):
{"tools":[
  {"tool":"write_file","path":"structures/Row.json","content":"{\\n  \\"name\\": \\"Row\\",\\n  \\"description\\": \\"One extracted row.\\",\\n  \\"fields\\": [{\\"name\\": \\"text\\", \\"type\\": \\"text\\", \\"optional\\": false, \\"description\\": \\"Value\\"}]\\n}\\n"},
  {"tool":"write_file","path":"pipeline.json","content":"[\\n  {\\"kind\\": \\"input\\", \\"label\\": \\"Files\\", \\"note\\": \\"Upload files.\\", \\"structureOut\\": \\"list[Document]\\", \\"inputType\\": \\"text\\", \\"inputDescription\\": \\"files\\"},\\n  {\\"kind\\": \\"llm-batch\\", \\"label\\": \\"Extract\\", \\"note\\": \\"One row per file.\\", \\"structureIn\\": \\"Document\\", \\"structureOut\\": \\"Row\\", \\"prompt\\": \\"Extract the fields.\\", \\"inputDescription\\": \\"files\\"},\\n  {\\"kind\\": \\"output\\", \\"label\\": \\"Rows\\", \\"structureIn\\": \\"Row\\", \\"structureOut\\": \\"Row\\", \\"inputDescription\\": \\"rows\\"}\\n]\\n"},
  {"tool":"write_file","path":"tests/sample.txt","content":"Acme 12.00\\n"},
  {"tool":"write_file","path":"docs.md","content":"# Extract\\n\\nTurns files into rows.\\n"},
  {"tool":"write_file","path":"message.md","content":"I'll add a pipeline that extracts one row per file.\\n"}
]}`
}

function buildHarnessUserPrompt(args: {
  task: string
  thinking: string
  extra: string
  lastResults: string
  turn: number
}): string {
  const thinking = args.thinking.trim()
    ? `\nPrior reasoning (do not repeat in message.md):\n${args.thinking.trim().slice(0, 6_000)}\n`
    : ""
  const first = args.turn === 0
  return `Turn ${args.turn + 1}/${VIBE_HARNESS_MAX_TURNS}
Task: ${args.task}
${first ? `${buildVibeTopologyPromptBlock()}\n` : ""}${thinking}${args.extra}
${first ? "Write files this turn (do not only list_dir / read_file). Replace the stub Input + Output. Pick TOPOLOGY first." : "Continue from the tool results. If VALIDATION.md is FAIL (including FAIL topology), fix files. If PASS, done. Empty tools is not done."}

${first ? "Workspace (already loaded):" : "Last tool results:"}
${args.lastResults || "(empty workspace)"}
`
}

export function vibeHarnessEnabled(): boolean {
  // AI : strict flag — SPINE_VIBE_HARNESS=1 on, anything else off (including OpenRouter default).
  return process.env.SPINE_VIBE_HARNESS === "1"
}

export async function runVibeCodingHarness(args: {
  project: Project
  task: string
  thinking: string
  extraPrompt: string
  globalModel: ModelId
  ledger: UsageLedger
  testDocsCatalog?: AssistantTestDocCatalogEntry[]
  runChecks: VibeHarnessChecksFn
  onTurn?: (label: string, response: unknown) => void
  onStructuredFailure?: (detail: {
    attempt: number
    failureKind: string
    error: string
  }) => void
}): Promise<VibeHarnessResult> {
  const workspace = seedVibeWorkspace({
    project: args.project,
    globalModel: args.globalModel,
    testDocsCatalog: args.testDocsCatalog,
  })
  let lastResults = [
    `AGENTS.md\n${workspace.files.get("AGENTS.md") ?? ""}`,
    `project.json\n${workspace.files.get("project.json") ?? ""}`,
    `pipeline.json\n${workspace.files.get("pipeline.json") ?? ""}`,
  ].join("\n\n")
  const toolLog: string[] = []
  let llmAttempt = 0
  let done = false
  let doneMessage = ""
  let turns = 0

  for (let turn = 0; turn < VIBE_HARNESS_MAX_TURNS && !done; turn++) {
    turns = turn + 1
    let plan: VibeHarnessTurn
    try {
      plan = await llmStructured(
        buildHarnessUserPrompt({
          task: args.task,
          thinking: args.thinking,
          extra: args.extraPrompt,
          lastResults,
          turn,
        }),
        vibeHarnessTurnSchema,
        {
          model: args.globalModel,
          ledger: args.ledger,
          system: buildHarnessSystemPrompt(),
          maxTokens: VIBE_HARNESS_MAX_TOKENS,
          onStructuredFailure: (detail) => {
            llmAttempt += 1
            args.onStructuredFailure?.({
              attempt: llmAttempt,
              failureKind: detail.kind,
              error: detail.error,
            })
          },
        },
      )
    } catch {
      // AI : keep files from earlier turns — a 429 mid-loop must not discard a partial proposal.
      break
    }
    llmAttempt += 1
    args.onTurn?.(`harness-${turns}`, plan)
    if (!plan.tools.length) {
      const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
      const report = workspace.files.get("VALIDATION.md") ?? ""
      if (isHarnessProposalPass(report, draft) || turn === VIBE_HARNESS_MAX_TURNS - 1) {
        done = true
        break
      }
      lastResults = `${lastResults}\n\nEmpty tools ignored — stub Input is not a finished pipeline. write_file then run_tests.`
      continue
    }
    const applied = applyHarnessTurn(plan, workspace, args.runChecks)
    const doneCall = plan.tools.find((c) => c.tool === "done")
    if (applied.done) {
      done = true
      doneMessage = doneCall?.message?.trim() || doneMessage
    }
    toolLog.push(...applied.results)
    lastResults = [
      `Files: ${listVibePaths(workspace.files).join(", ")}`,
      `pipeline.json\n${workspace.files.get("pipeline.json") ?? "[]"}`,
      `VALIDATION.md\n${workspace.files.get("VALIDATION.md") ?? "(not run)"}`,
      toolLog.slice(-12).join("\n\n"),
    ].join("\n\n")
  }

  const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
  const message = (draft.message || doneMessage).trim()
  return { draft: { ...draft, message }, turns, done, message }
}
