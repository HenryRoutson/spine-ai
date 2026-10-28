// AI : Phase 4 — read-only observe tools for the assistant (get_run / cache / server logs).

import {
  formatExampleSelectDesignTimeCacheSnippet,
  formatRunStepPromptCacheSnippet,
  summarizeRunForAssistant,
  type AssistantRunSummary,
} from "@/lib/assistant-observe"
import { runErrorLogText } from "@/lib/run-error-log"
import { JobLogLevel, type JobLogEntry } from "@/lib/run-types"
import { truncateUiContextText, type UiContextRef } from "@/lib/ui-context-types"
import { z } from "zod"
import { ModuleKind, type Project, type ProjectId } from "./types"
import type { Store } from "./store"

export const OBSERVE_TOOL_NAMES = [
  "get_run",
  "get_step_prompt_cache",
  "list_server_logs",
] as const

export type ObserveToolName = (typeof OBSERVE_TOOL_NAMES)[number]

const LOG_LEVELS = [
  JobLogLevel.Debug,
  JobLogLevel.Info,
  JobLogLevel.Warn,
  JobLogLevel.Error,
] as const

export const observeToolCallSchema = z.object({
  tool: z.enum(OBSERVE_TOOL_NAMES),
  runId: z
    .string()
    .optional()
    .describe("Run id from recent runs, last failed, or @Runs pins"),
  stepLabel: z
    .string()
    .optional()
    .describe("Pipeline step label for cache or logs"),
  moduleId: z.string().optional().describe("Pipeline module id when known"),
  maxLines: z.number().int().min(1).max(80).optional(),
  levels: z
    .array(z.enum(LOG_LEVELS))
    .optional()
    .describe("Log levels for list_server_logs (default warn+error)"),
})

export const observeToolPlanSchema = z.object({
  tools: z
    .array(observeToolCallSchema)
    .max(3)
    .describe("Up to 3 read-only tool calls; empty if summaries/pins already suffice"),
  reason: z.string().optional(),
})

export type ObserveToolCall = z.infer<typeof observeToolCallSchema>
export type ObserveToolPlan = z.infer<typeof observeToolPlanSchema>

export type ObserveToolResult = {
  tool: ObserveToolName
  ok: boolean
  result: string
}

export const MAX_OBSERVE_TOOL_RESULT_CHARS = 2_500
export const MAX_OBSERVE_TOOLS_BLOCK_CHARS = 7_500

const DEFAULT_LOG_LEVELS: ReadonlySet<JobLogLevel> = new Set([
  JobLogLevel.Warn,
  JobLogLevel.Error,
])

function findProjectRun(store: Store, projectId: ProjectId, runId: string) {
  const id = runId.trim()
  if (!id) return undefined
  return store.runs(projectId).find((r) => r.id === id || r.id.startsWith(id))
}

function resolveModule(
  project: Project,
  call: ObserveToolCall,
): { id: string; label: string; kind: ModuleKind; prompt?: string } | null {
  if (call.moduleId?.trim()) {
    const m = project.modules.find((x) => x.id === call.moduleId!.trim())
    if (m) return m
  }
  const label = call.stepLabel?.trim().toLowerCase()
  if (!label) return null
  const m = project.modules.find((x) => x.label.trim().toLowerCase() === label)
  return m ?? null
}

function formatLogLine(entry: JobLogEntry): string {
  const when = new Date(entry.at).toISOString()
  const mod = entry.moduleId ? ` [${entry.moduleId.slice(0, 8)}]` : ""
  return `${when} ${entry.level} ${entry.tag}${mod}: ${entry.line}`
}

function toolGetRun(store: Store, project: Project, call: ObserveToolCall): string {
  const runId = call.runId?.trim()
  if (!runId) return "get_run requires runId"
  const run = findProjectRun(store, project.id, runId)
  if (!run) return `run not found: ${runId}`
  const summary = summarizeRunForAssistant(run)
  const steps = run.steps.map((s) => ({
    label: s.label,
    kind: s.kind,
    status: s.status,
    moduleId: s.moduleId,
    ms: s.ms,
    failures: s.failures?.length
      ? s.failures.map((f) => ({
          kind: f.kind,
          detail: String(f.detail ?? "").slice(0, 400),
          recovered: f.recovered,
        }))
      : undefined,
  }))
  const errorLog = truncateUiContextText(
    runErrorLogText(run, { includePipeline: false }),
    1_600,
  )
  return truncateUiContextText(
    JSON.stringify({ summary, steps, errorLog }, null, 2),
    MAX_OBSERVE_TOOL_RESULT_CHARS,
  )
}

function toolGetStepPromptCache(
  store: Store,
  project: Project,
  call: ObserveToolCall,
): string {
  const mod = resolveModule(project, call)
  if (call.runId?.trim()) {
    const run = findProjectRun(store, project.id, call.runId)
    if (!run) return `run not found: ${call.runId}`
    const step =
      (mod && run.steps.find((s) => s.moduleId === mod.id)) ||
      (call.stepLabel?.trim()
        ? run.steps.find(
            (s) => s.label.trim().toLowerCase() === call.stepLabel!.trim().toLowerCase(),
          )
        : undefined)
    if (!step) {
      return `step not found on run ${run.id} (need stepLabel or moduleId)`
    }
    return truncateUiContextText(
      formatRunStepPromptCacheSnippet(step),
      MAX_OBSERVE_TOOL_RESULT_CHARS,
    )
  }
  if (!mod) return "get_step_prompt_cache requires stepLabel/moduleId (and runId for runtime cache)"
  if (mod.kind === ModuleKind.ExampleSelect && mod.prompt?.trim()) {
    return truncateUiContextText(
      formatExampleSelectDesignTimeCacheSnippet(mod.label, mod.prompt),
      MAX_OBSERVE_TOOL_RESULT_CHARS,
    )
  }
  if (mod.prompt?.trim()) {
    return truncateUiContextText(
      `Prompt template · ${mod.label} (${mod.kind}) — no multi-candidate cache yet:\n${mod.prompt}`,
      MAX_OBSERVE_TOOL_RESULT_CHARS,
    )
  }
  return `no prompt/cache data for step ${mod.label}`
}

function toolListServerLogs(
  store: Store,
  project: Project,
  call: ObserveToolCall,
): string {
  const runId = call.runId?.trim()
  if (!runId) return "list_server_logs requires runId"
  const run = findProjectRun(store, project.id, runId)
  if (!run) return `run not found: ${runId}`
  const mod = resolveModule(project, call)
  const levels = new Set<JobLogLevel>(
    call.levels?.length ? call.levels : [...DEFAULT_LOG_LEVELS],
  )
  const maxLines = call.maxLines ?? 40
  const entries: JobLogEntry[] = []
  for (const step of run.steps) {
    if (mod && step.moduleId !== mod.id) continue
    for (const entry of step.serverLogs ?? []) {
      if (!levels.has(entry.level)) continue
      entries.push(entry)
    }
  }
  entries.sort((a, b) => a.at - b.at)
  const sliced = entries.slice(-maxLines)
  if (!sliced.length) {
    return `no matching serverLogs on run ${run.id}${mod ? ` step ${mod.label}` : ""} (levels=${[...levels].join(",")})`
  }
  const header = `serverLogs run=${run.id}${mod ? ` step=${mod.label}` : ""} showing ${sliced.length}/${entries.length}`
  return truncateUiContextText(
    [header, ...sliced.map(formatLogLine)].join("\n"),
    MAX_OBSERVE_TOOL_RESULT_CHARS,
  )
}

export function executeObserveTool(
  store: Store,
  project: Project,
  call: ObserveToolCall,
): ObserveToolResult {
  try {
    let result: string
    switch (call.tool) {
      case "get_run":
        result = toolGetRun(store, project, call)
        break
      case "get_step_prompt_cache":
        result = toolGetStepPromptCache(store, project, call)
        break
      case "list_server_logs":
        result = toolListServerLogs(store, project, call)
        break
      default:
        result = `unknown tool`
    }
    const ok = !result.startsWith("run not found") && !result.includes("requires ")
    return { tool: call.tool, ok, result }
  } catch (err) {
    return {
      tool: call.tool,
      ok: false,
      result: (err as Error).message || "observe tool failed",
    }
  }
}

export function executeObserveTools(
  store: Store,
  project: Project,
  calls: ObserveToolCall[],
): ObserveToolResult[] {
  return calls.slice(0, 3).map((c) => executeObserveTool(store, project, c))
}

export function buildObserveToolResultsPromptBlock(results: ObserveToolResult[]): string {
  if (!results.length) return ""
  const body = results
    .map((r, i) => `### observe tool ${i + 1}: ${r.tool} (${r.ok ? "ok" : "error"})\n${r.result}`)
    .join("\n\n")
  return truncateUiContextText(
    `Observe tool results (read-only; cite these — do not invent logs/cache):\n${body}\n`,
    MAX_OBSERVE_TOOLS_BLOCK_CHARS,
  )
}

export function shouldPlanObserveTools(
  message: string,
  uiContext: UiContextRef[],
): boolean {
  if (uiContext.some((r) => r.kind === "run_error" || r.kind === "prompt_cache")) return true
  const m = message.toLowerCase()
  return /\b(run|log|cache|prefix|fail|error|debug|verdict|latency|server.?log|what.?went.?wrong|why.*(fail|break|error))\b/.test(
    m,
  )
}

export function buildObservePlanUserPrompt(args: {
  message: string
  thinking?: string
  recentRuns?: AssistantRunSummary[]
  lastFailedRun?: AssistantRunSummary | null
  uiContext?: UiContextRef[]
}): string {
  const runs = args.recentRuns?.length
    ? JSON.stringify(args.recentRuns, null, 2)
    : "[]"
  const failed = args.lastFailedRun
    ? JSON.stringify(args.lastFailedRun, null, 2)
    : "null"
  const pins =
    args.uiContext
      ?.map((r) => `- ${r.kind} ${r.id}${r.label ? ` (${r.label})` : ""}`)
      .join("\n") || "(none)"
  const thinking = args.thinking?.trim()
    ? `\nPrior reasoning:\n${args.thinking.trim().slice(0, 1_500)}\n`
    : ""
  return `Plan READ-ONLY observe tool calls for the pipeline assistant (max 3). Return tools: [] when recent-run summaries and @ pins already suffice.

Tools:
- get_run(runId): run summary + error log + per-step statuses
- get_step_prompt_cache(stepLabel|moduleId, runId?): design-time example-select regions or runtime step prompt-cache
- list_server_logs(runId, stepLabel?, levels?, maxLines?): persisted per-step serverLogs (default warn+error)

Recent runs:
${runs}

Last failed run:
${failed}

UI context pins:
${pins}
${thinking}
User request: ${args.message.trim()}`
}

export function buildObservePlanSystemPrompt(): string {
  return `You select optional read-only observe tools. Never invent run ids — only use ids from recent runs, last failed, or UI pins. Prefer fewer tools. Empty tools is fine.`
}
