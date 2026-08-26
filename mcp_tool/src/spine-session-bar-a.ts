// AI : MCP Bar A — session file + HTTP, same SpineSession methods as CLI/Vibe (not seed-only).
// AI : Goal is GUI-equivalent *actions*. get_project is a compact review, not a live UI dump.

import { getConnectAction } from "@/lib/connect-catalog"
import { USER_ADDABLE_MODULE_KINDS } from "@/lib/module-kinds"
import { createSpineSession, type SpineSession } from "@/lib/core/session"
import { createApiEgress, createThrowingEgress, SPINE_API_TOKEN_ENV, SPINE_API_URL_ENV } from "@/lib/core/transport"
import { toBillingView, toCacheView, toMcpProjectReview, toSettingsView, toShareView, toValidationView } from "@/lib/core/view"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import { lintPipeline } from "@/lib/server/pipeline_lint"
import {
  addModelField,
  addNamedModel,
  addPipelineStep,
  addTypeAlias,
  assignStepStructure,
  importSeed,
  listSeedIds,
  moveStep,
  parseAddableKind,
  patchStep,
  removeModelField,
  removeStep,
  setModelFieldRelation,
} from "@/lib/cli/workspace_edits"
import {
  pinpointFailureOnProject,
  readRunFromInput,
  type PinpointRunSource,
} from "./spine-pinpoint.js"
import { askAgent } from "@/lib/cli/agent"
import { inspectCatalogDocs } from "@/lib/sql-id-index"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import { filterRunsByErrorStatus } from "@/lib/run-error-log"
import { testReportPassed } from "@/lib/testing-files"
import { exclusionReasonForInputModule, exclusionReasonLabel } from "@/lib/inference-input-picker"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { docsForProject } from "@/lib/project-docs"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import { describeCronExpr, isValidCronExpr, isValidIanaTimeZone } from "@/lib/cron-expr"
import { DEFAULT_EMBED_OPTIONS, DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_HTML, normalizeHostedSiteOptions } from "@/lib/hosted-site"
// AI : import enums from server/types — tsx ESM drops named values through lib/types `export *`.
import { DocLabel, InputType, RunStatus, type PipelineRun, type Project, type RunId } from "@/lib/server/types"

const askAgentJobs = new Map<string, Promise<unknown>>()
const askAgentErrors = new Map<string, string>()

// AI : Claude Code often omits SPINE_API_URL — local Next is this origin.
export const DEFAULT_LOCAL_API_URL = "http://127.0.0.1:3000"

export function resolveMcpApiUrl(): string {
  const configured = process.env[SPINE_API_URL_ENV]?.trim()
  return (configured || DEFAULT_LOCAL_API_URL).replace(/\/$/, "")
}

let cachedApiReachable: { url: string; ok: boolean; at: number } | null = null
let cachedRunsAuthorized: { url: string; hasToken: boolean; ok: boolean; at: number } | null = null

async function probeApi(url: string): Promise<boolean> {
  const now = Date.now()
  if (cachedApiReachable && cachedApiReachable.url === url && now - cachedApiReachable.at < 15_000) {
    return cachedApiReachable.ok
  }
  try {
    await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(250) })
    cachedApiReachable = { url, ok: true, at: now }
    return true
  } catch {
    cachedApiReachable = { url, ok: false, at: now }
    return false
  }
}

async function probeRunsAuthorized(url: string, hasToken: boolean): Promise<boolean> {
  const now = Date.now()
  if (
    cachedRunsAuthorized &&
    cachedRunsAuthorized.url === url &&
    cachedRunsAuthorized.hasToken === hasToken &&
    now - cachedRunsAuthorized.at < 15_000
  ) {
    return cachedRunsAuthorized.ok
  }
  try {
    const headers: Record<string, string> = {}
    const token = process.env[SPINE_API_TOKEN_ENV]?.trim()
    if (token) headers.authorization = `Bearer ${token}`
    const res = await fetch(`${url}/api/runs?limit=1`, {
      method: "GET",
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(800),
    })
    const ok = res.status !== 401 && res.status !== 403
    cachedRunsAuthorized = { url, hasToken, ok, at: now }
    return ok
  } catch {
    cachedRunsAuthorized = { url, hasToken, ok: false, at: now }
    return false
  }
}

// AI : hung Next (listen but no respond) used to stall Claude Code for minutes.
export const MCP_API_TIMEOUT_MS = 8_000

export function openMcpSession(sessionPath?: string, offline = false) {
  const persist = createFilePersist(resolveSessionPath(sessionPath))
  const url = resolveMcpApiUrl()
  const egress = offline
    ? createThrowingEgress()
    : createApiEgress(url, process.env[SPINE_API_TOKEN_ENV], fetch, { timeoutMs: MCP_API_TIMEOUT_MS })
  return createSpineSession({ persist, egress })
}

const DEFAULT_SHARE_SPEND_CENTS = 1000
const DEFAULT_SCHEDULE_CRON = "0 9 * * *"
const DEFAULT_SCHEDULE_TZ = "UTC"

type mcp_step_review = {
  kind: string
  label: string
  connectActionId?: string
  connectConnected?: boolean
  branches?: { steps: mcp_step_review[] }[]
}

function reviewConnectGaps(steps: mcp_step_review[]): string[] {
  const out: string[] = []
  for (const s of steps) {
    if (s.kind === "connect" && s.connectConnected === false) {
      const entry = getConnectAction(s.connectActionId)
      if (entry && entry.auth !== "none") out.push(entry.displayName)
    }
    for (const b of s.branches ?? []) out.push(...reviewConnectGaps(b.steps))
  }
  return out
}

function parseObjectParams(params?: string): Record<string, unknown> {
  if (!params?.trim()) return {}
  const parsed: unknown = JSON.parse(params)
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("params must be a JSON object")
  }
  return parsed as Record<string, unknown>
}

function csvList(raw?: string): string[] {
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

async function requireLiveSession(sessionPath?: string): Promise<SpineSession> {
  const apiUrl = resolveMcpApiUrl()
  if (!(await probeApi(apiUrl))) {
    throw new Error(
      `Next app not reachable at ${apiUrl} — start combined_full_stack with npm run dev, then retry`,
    )
  }
  return openMcpSession(sessionPath, false)
}

function sessionDefaultDocs(session: SpineSession) {
  const project = session.project
  if (!project) throw new Error("no active project")
  const snap = session.getSnapshot()
  return shareDefaultDocsByModule(project, snap.docs, snap.inferenceInputDocIds)
}

type mcp_review = ReturnType<typeof toMcpProjectReview>
type mcp_review_with_inflight = Omit<mcp_review, "assistantInFlight"> & { assistantInFlight: boolean }

function mcpProjectNext(review: mcp_review_with_inflight, assistantError?: string): string {
  if (assistantError) {
    return `Vibe failed: ${assistantError}. Fix that, then ask_agent again or edit with session_action id=pipeline.add-step / configure_n8n_step / configure_connect_step.`
  }
  if (review.assistantInFlight) return "Vibe still running. Poll get_project. Do not re-send ask_agent."
  if (review.pendingProposal) {
    return "Unapplied proposal. apply_project_changes with no proposalJson to Approve, or session_action id=assistant.reject to discard."
  }
  if (!review.ok) {
    return "Issues listed above. Fix with session_action id=pipeline.add-step / configure_n8n_step / configure_connect_step / session_action structure.add-field, or ask_agent. Then validate_project."
  }
  const connectNeeded = reviewConnectGaps(review.steps)
  if (connectNeeded.length) {
    return `Project is valid. Human taps Connect ${connectNeeded.join(", ")} in the GUI, then pull_remote_state (or configure_connect_step connectConnectionId). Then start_run, or session_action share.create-link / share.create-site / schedule.create.`
  }
  return "Project is valid. If auth_status.canRun, start_run then wait_for_run. Publish with session_action share.create-link | share.create-site | share.create-embed | share.deploy-api. Recurring runs: session_action schedule.create. pinpoint_failure with testDocName from session_logs.tests and runJson from wait_for_run."
}

// AI : compact graph so MCP can review Vibe proposals (inputType, fields, docs, pendingProposal).
export function getProjectFromSession(sessionPath?: string) {
  const path = resolveSessionPath(sessionPath)
  const session = openMcpSession(sessionPath, true)
  const snap = session.getSnapshot()
  if (!snap.projects.length) {
    throw new Error("no active project")
  }
  const assistantError = askAgentErrors.get(path)
  // AI : askAgentJobs is MCP-local — session.assistantInFlight alone misses in-process / mocked asks.
  const review = {
    ...toMcpProjectReview(snap),
    assistantInFlight: Boolean(snap.assistantInFlight) || askAgentJobs.has(path),
  }
  return {
    ...review,
    ...(assistantError ? { assistantError } : {}),
    next: mcpProjectNext(review, assistantError),
  }
}

export function validateProjectFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  return toValidationView(session.getSnapshot())
}

export function applyPendingProposalFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  if (!session.applyPendingProposal()) throw new Error("no pending proposal")
  return getProjectFromSession(sessionPath)
}

export function applyProjectChangesFromSession(proposal: ProjectProposal, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  session.setPendingProposal(proposal)
  session.applyPendingProposal()
  return getProjectFromSession(sessionPath)
}

export async function startRunFromSession(opts: {
  sessionPath?: string
  testDocName?: string
  testing?: boolean
}) {
  const apiUrl = resolveMcpApiUrl()
  if (!(await probeApi(apiUrl))) {
    throw new Error(
      `Next app not reachable at ${apiUrl} — start combined_full_stack with npm run dev, then retry start_run`,
    )
  }
  const session = openMcpSession(opts.sessionPath, false)
  try {
    const run = opts.testing ? await session.runTest(opts.testDocName) : await session.startRun()
    return { id: run.id, status: run.status, source: run.source }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/abort|timeout|fetch failed|ECONNREFUSED|network/i.test(msg)) {
      throw new Error(
        `start_run timed out talking to ${apiUrl} — restart npm run dev in combined_full_stack, then retry`,
      )
    }
    throw err
  }
}

function compactRun(run: PipelineRun, includeJson = false) {
  const compact = {
    id: run.id,
    status: run.status,
    totalMs: run.totalMs,
    steps: run.steps.map((s) => ({
      moduleId: s.moduleId,
      label: s.label,
      kind: s.kind,
      status: s.status,
      ...(s.failures?.length ? { failures: s.failures } : {}),
      ...(s.status !== "ok" && s.outputPreview ? { outputPreview: s.outputPreview.slice(0, 400) } : {}),
    })),
    ...(run.test ? { testPassed: testReportPassed(run.test, run), testDocName: run.test.testDocName } : {}),
  }
  if (!includeJson) return compact
  return {
    ...compact,
    runJson: JSON.stringify({
      id: run.id,
      status: run.status,
      steps: run.steps.map((s) => ({
        moduleId: s.moduleId,
        label: s.label,
        kind: s.kind,
        status: s.status,
        outputJson: s.outputJson,
        outputPreview: s.outputPreview,
        failures: s.failures,
      })),
      test: run.test,
    }),
  }
}

function runIsTerminal(status: string): boolean {
  return status === RunStatus.Ok || status === RunStatus.Error
}

export async function waitForRunFromSession(opts: {
  sessionPath?: string
  runId?: string
  timeoutMs?: number
}) {
  // AI : GUI Logging polls hydrateRunDetail until steps exist; Claude Code needs the same wait.
  const session = openMcpSession(opts.sessionPath, false)
  const timeoutMs = Math.min(Math.max(opts.timeoutMs ?? 45_000, 1_000), 90_000)
  const deadline = Date.now() + timeoutMs
  let runId = opts.runId as RunId | undefined
  if (!runId) {
    const latest = session.runs[0]
    if (!latest) throw new Error("no run to wait for — call start_run or run_test first")
    runId = latest.id
  }
  while (true) {
    await session.hydrateRunDetail(runId)
    const run = session.runs.find((r) => r.id === runId)
    if (run && runIsTerminal(run.status)) {
      return { ...compactRun(run, true), timedOut: false }
    }
    if (Date.now() >= deadline) {
      if (!run) throw new Error(`run ${runId} not found after hydrate`)
      return {
        ...compactRun(run, true),
        timedOut: true,
        next: "Run still running. Call wait_for_run again with the same runId.",
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
}

export function getRunFromSession(opts: { sessionPath?: string; runId?: string }) {
  const session = openMcpSession(opts.sessionPath, true)
  const run = opts.runId ? session.runs.find((r) => r.id === opts.runId) : session.runs[0]
  if (!run) throw new Error("no run to wait for — call start_run or run_test first")
  return compactRun(run, true)
}

export async function authStatusFromSession(sessionPath?: string) {
  const path = resolveSessionPath(sessionPath)
  const apiUrl = resolveMcpApiUrl()
  const hasApiToken = Boolean(process.env[SPINE_API_TOKEN_ENV])
  const apiReachable = await probeApi(apiUrl)
  const runsAuthorized = apiReachable ? await probeRunsAuthorized(apiUrl, hasApiToken) : false
  const seeds = listSeedIds()
  let projectCount = 0
  let projects: { id: string; name: string; active: boolean }[] = []
  let loadError: string | undefined
  try {
    const session = openMcpSession(sessionPath, true)
    projectCount = session.projects.length
    projects = session.projects.map((p) => ({
      id: p.id,
      name: p.name,
      active: p.id === session.activeProjectId,
    }))
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err)
  }
  const canRun = apiReachable && runsAuthorized
  return {
    ok: !loadError,
    sessionPath: path,
    appRoot: process.env.SPINE_APP_ROOT,
    apiUrl,
    apiReachable,
    hasApiToken,
    canRun,
    projectCount,
    projects,
    seeds,
    ...(loadError ? { error: loadError } : {}),
    next: loadError
      ? "Fix or delete the session JSON, then session_action id=project.add."
      : !projectCount
        ? seeds.length
          ? "Call session_action id=project.add for a blank pipeline, or import_seed with file from seeds (e.g. lead_enrich_n8n). Then get_project."
          : "Call session_action id=project.add, then get_project."
        : canRun
          ? hasApiToken
            ? "Call get_project. Same GUI project: pull_remote_state → edit → push_remote_state. Or start_run → wait_for_run."
            : "Call get_project. You can start_run / wait_for_run."
          : apiReachable
            ? "Call get_project. Local edits work. start_run needs SPINE_API_TOKEN (Supabase access token), then retry."
            : `Call get_project. Local edits work. To run, start combined_full_stack (npm run dev) so ${apiUrl} is up. start_run also needs SPINE_API_TOKEN.`,
  }
}

export function listSeedsForMcp() {
  const seeds = listSeedIds()
  return {
    seeds,
    next: seeds.length
      ? "import_seed with file set to one of these ids (no path, no .json). Then get_project."
      : "No bundled seeds found — check SPINE_APP_ROOT, then session_action id=project.add.",
  }
}

export function sessionLogs(sessionPath?: string, errorsOnly = false) {
  const session = openMcpSession(sessionPath, true)
  const project = session.project
  const scopedDocs = project ? docsForProject(session.docs, project) : session.docs
  const runs = filterRunsByErrorStatus(session.runs, errorsOnly ? "errors" : "all").map((r) => ({
    ...compactRun(r, false),
    notes: r.notes,
  }))
  const pendingDocs = (session.pendingProposal?.docs ?? []).map((d) => d.name)
  return {
    runs,
    cache: session.getSnapshot().cacheEntries,
    tests: scopedDocs.filter((d) => d.name.endsWith("_testing.json")).map((d) => d.name),
    docs: scopedDocs.map((d) => ({ name: d.name, type: d.type, label: d.label })),
    ...(pendingDocs.length ? { pendingDocs } : {}),
    next: "runs include step status/previews when hydrated (wait_for_run / logging.hydrate). tests are names for pinpoint_failure.testDocName. pendingDocs need apply_project_changes.",
  }
}

export function lintProjectFromSession(sessionPath?: string, includeExport = false) {
  const session = openMcpSession(sessionPath, true)
  const project = session.project
  if (!project) throw new Error("no active project")
  const result = lintPipeline(project, { includeExport })
  return {
    projectName: project.name,
    ok: result.ok,
    lintCount: result.lints.length,
    lints: result.lints,
  }
}

export function pinpointFailureFromSession(
  input: PinpointRunSource & { sessionPath?: string; testDocName?: string },
  cwd: string,
) {
  const session = openMcpSession(input.sessionPath, true)
  const project = session.project
  if (!project) throw new Error("no active project")
  const tests = docsForProject(session.docs, project).filter((d) => d.name.endsWith("_testing.json"))
  const testName = input.testDocName?.trim()
  if (!testName) {
    throw new Error(
      `testDocName required. Available: ${tests.map((d) => d.name).join(", ") || "(none — add a *_testing.json doc)"}`,
    )
  }
  const doc = tests.find((d) => d.id === testName || d.name === testName)
  if (!doc) {
    throw new Error(
      `unknown test doc: ${testName}. Available: ${tests.map((d) => d.name).join(", ") || "(none)"}`,
    )
  }
  const content = session.getSnapshot().docContents[doc.id]
  if (!content?.trim()) throw new Error(`test doc has no content: ${doc.name}`)
  return pinpointFailureOnProject(project, content, doc.name, readRunFromInput(input, cwd))
}

export function projectFromSession(sessionPath?: string): Project {
  const session = openMcpSession(sessionPath, true)
  const project = session.project
  if (!project) throw new Error("no active project")
  return project
}

export function addProjectFromSession(sessionPath?: string, open = true) {
  const session = openMcpSession(sessionPath, true)
  const project = session.addProject({ open })
  return { id: project.id, name: project.name }
}

export function renameProjectFromSession(name: string, id?: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const target = id ?? session.activeProjectId
  if (!target) throw new Error("no project id")
  session.renameProject(target, name)
  return getProjectFromSession(sessionPath)
}

export function deleteProjectFromSession(id: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  session.deleteProject(id)
  return { deleted: id, remaining: session.projects.map((p) => p.id) }
}

export function openProjectFromSession(id: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  session.openProject(id)
  return getProjectFromSession(sessionPath)
}

export function cloneProjectFromSession(id?: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const target = id ?? session.activeProjectId
  if (!target) throw new Error("no project id")
  const cloned = session.cloneProject(target, { open: false })
  return { id: cloned.id, name: cloned.name }
}

export function importSeedFromSession(file: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const project = importSeed(session, file)
  return { id: project.id, name: project.name }
}

export function addModelFromSession(name: string, sessionPath?: string, params?: string) {
  const session = openMcpSession(sessionPath, true)
  const model = addNamedModel(session, name, params)
  return { id: model.id, name: model.name, params: model.params }
}

export function addFieldFromSession(
  model: string,
  name: string,
  type: string,
  optional: boolean,
  sessionPath?: string,
) {
  const session = openMcpSession(sessionPath, true)
  addModelField(session, model, name, type, { optional })
  return getProjectFromSession(sessionPath)
}

export function setRelationFromSession(
  model: string,
  field: string,
  spec: string,
  sessionPath?: string,
) {
  const session = openMcpSession(sessionPath, true)
  setModelFieldRelation(session, model, field, spec)
  return getProjectFromSession(sessionPath)
}

export function inspectIdsFromSession(
  opts: { sessionPath?: string; idType?: string; docName?: string; filter?: "all" | "missing" | "unused" | "duplicate" },
) {
  const session = openMcpSession(opts.sessionPath, true)
  const snap = session.getSnapshot()
  const docs = snap.docs
    .filter((d) => !opts.docName || d.name === opts.docName)
    .map((d) => {
      const content = snap.docContents[d.id]
      return content ? { name: d.name, type: d.type, content, id: d.id } : undefined
    })
    .filter((d): d is NonNullable<typeof d> => !!d)
  return inspectCatalogDocs(session.models, docs, {
    idType: opts.idType,
    filter: opts.filter ?? "all",
    typeAliases: session.project?.typeAliases,
  })
}

export function removeFieldFromSession(model: string, name: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  removeModelField(session, model, name)
  return getProjectFromSession(sessionPath)
}

export function addAliasFromSession(name: string, expr: string, sessionPath?: string, params?: string) {
  const session = openMcpSession(sessionPath, true)
  const alias = addTypeAlias(session, name, expr, params)
  return { id: alias.id, name: alias.name, params: alias.params }
}

export function addStepFromSession(
  kind: string,
  label?: string,
  sessionPath?: string,
  opts?: { forkId?: string; branchId?: string },
) {
  const session = openMcpSession(sessionPath, true)
  const parsed = parseAddableKind(kind)
  if (!parsed) throw new Error(`unknown step kind: ${kind}. Use: ${USER_ADDABLE_MODULE_KINDS.join(", ")}`)
  const added = addPipelineStep(session, parsed, label, opts)
  return added.map((m) => ({ id: m.id, kind: m.kind, label: m.label }))
}

export function patchStepFromSession(
  id: string,
  patch: { label?: string; prompt?: string; note?: string; forkJoin?: string } & Record<string, unknown>,
  sessionPath?: string,
) {
  const session = openMcpSession(sessionPath, true)
  const step = patchStep(session, id, patch as Parameters<typeof patchStep>[2])
  return { id: step.id, label: step.label, kind: step.kind, n8nNodeType: step.n8nNodeType, forkJoin: step.forkJoin }
}

export function configureN8nStepFromSession(opts: {
  stepId: string
  n8nNodeType?: string
  parametersJson?: string
  n8nCode?: string
  sessionPath?: string
}) {
  const session = openMcpSession(opts.sessionPath, true)
  let parameters: Record<string, unknown> | undefined
  if (opts.parametersJson?.trim()) {
    const parsed: unknown = JSON.parse(opts.parametersJson)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("parametersJson must be a JSON object")
    }
    parameters = parsed as Record<string, unknown>
  }
  const patch: Parameters<typeof patchStep>[2] = {}
  if (opts.n8nNodeType) patch.n8nNodeType = opts.n8nNodeType
  if (parameters) patch.n8nParameters = parameters
  if (opts.n8nCode !== undefined) patch.n8nCode = opts.n8nCode || undefined
  const step = patchStep(session, opts.stepId, patch)
  return {
    id: step.id,
    label: step.label,
    kind: step.kind,
    n8nNodeType: step.n8nNodeType,
    n8nParameters: step.n8nParameters,
  }
}

export function configureConnectStepFromSession(opts: {
  stepId: string
  connectActionId?: string
  parametersJson?: string
  connectConnectionId?: string
  sessionPath?: string
}) {
  const session = openMcpSession(opts.sessionPath, true)
  let parameters: Record<string, unknown> | undefined
  if (opts.parametersJson?.trim()) {
    const parsed: unknown = JSON.parse(opts.parametersJson)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("parametersJson must be a JSON object")
    }
    parameters = parsed as Record<string, unknown>
  }
  if (opts.connectActionId && !getConnectAction(opts.connectActionId)) {
    throw new Error(`unknown connect action: ${opts.connectActionId}`)
  }
  const patch: Parameters<typeof patchStep>[2] = {}
  if (opts.connectActionId) patch.connectActionId = opts.connectActionId
  if (parameters) patch.connectParameters = parameters
  if (opts.connectConnectionId !== undefined) {
    patch.connectConnectionId = opts.connectConnectionId.trim() || undefined
  }
  const step = patchStep(session, opts.stepId, patch)
  return {
    id: step.id,
    label: step.label,
    kind: step.kind,
    connectActionId: step.connectActionId,
    connectParameters: step.connectParameters,
    connectConnected: Boolean(step.connectConnectionId?.trim()),
  }
}

export function removeStepFromSession(id: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  removeStep(session, id)
  return getProjectFromSession(sessionPath)
}

export function moveStepFromSession(id: string, at: number, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  moveStep(session, id, at)
  return getProjectFromSession(sessionPath)
}

export function assignStructureFromSession(stepId: string, model: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const assigned = assignStepStructure(session, stepId, model)
  return { model: { id: assigned.id, name: assigned.name } }
}

export function addDocFromSession(input: { name: string; content: string; sessionPath?: string }) {
  const session = openMcpSession(input.sessionPath, true)
  const doc = session.addDoc({
    name: input.name,
    type: InputType.Text,
    content: input.content,
    label: DocLabel.Inference,
  })
  return doc
}

export function removeDocFromSession(docKey: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const doc = session.docs.find((d) => d.id === docKey || d.name === docKey)
  if (!doc) throw new Error(`unknown doc: ${docKey}`)
  session.removeDoc(doc.id)
  return getProjectFromSession(sessionPath)
}

export function setDocProjectsFromSession(docKey: string, projectIds: string[], sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const doc = session.docs.find((d) => d.id === docKey || d.name === docKey)
  if (!doc) throw new Error(`unknown doc: ${docKey}`)
  session.setDocProjects(doc.id, projectIds as import("@/lib/types").ProjectId[])
  return { docId: doc.id, projectIds }
}

export function linkQuotesFromSession(input: {
  quote: string
  doc: string
  text?: string
  sessionPath?: string
}) {
  const session = openMcpSession(input.sessionPath, true)
  const snap = session.getSnapshot()
  const doc = snap.docs.find((d) => d.id === input.doc || d.name === input.doc)
  if (!doc) throw new Error(`unknown doc: ${input.doc}`)
  const sourceText = input.text ?? snap.docContents[doc.id]
  if (!sourceText) throw new Error(`no content for doc: ${doc.name}`)
  const linked = session.linkQuotes({ quote: input.quote, sourceText, docId: doc.id })
  return { action: "linkQuotes", quote: linked }
}

export async function pullRemoteStateFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath)
  await session.pullRemoteState()
  return getProjectFromSession(sessionPath)
}

export async function pushRemoteStateFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath)
  await session.flushPendingSave()
  return getProjectFromSession(sessionPath)
}

export async function resyncExamplesFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath)
  const count = await session.resyncExamples()
  return { action: "resyncExamples", count, project: getProjectFromSession(sessionPath) }
}

export async function executeProposedActionsFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath)
  const runs = await session.executeProposedActions()
  return {
    action: "executeProposedActions",
    runs: runs.map((r) => ({ id: r.id, status: r.status })),
  }
}

export function setDocsFromSession(text: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  session.setDocumentation(text)
  return { documentation: session.documentation }
}

export function assignInputFromSession(moduleKey: string, docKey: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const mod = session.modules.find((m) => m.id === moduleKey || m.label === moduleKey)
  const doc = session.docs.find((d) => d.id === docKey || d.name === docKey)
  if (!mod) throw new Error(`unknown module: ${moduleKey}`)
  if (!doc) throw new Error(`unknown doc: ${docKey}`)
  const reason = exclusionReasonForInputModule(doc, mod)
  if (reason) throw new Error(`${doc.name}: ${exclusionReasonLabel(reason, mod)}`)
  session.setInferenceInputDocIds({ ...session.getSnapshot().inferenceInputDocIds, [mod.id]: doc.id })
  return { moduleId: mod.id, docId: doc.id }
}

export function rejectProposalFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  session.rejectPendingProposal()
  return { pending: false }
}

export async function askAgentFromSession(message: string, sessionPath?: string, kind?: string) {
  // AI : askAgent tries POST /api/pipeline-assistant when egress is live; falls back to in-process propose.
  const path = resolveSessionPath(sessionPath)
  const session = openMcpSession(sessionPath, false)
  if (session.assistantInFlight || askAgentJobs.has(path)) {
    return {
      ok: true,
      command: "agent ask",
      issues: [],
      data: {
        inFlight: true,
        pending: Boolean(session.pendingProposal),
        message: "vibe still running — poll get_project",
        human: "vibe still running — poll get_project",
        ...(askAgentErrors.has(path) ? { assistantError: askAgentErrors.get(path) } : {}),
      },
    }
  }
  const assistant =
    kind === "structure" || kind === "testing" || kind === "diagnosis" || kind === "vibe" ? kind : "vibe"
  askAgentErrors.delete(path)
  const job = askAgent(session, message, { kind: assistant })
    .then((result) => {
      if (result && result.ok === false) {
        const msg = result.issues.map((i) => i.message).filter(Boolean).join("; ") || "ask_agent failed"
        askAgentErrors.set(path, msg)
      } else {
        askAgentErrors.delete(path)
      }
      return result
    })
    .catch((err) => {
      askAgentErrors.set(path, err instanceof Error ? err.message : String(err))
    })
    .finally(() => {
      if (askAgentJobs.get(path) === job) askAgentJobs.delete(path)
    })
  askAgentJobs.set(path, job)
  return {
    ok: true,
    command: "agent ask",
    issues: [],
    data: {
      inFlight: true,
      pending: Boolean(session.pendingProposal),
      message: "vibe still running — poll get_project",
      human: "vibe still running — poll get_project",
    },
  }
}

export async function refreshBillingFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, false)
  if (session.egress && !session.egress.blocked) await session.refreshBilling()
  return toBillingView(session.getSnapshot())
}

export async function refreshEarningsFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, false)
  if (session.egress && !session.egress.blocked) await session.refreshEarnings()
  return session.getSnapshot().earningsAccount
}

export function cacheFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  return toCacheView(session.getSnapshot())
}

export async function shareFromSession(sessionPath?: string) {
  try {
    const session = await requireLiveSession(sessionPath)
    const [links, apis] = await Promise.all([session.listShareLinks(), session.listHostedApis()])
    return { ...toShareView(session.getSnapshot()), links: links.links, apis: apis.apis }
  } catch {
    const session = openMcpSession(sessionPath, true)
    return {
      ...toShareView(session.getSnapshot()),
      next: "Local snapshot only. Start combined_full_stack and set SPINE_API_TOKEN, then session_action share.create-link / share.create-site / share.deploy-api.",
    }
  }
}

export async function createShareFromSession(kind: "link" | "embed" | "site", args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  const extra = parseObjectParams(args.params)
  const fundingMode =
    args.fundingMode ??
    (typeof extra.fundingMode === "string" ? extra.fundingMode : undefined) ??
    (kind === "embed" ? "viewer_signs_in" : "sharer_pays")
  const spendLimitCents =
    args.spendLimitCents ??
    (typeof extra.spendLimitCents === "number" ? extra.spendLimitCents : DEFAULT_SHARE_SPEND_CENTS)
  const allowedOrigins = csvList(args.allowedOrigins).length
    ? csvList(args.allowedOrigins)
    : Array.isArray(extra.allowedOrigins)
      ? (extra.allowedOrigins as string[])
      : []
  if (kind === "embed" && !allowedOrigins.length) {
    throw new Error("share.create-embed needs allowedOrigins (comma-separated origins the iframe may load on)")
  }
  const project = session.project
  if (!project) throw new Error("no active project")
  const companyName =
    args.companyName?.trim() ||
    args.name?.trim() ||
    (typeof extra.companyName === "string" ? extra.companyName.trim() : "") ||
    project.name
  const siteOptions =
    kind === "site"
      ? normalizeHostedSiteOptions({
          brand: {
            ...DEFAULT_HOSTED_SITE_OPTIONS.brand,
            companyName,
            tagline:
              typeof extra.tagline === "string" && extra.tagline.trim()
                ? extra.tagline
                : "Run this pipeline",
          },
          customHtml: typeof extra.customHtml === "string" ? extra.customHtml : DEFAULT_HOSTED_SITE_HTML,
          customCss: typeof extra.customCss === "string" ? extra.customCss : "",
          hideSpineFooter: extra.hideSpineFooter === true,
          ...(typeof extra.siteOptions === "object" && extra.siteOptions ? (extra.siteOptions as object) : {}),
        })
      : undefined
  const minted = await session.createShareLink({
    kind,
    fundingMode,
    viewerNameRequired: extra.viewerNameRequired === true,
    spendLimitCents,
    billingMultiple: typeof extra.billingMultiple === "number" ? extra.billingMultiple : 1,
    flatFeeCents: typeof extra.flatFeeCents === "number" ? extra.flatFeeCents : undefined,
    defaultDocsByModule: extra.defaultDocsByModule ?? sessionDefaultDocs(session),
    ...(kind === "embed"
      ? {
          allowedOrigins,
          embedOptions: {
            ...DEFAULT_EMBED_OPTIONS,
            ...(typeof extra.embedOptions === "object" && extra.embedOptions ? extra.embedOptions : {}),
          },
        }
      : {}),
    ...(kind === "site" ? { siteOptions } : {}),
  })
  const origin = resolveMcpApiUrl()
  return {
    ...minted,
    url: minted.url.startsWith("http") ? minted.url : `${origin}${minted.url}`,
    next:
      kind === "site"
        ? `Hosted page minted. Share ${origin}${minted.url}. OAuth apps still need the human Connect chip.`
        : kind === "embed"
          ? `Embed minted. Drop the iframe on an allowed origin. Path ${minted.url}.`
          : `Link minted. Share ${origin}${minted.url}.`,
  }
}

export async function createHostedApiFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  const extra = parseObjectParams(args.params)
  const created = await session.createHostedApi({
    fundingMode: args.fundingMode ?? (typeof extra.fundingMode === "string" ? extra.fundingMode : "owner_pays"),
    billingMultiple: typeof extra.billingMultiple === "number" ? extra.billingMultiple : 1,
    flatFeeCents: typeof extra.flatFeeCents === "number" ? extra.flatFeeCents : undefined,
    spendLimitCents: args.spendLimitCents ?? (typeof extra.spendLimitCents === "number" ? extra.spendLimitCents : undefined),
    defaultDocsByModule: extra.defaultDocsByModule ?? sessionDefaultDocs(session),
  })
  return {
    ...created,
    next: created.apiKey
      ? "Copy apiKey now — the server will not show it again. Invoke with that key."
      : "Hosted API deployed.",
  }
}

export async function listSchedulesFromSession(sessionPath?: string) {
  const session = await requireLiveSession(sessionPath)
  return session.listSchedules()
}

export async function createScheduleFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  const extra = parseObjectParams(args.params)
  const cron = args.cron?.trim() || (typeof extra.cron === "string" ? extra.cron.trim() : DEFAULT_SCHEDULE_CRON)
  const timezone =
    args.timezone?.trim() || (typeof extra.timezone === "string" ? extra.timezone.trim() : DEFAULT_SCHEDULE_TZ)
  if (!isValidCronExpr(cron)) throw new Error("That schedule isn't valid — pass cron like 0 9 * * *")
  if (!isValidIanaTimeZone(timezone)) throw new Error("Pass timezone as an IANA name, e.g. Australia/Sydney")
  const name = args.name?.trim() || (typeof extra.name === "string" ? extra.name.trim() : "") || describeCronExpr(cron)
  return session.createSchedule({
    name,
    cron,
    timezone,
    defaultDocsByModule: extra.defaultDocsByModule ?? sessionDefaultDocs(session),
    enabled: args.enabled ?? (typeof extra.enabled === "boolean" ? extra.enabled : true),
    tickUrl: typeof extra.tickUrl === "string" ? extra.tickUrl : undefined,
  })
}

function requireScheduleId(args: SessionActionArgs): string {
  const id = args.scheduleId?.trim() || args.stepId?.trim()
  if (!id) throw new Error("scheduleId required")
  return id
}

export async function patchScheduleFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  const extra = parseObjectParams(args.params)
  const patch: Record<string, unknown> = { ...extra }
  if (args.name) patch.name = args.name
  if (args.cron) patch.cron = args.cron
  if (args.timezone) patch.timezone = args.timezone
  if (args.enabled !== undefined) patch.enabled = args.enabled
  if (Object.keys(patch).length === 0) throw new Error("Provide enabled, name, cron, and/or timezone")
  return session.patchSchedule(requireScheduleId(args), patch)
}

export async function deleteScheduleFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  return session.deleteSchedule(requireScheduleId(args))
}

export async function runScheduleNowFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  return session.runScheduleNow(requireScheduleId(args))
}

export async function publishMarketplaceFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  const extra = parseObjectParams(args.params)
  const title = args.name?.trim() || (typeof extra.title === "string" ? extra.title.trim() : "")
  if (!title) throw new Error("name required (marketplace listing title)")
  return session.publishMarketplaceListing({
    title,
    description: typeof extra.description === "string" ? extra.description : args.text,
    priceCents: typeof extra.priceCents === "number" ? extra.priceCents : 0,
  })
}

export async function startConnectSessionFromSession(args: SessionActionArgs) {
  const session = await requireLiveSession(args.sessionPath)
  const extra = parseObjectParams(args.params)
  let actionId = args.connectActionId?.trim() || (typeof extra.actionId === "string" ? extra.actionId.trim() : "")
  if (!actionId && args.stepId) {
    const step = flattenPipelineModules(session.modules).find((m) => m.id === args.stepId || m.label === args.stepId)
    actionId = step?.connectActionId?.trim() ?? ""
  }
  if (!actionId) throw new Error("connectActionId required — list_connect_actions or pass stepId of a connect step")
  const started = await session.startConnectSession(actionId)
  return {
    ...started,
    next: "Vendor OAuth is GUI-only. Human taps Connect in the app, then pull_remote_state (or configure_connect_step connectConnectionId). Do not invent connection ids.",
  }
}

export function settingsFromSession(model?: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  if (model) session.setModel(model)
  return toSettingsView(session.getSnapshot())
}

export type SessionActionArgs = {
  id: string
  sessionPath?: string
  name?: string
  projectId?: string
  file?: string
  kind?: string
  label?: string
  model?: string
  type?: string
  optional?: boolean
  expr?: string
  params?: string
  stepId?: string
  prompt?: string
  note?: string
  content?: string
  text?: string
  module?: string
  doc?: string
  message?: string
  proposalJson?: string
  testDocName?: string
  testing?: boolean
  relation?: string
  forkId?: string
  branchId?: string
  forkJoin?: string
  runId?: string
  timeoutMs?: number
  quote?: string
  executeRuns?: boolean
  at?: number
  projects?: string
  cron?: string
  timezone?: string
  enabled?: boolean
  fundingMode?: string
  companyName?: string
  allowedOrigins?: string
  spendLimitCents?: number
  connectConnectionId?: string
  connectActionId?: string
  scheduleId?: string
}

export const SESSION_ACTION_CANONICAL_IDS = [
  "project.add",
  "project.rename",
  "project.delete",
  "project.open",
  "project.clone",
  "project.clone-template",
  "structure.add-model",
  "structure.add-field",
  "structure.set-relation",
  "structure.remove-field",
  "structure.add-alias",
  "pipeline.add-step",
  "pipeline.configure-step",
  "pipeline.remove-step",
  "pipeline.move-step",
  "pipeline.assign-structure",
  "documents.upload",
  "documents.remove",
  "documents.set-projects",
  "docs.set",
  "inference.assign-input",
  "assistant.send",
  "assistant.approve",
  "assistant.reject",
  "assistant.execute-runs",
  "inference.start-run",
  "testing.run",
  "logging.hydrate",
  "logging.get-run",
  "logging.errors-only",
  "quotes.link",
  "session.pull",
  "session.push",
  "project.resync-examples",
  "share.create-link",
  "share.create-embed",
  "share.create-site",
  "share.deploy-api",
  "share.marketplace-publish",
  "schedule.create",
  "schedule.toggle",
  "schedule.run-now",
  "schedule.delete",
  "connect.start-session",
  "nav.window.share",
  "nav.window.schedule",
] as const

export function suggestSessionActionId(id: string): string {
  const needle = id.trim().toLowerCase().replace(/_/g, ".")
  const ids = SESSION_ACTION_CANONICAL_IDS as readonly string[]
  const suffix = ids.filter((k) => k === needle || k.endsWith(`.${needle}`) || k.endsWith(`.${id.replace(/_/g, "-")}`))
  if (suffix.length === 1) return `Did you mean ${suffix[0]}?`
  if (suffix.length > 1) return `Did you mean ${suffix.join(" | ")}?`
  const fuzzy = ids.filter((k) => k.includes(needle) || needle.includes(k.split(".").pop() ?? k))
  if (fuzzy.length && fuzzy.length <= 8) return `Closest: ${fuzzy.join(", ")}`
  return `Valid ids include: ${ids.slice(0, 12).join(", ")}, …`
}

export async function runSessionAction(args: SessionActionArgs): Promise<unknown> {
  const { id, sessionPath } = args
  switch (id) {
    case "project.add":
    case "add_project":
      return addProjectFromSession(sessionPath)
    case "project.rename":
    case "rename_project":
      if (!args.name) throw new Error("name required")
      return renameProjectFromSession(args.name, args.projectId, sessionPath)
    case "project.delete":
    case "delete_project":
      if (!args.projectId) throw new Error("projectId required")
      return deleteProjectFromSession(args.projectId, sessionPath)
    case "project.open":
    case "open_project":
      if (!args.projectId) throw new Error("projectId required")
      return openProjectFromSession(args.projectId, sessionPath)
    case "project.clone":
    case "clone_project":
      return cloneProjectFromSession(args.projectId, sessionPath)
    case "project.clone-template":
    case "share.marketplace-clone":
    case "import_seed":
      if (!args.file) throw new Error("file required")
      return importSeedFromSession(args.file, sessionPath)
    case "structure.add-model":
    case "add_model":
      if (!args.name) throw new Error("name required")
      return addModelFromSession(args.name, sessionPath, args.params)
    case "structure.add-field":
      if (!args.model || !args.name || !args.type) throw new Error("model, name, type required")
      return addFieldFromSession(args.model, args.name, args.type, args.optional === true, sessionPath)
    case "structure.set-relation":
      if (!args.model || !args.name) throw new Error("model, name required")
      if (!args.relation) throw new Error("relation required (pk | none | WorkItem.id)")
      return setRelationFromSession(args.model, args.name, args.relation, sessionPath)
    case "structure.remove-field":
      if (!args.model || !args.name) throw new Error("model, name required")
      return removeFieldFromSession(args.model, args.name, sessionPath)
    case "structure.add-alias":
      if (!args.name || !args.expr) throw new Error("name, expr required")
      return addAliasFromSession(args.name, args.expr, sessionPath, args.params)
    case "pipeline.add-step":
    case "add_step":
      if (!args.kind) throw new Error("kind required")
      return addStepFromSession(args.kind, args.label, sessionPath, {
        forkId: typeof args.forkId === "string" ? args.forkId : undefined,
        branchId: typeof args.branchId === "string" ? args.branchId : undefined,
      })
    case "pipeline.configure-step":
      if (!args.stepId) throw new Error("stepId required")
      return patchStepFromSession(
        args.stepId,
        { label: args.label, prompt: args.prompt, note: args.note, forkJoin: args.forkJoin },
        sessionPath,
      )
    case "pipeline.remove-step":
      if (!args.stepId) throw new Error("stepId required")
      return removeStepFromSession(args.stepId, sessionPath)
    case "pipeline.move-step":
      if (!args.stepId || args.at == null) throw new Error("stepId, at required")
      return moveStepFromSession(args.stepId, args.at, sessionPath)
    case "pipeline.assign-structure":
      if (!args.stepId || !args.model) throw new Error("stepId, model required")
      return assignStructureFromSession(args.stepId, args.model, sessionPath)
    case "documents.upload":
    case "testing.new-file":
    case "add_doc":
      if (!args.name || args.content == null) throw new Error("name, content required")
      return addDocFromSession({ name: args.name, content: args.content, sessionPath })
    case "documents.remove":
    case "remove_doc":
      if (!args.doc) throw new Error("doc required")
      return removeDocFromSession(args.doc, sessionPath)
    case "documents.set-projects":
      if (!args.doc) throw new Error("doc required")
      {
        const ids = args.projects
          ? args.projects.split(",").map((s) => s.trim()).filter(Boolean)
          : args.projectId
            ? [args.projectId]
            : []
        if (!ids.length) throw new Error("projects or projectId required")
        return setDocProjectsFromSession(args.doc, ids, sessionPath)
      }
    case "docs.set":
    case "set_docs":
      if (args.text == null) throw new Error("text required")
      return setDocsFromSession(args.text, sessionPath)
    case "inference.assign-input":
    case "assign_input":
      if (!args.module || !args.doc) throw new Error("module, doc required")
      return assignInputFromSession(args.module, args.doc, sessionPath)
    case "assistant.reject":
      return rejectProposalFromSession(sessionPath)
    case "assistant.send":
    case "ask_agent":
      if (!args.message) throw new Error("message required")
      return askAgentFromSession(args.message, sessionPath, args.kind)
    case "assistant.approve":
    case "apply_project_changes":
      if (args.proposalJson) {
        await applyProjectChangesFromSession(JSON.parse(args.proposalJson) as ProjectProposal, sessionPath)
      } else {
        await applyPendingProposalFromSession(sessionPath)
      }
      if (args.executeRuns) return executeProposedActionsFromSession(sessionPath)
      return getProjectFromSession(sessionPath)
    case "inference.start-run":
    case "start_run":
      return startRunFromSession({ sessionPath, testDocName: args.testDocName, testing: args.testing })
    case "testing.run":
    case "run_test":
      return startRunFromSession({ sessionPath, testDocName: args.testDocName, testing: true })
    case "logging.hydrate":
    case "wait_for_run":
      return waitForRunFromSession({ sessionPath, runId: args.runId, timeoutMs: args.timeoutMs })
    case "logging.get-run":
    case "get_run":
      return getRunFromSession({ sessionPath, runId: args.runId })
    case "auth_status":
      return authStatusFromSession(sessionPath)
    case "nav.billing":
    case "billing.refresh":
      return refreshBillingFromSession(sessionPath)
    case "nav.window.earnings":
    case "earnings.refresh":
      return refreshEarningsFromSession(sessionPath)
    case "nav.settings":
    case "settings.set-model":
      return settingsFromSession(args.model, sessionPath)
    case "nav.window.share":
    case "share.tab.link":
    case "share.tab.api":
    case "share.tab.embed":
    case "share.tab.site":
      return shareFromSession(sessionPath)
    case "share.create-link":
      return createShareFromSession("link", args)
    case "share.create-embed":
      return createShareFromSession("embed", args)
    case "share.create-site":
      return createShareFromSession("site", args)
    case "share.deploy-api":
      return createHostedApiFromSession(args)
    case "share.marketplace-publish":
      return publishMarketplaceFromSession(args)
    case "nav.window.schedule":
      return listSchedulesFromSession(sessionPath)
    case "schedule.create":
      return createScheduleFromSession(args)
    case "schedule.toggle":
      if (args.enabled === undefined) throw new Error("enabled required")
      return patchScheduleFromSession(args)
    case "schedule.run-now":
      return runScheduleNowFromSession(args)
    case "schedule.delete":
      return deleteScheduleFromSession(args)
    case "connect.start-session":
      return startConnectSessionFromSession(args)
    case "nav.window.cache":
    case "cache.refresh":
      return cacheFromSession(sessionPath)
    case "get_project":
    case "nav.build":
    case "nav.build.vibe":
    case "nav.build.editors":
    case "nav.window.structure":
      return getProjectFromSession(sessionPath)
    case "validate_project":
    case "pipeline.validate":
      return validateProjectFromSession(sessionPath)
    case "session_logs":
    case "nav.window.logging":
      return sessionLogs(sessionPath)
    case "logging.errors-only":
      return sessionLogs(sessionPath, true)
    case "quotes.link":
      if (!args.quote || !args.doc) throw new Error("quote, doc required")
      return linkQuotesFromSession({
        quote: args.quote,
        doc: args.doc,
        text: args.text,
        sessionPath,
      })
    case "session.pull":
      return pullRemoteStateFromSession(sessionPath)
    case "session.push":
      return pushRemoteStateFromSession(sessionPath)
    case "project.resync-examples":
      return resyncExamplesFromSession(sessionPath)
    case "assistant.execute-runs":
      return executeProposedActionsFromSession(sessionPath)
    // AI : Host-bound (no session method): inference.stop, jobs.stop, inference.human-review.*,
    // AI :   inference.chatbot.send, inference.custom-code, Stripe, auth.sign-in. OAuth popup is GUI.
    default:
      throw new Error(`unknown session_action id: ${id}. ${suggestSessionActionId(id)}`)
  }
}
