// AI : agent observe helpers — run summaries, error pin text, prompt-cache snippets (Phase 0/1).

import {
  exampleSelectDesignTimeCacheRegions,
  exampleSelectSampleCandidatePrompts,
} from "@/lib/example-select-prompt-preview"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import {
  analyzePromptCacheRegions,
  formatPromptCacheRatio,
  promptTextsFromItems,
} from "@/lib/prompt-cache-regions"
import { runErrorLogText, runHasErrors } from "@/lib/run-error-log"
import { formatRunErrorForDisplay } from "@/lib/run-errors"
import { ModuleKind, type PipelineModule, type PipelineRun, type RunStep } from "@/lib/types"
import { truncateUiContextText, MAX_UI_CONTEXT_SNIPPET_CHARS } from "@/lib/ui-context-types"

export const MAX_RECENT_RUNS_FOR_ASSISTANT = 5
export const MAX_PROMPT_CACHE_PREFIX_CHARS = 400

export type AssistantRunSummary = {
  id: string
  status: string
  source?: string
  startedAt: number
  totalMs: number
  billedCents: number
  hasErrors: boolean
  errorTitle?: string
  errorMessage?: string
}

export function runIdFromUiContextId(id: string): string | null {
  if (id.startsWith("run:")) return id.slice(4) || null
  if (id.startsWith("run-error:")) return id.slice(10) || null
  return id.trim() || null
}

export function summarizeRunForAssistant(run: PipelineRun): AssistantRunSummary {
  const display = formatRunErrorForDisplay(run)
  return {
    id: run.id,
    status: run.status,
    source: run.source,
    startedAt: run.startedAt,
    totalMs: run.totalMs,
    billedCents: run.billedCents,
    hasErrors: runHasErrors(run),
    errorTitle: display?.title,
    errorMessage: display?.message,
  }
}

export function recentRunsForAssistant(
  runs: PipelineRun[],
  _projectId?: string,
  limit = MAX_RECENT_RUNS_FOR_ASSISTANT,
): AssistantRunSummary[] {
  // AI : caller passes project-scoped runs (store.runs(projectId) or client store.runs).
  return runs
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit)
    .map(summarizeRunForAssistant)
}

export function lastFailedRunForAssistant(
  runs: PipelineRun[],
  _projectId?: string,
): AssistantRunSummary | null {
  const failed = runs
    .filter((r) => runHasErrors(r))
    .sort((a, b) => b.startedAt - a.startedAt)[0]
  return failed ? summarizeRunForAssistant(failed) : null
}

export function buildRecentRunsSummaryPromptBlock(runs: AssistantRunSummary[]): string {
  if (!runs.length) {
    return `Recent runs (0):
[]
`
  }
  return `Recent runs (${runs.length}) — summaries only; @ a run or pin Logging/Inference for full error logs:
${JSON.stringify(runs, null, 2)}
`
}

export function buildLastFailedRunPromptBlock(run: AssistantRunSummary | null): string {
  if (!run) return ""
  return `Last failed run (auto — Vibe/Logging may be unmounted; @run:${run.id} for enriched logs):
${JSON.stringify(run, null, 2)}
`
}

export function formatRunErrorPinSnippet(run: PipelineRun): string {
  return truncateUiContextText(
    runErrorLogText(run, { includePipeline: false }),
    MAX_UI_CONTEXT_SNIPPET_CHARS,
  )
}

export function formatPromptCacheRegionsSnippet(
  label: string,
  prompts: readonly string[],
  sharedPrefixSample?: string,
): string {
  const regions = analyzePromptCacheRegions(prompts)
  const lines: string[] = [`Prompt cache · ${label}`]
  if (!regions) {
    lines.push(prompts.length <= 1 ? "single prompt — no shared prefix to measure" : "no cache regions")
  } else {
    lines.push(
      `candidates=${regions.candidateCount}`,
      `shared=${formatPromptCacheRatio(regions.sharedRatio)} (${regions.prefixChars} chars)`,
      `suffix=${regions.suffixCharsMin}–${regions.suffixCharsMax} chars`,
    )
  }
  const sample =
    sharedPrefixSample ??
    (regions && regions.prefixLen > 0 ? (prompts[0] ?? "").slice(0, regions.prefixLen) : "")
  if (sample.trim()) {
    lines.push("")
    lines.push("── Shared prefix (truncated) ──")
    lines.push(sample.trim().slice(0, MAX_PROMPT_CACHE_PREFIX_CHARS))
  }
  return truncateUiContextText(lines.join("\n"), MAX_UI_CONTEXT_SNIPPET_CHARS)
}

export function formatExampleSelectDesignTimeCacheSnippet(
  stepLabel: string,
  promptTemplate: string,
): string {
  const samples = exampleSelectSampleCandidatePrompts(promptTemplate)
  const regions = exampleSelectDesignTimeCacheRegions(promptTemplate)
  const prefix =
    regions && regions.prefixLen > 0 ? (samples[0] ?? "").slice(0, regions.prefixLen) : ""
  return formatPromptCacheRegionsSnippet(
    `${stepLabel} (design-time example-select)`,
    samples,
    prefix,
  )
}

export function formatRunStepPromptCacheSnippet(step: RunStep): string {
  const texts = promptTextsFromItems(step.inputPreview, step.inputPreviewItems)
  return formatPromptCacheRegionsSnippet(`${step.label} (${step.kind})`, texts)
}

export function modulesWithPromptCache(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter(
    (m) =>
      m.kind === ModuleKind.ExampleSelect ||
      m.kind === ModuleKind.Llm ||
      m.kind === ModuleKind.LlmBatch,
  )
}

export function runMentionLabel(run: PipelineRun): string {
  const when = new Date(run.startedAt).toLocaleString()
  return `${run.status} · ${formatSecondsShort(run.totalMs)} · ${formatCostCents(run.billedCents)} · ${when}`
}
