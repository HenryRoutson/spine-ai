// AI : OpenCode/Pi-shaped tool loop for Vibe — write files, run_tests, done. RAM workspace; OpenRouter stays server-side.
import { z } from "zod"
import { llmStructured } from "./llm"
import type { UsageLedger } from "./usage"
import type { AssistantTestDocCatalogEntry } from "./assistant-prompt"
import type { ModelId, Project } from "./types"
import {
  VIBE_HARNESS_MAX_FILE_CHARS,
  VIBE_HARNESS_MAX_FILES,
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

const HARNESS_TOOLS = ["list_dir", "read_file", "write_file", "delete_file", "run_tests", "done"] as const
type HarnessToolName = (typeof HARNESS_TOOLS)[number]

const harnessToolCallSchema = z.object({
  tool: z.enum(HARNESS_TOOLS),
  path: z.string().optional(),
  content: z.string().optional(),
  message: z.string().optional(),
})

export const vibeHarnessTurnSchema = z.object({
  tools: z
    .array(harnessToolCallSchema)
    .max(4)
    .describe("1–4 tools this turn. Empty tools = done."),
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

function buildHarnessSystemPrompt(): string {
  return `You are a coding agent editing a Spine project in an in-memory file workspace (same loop as OpenCode / Pi: read, write, test, repeat).

Tools: list_dir, read_file, write_file, delete_file, run_tests, done.
- No shell, no network, no package installs. run_tests is local validate + custom-code syntax + graph lint.
- Workspace is RAM on this server. OpenRouter stays server-side. Never ask for API keys or write secrets.
- AGENTS.md and examples/few-shot.md are read-only.
- After writes, run_tests. Put the user-facing proposal in message.md (future tense — Approve still required).
- Call done when VALIDATION.md is clean, or when you only needed to answer a question (no file changes).
Return JSON { tools: [...], note?: string }. Empty tools means done.`
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
  return `Turn ${args.turn + 1}/${VIBE_HARNESS_MAX_TURNS}
Task: ${args.task}
${thinking}${args.extra}
Last tool results:
${args.lastResults || "(none yet — read AGENTS.md, project.json, pipeline.json first)"}
`
}

export function vibeHarnessEnabled(): boolean {
  if (process.env.SPINE_VIBE_HARNESS === "0") return false
  if (process.env.LLM_PROVIDER === "seed") return false
  return true
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
  let llmAttempt = 0
  let done = false
  let doneMessage = ""
  let turns = 0

  for (let turn = 0; turn < VIBE_HARNESS_MAX_TURNS && !done; turn++) {
    turns = turn + 1
    const plan = await llmStructured(
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
        maxTokens: 1024,
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
    llmAttempt += 1
    args.onTurn?.(`harness-${turns}`, plan)
    const calls = [...plan.tools].sort((a, b) => toolOrder(a.tool) - toolOrder(b.tool))
    if (!calls.length) {
      done = true
      break
    }
    const results: string[] = []
    for (const call of calls) {
      const result = executeVibeHarnessTool(call, workspace, args.runChecks)
      results.push(`$ ${call.tool}${call.path ? ` ${call.path}` : ""}\n${result}`)
      if (call.tool === "done") {
        done = true
        doneMessage = call.message?.trim() || doneMessage
      }
    }
    lastResults = results.join("\n\n")
  }

  const draft = parseVibeWorkspaceFiles(workspace.files, workspace.seed)
  const message = (draft.message || doneMessage).trim()
  return { draft: { ...draft, message }, turns, done, message }
}
