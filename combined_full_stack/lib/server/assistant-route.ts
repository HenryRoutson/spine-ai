// AI : shared assistant route validation, project lookup, and billing.
// AI : TODO (arch-assistant-billing-http) — extend runBilledProjectAssistant (or sibling) so testing/diagnosis
// AI :   routes don't re-copy gate+record+model parse.

import { NextResponse } from "next/server"
import { ASSISTANT_HISTORY_LIMIT } from "@/lib/assistant-chat-types"
import {
  buildLastFailedRunPromptBlock,
  buildRecentRunsSummaryPromptBlock,
  lastFailedRunForAssistant,
  recentRunsForAssistant,
  type AssistantRunSummary,
} from "@/lib/assistant-observe"
import { docsForProject } from "@/lib/project-docs"
import { apiError, billingResponse } from "./api_context"
import { HTTP, MESSAGE_REQUIRED, unknownProject } from "./api-errors"
import {
  gateAssistantBilling,
  recordAssistantBilling,
  type AssistantUsageError,
} from "./assistant_billing"
import type { ChatTurn } from "./assistant-shared"
import {
  proposeProjectChange,
  type PipelineAssistantOpts,
  type PipelineAssistantResult,
} from "./pipeline_assistant"
import type { AssistantHumanSurface, AssistantTestDocCatalogEntry } from "./assistant-prompt"
import { enrichUiContextRefs } from "./ui_context_enrich"
import { logger } from "./server_logger"
import type { BillingUserKey } from "./billing_account"
import { UnknownModelError, parseRequestModel } from "./model_catalog"
import { ensureModelOptionsFresh } from "./openrouter_models"
import { DEFAULT_MODEL, type ModelId, type Project, ProjectId } from "./types"
import type { Store } from "./store"

const routeLog = logger("assistant-route")

export { ASSISTANT_HISTORY_LIMIT }

// AI : cap prompt size — matches docs/content limit; prevents runaway LLM cost from huge messages.
export const MAX_ASSISTANT_MESSAGE_CHARS = 32_000

export type AssistantRequestBody = {
  projectId: ProjectId
  message: string
  history?: ChatTurn[]
  model?: ModelId
  stream?: boolean
  // AI : optional — Vibe vs Build awareness for prompt only.
  humanSurface?: AssistantHumanSurface
}

const MAX_TEST_DOC_PREVIEW_CHARS = 200

// AI : Testing-tab visibility for the agent (same catalog on Vibe and Build).
function buildTestDocsCatalog(store: Store, project: Project): AssistantTestDocCatalogEntry[] {
  return docsForProject(store.docs(), project).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    label: d.label,
    sizeKb: d.sizeKb,
    preview: (d.preview ?? "").slice(0, MAX_TEST_DOC_PREVIEW_CHARS),
  }))
}

function buildObserveOpts(
  store: Store,
  project: Project,
  humanSurface?: AssistantHumanSurface,
): {
  recentRuns?: AssistantRunSummary[]
  lastFailedRun?: AssistantRunSummary | null
} {
  const recentRuns = recentRunsForAssistant(store.runs(project.id), project.id)
  const lastFailedRun =
    humanSurface === "vibe" ? lastFailedRunForAssistant(store.runs(project.id), project.id) : null
  return { recentRuns, lastFailedRun }
}

export function trimAssistantHistory(history: ChatTurn[]): ChatTurn[] {
  return history.slice(-ASSISTANT_HISTORY_LIMIT)
}

export function requireAssistantMessage(message: string | undefined): NextResponse | null {
  if (!message?.trim()) return apiError(MESSAGE_REQUIRED, HTTP.BAD_REQUEST)
  if (message.length > MAX_ASSISTANT_MESSAGE_CHARS) {
    return apiError(`message too large (max ${MAX_ASSISTANT_MESSAGE_CHARS} chars)`, HTTP.BAD_REQUEST)
  }
  return null
}

export function parseAssistantRequestModel(model: ModelId | undefined): ModelId | NextResponse {
  try {
    return parseRequestModel(model, DEFAULT_MODEL)
  } catch (err) {
    if (err instanceof UnknownModelError) return apiError(err.message, HTTP.BAD_REQUEST)
    throw err
  }
}

export function requireProjectOr404(
  store: Store,
  projectId: ProjectId,
  log: { warn: (msg: string, ctx?: Record<string, unknown>) => void },
): Project | NextResponse {
  const project = store.project(projectId)
  if (!project) {
    log.warn(`unknown project`, { projectId })
    return apiError(unknownProject(projectId), HTTP.NOT_FOUND, "unknown_project", {
      resource: `project:${projectId}`,
      detail:
        "Project missing from store (deleted, never created, or not visible to this user/team).",
    })
  }
  return project
}

export type AssistantSessionResult = PipelineAssistantResult & { billedCents: number }

async function requireAssistantBilling(): Promise<BillingUserKey | NextResponse> {
  try {
    return await gateAssistantBilling()
  } catch (err) {
    return billingResponse(err) ?? apiError((err as Error).message, HTTP.INTERNAL)
  }
}

/** AI : gate balance, run assistant LLMs, bill measured usage + log synthetic run for charts. */
export async function runBilledProjectAssistant(
  store: Store,
  project: Project,
  message: string,
  history: ChatTurn[],
  model: ModelId,
  opts?: PipelineAssistantOpts,
): Promise<AssistantSessionResult | NextResponse> {
  const billingOrErr = await requireAssistantBilling()
  if (billingOrErr instanceof NextResponse) return billingOrErr

  await ensureModelOptionsFresh()

  const startedAt = Date.now()
  const trimmed = message.trim()
  let result: PipelineAssistantResult | null = null
  let caught: unknown
  let billedCents = 0

  // AI : @file / Select UI pins — load doc bytes + live step/model defs before the prompt.
  const observe = buildObserveOpts(store, project, opts?.humanSurface)
  const enrichedOpts: PipelineAssistantOpts = {
    ...opts,
    ...(opts?.uiContext?.length
      ? { uiContext: enrichUiContextRefs(store, project, opts.uiContext) }
      : {}),
    // AI : always attach Testing catalog — Vibe must not lose Build visibility.
    testDocsCatalog: opts?.testDocsCatalog ?? buildTestDocsCatalog(store, project),
    recentRuns: opts?.recentRuns ?? observe.recentRuns,
    lastFailedRun: opts?.lastFailedRun ?? observe.lastFailedRun,
    // AI : Phase 4 observe tools need store inside proposePipelineChange.
    store: opts?.store ?? store,
  }

  try {
    result = await proposeProjectChange(project, trimmed, history, model, enrichedOpts)
  } catch (err) {
    caught = err
  } finally {
    const usageCents =
      result?.usageCents ?? (caught as AssistantUsageError | undefined)?.usageCents ?? 0
    if (usageCents > 0) {
      try {
        billedCents = await recordAssistantBilling(billingOrErr, {
          store,
          projectId: project.id,
          model,
          message: trimmed,
          responseMessage: result?.message ?? (caught as Error | undefined)?.message ?? "",
          usageCents,
          startedAt,
        })
      } catch (billErr) {
        routeLog.warn(`assistant billing failed`, {
          projectId: project.id,
          usageCents,
          error: (billErr as Error).message,
        })
      }
    }
  }

  if (caught) throw caught
  return { ...result!, billedCents }
}
