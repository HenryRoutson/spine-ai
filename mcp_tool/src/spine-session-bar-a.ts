// AI : MCP Bar A — session file + HTTP, same SpineSession methods as CLI/Vibe (not seed-only).
// AI : Goal is GUI-equivalent *actions*. get_project is a compact review, not a live UI dump.

import { createSpineSession } from "@/lib/core/session"
import { createApiEgress, createThrowingEgress, SPINE_API_TOKEN_ENV, SPINE_API_URL_ENV } from "@/lib/core/transport"
import { toBillingView, toCacheView, toMcpProjectReview, toSettingsView, toShareView, toValidationView } from "@/lib/core/view"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import {
  addModelField,
  addNamedModel,
  addPipelineStep,
  addTypeAlias,
  assignStepStructure,
  importSeed,
  parseAddableKind,
  patchStep,
  removeModelField,
  removeStep,
} from "@/lib/cli/workspace_edits"
import { askAgent } from "@/lib/cli/agent"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import { filterRunsByErrorStatus } from "@/lib/run-error-log"
import { exclusionReasonForInputModule, exclusionReasonLabel } from "@/lib/inference-input-picker"
// AI : import enums from server/types — tsx ESM drops named values through lib/types `export *`.
import { DocLabel, InputType, type Project } from "@/lib/server/types"

export function openMcpSession(sessionPath?: string, offline = false) {
  const persist = createFilePersist(resolveSessionPath(sessionPath))
  const url = process.env[SPINE_API_URL_ENV]
  const egress = offline
    ? createThrowingEgress()
    : url
      ? createApiEgress(url, process.env[SPINE_API_TOKEN_ENV])
      : undefined
  return createSpineSession({ persist, egress })
}

// AI : compact graph so MCP can review Vibe proposals (inputType, fields, docs, pendingProposal).
export function getProjectFromSession(sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  return toMcpProjectReview(session.getSnapshot())
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
  // AI : TODO (mcp-run-loop) — wait until terminal + hydrateRunDetail; GUI polls until step outputs exist.
  // AI :   pinpoint_failure needs that JSON. start_run/run_test matching GUI Run/Testing → Run is incomplete without this.
  const session = openMcpSession(opts.sessionPath, false)
  const run = opts.testing ? await session.runTest(opts.testDocName) : await session.startRun()
  return { id: run.id, status: run.status, source: run.source }
}

export function sessionLogs(sessionPath?: string, errorsOnly = false) {
  const session = openMcpSession(sessionPath, true)
  const runs = filterRunsByErrorStatus(session.runs, errorsOnly ? "errors" : "all").map((r) => ({
    id: r.id,
    status: r.status,
    notes: r.notes,
  }))
  return {
    runs,
    cache: session.getSnapshot().cacheEntries,
    tests: session.docs.filter((d) => d.name.endsWith("_testing.json")).map((d) => d.name),
    docs: session.docs.map((d) => ({ name: d.name, type: d.type, label: d.label })),
  }
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

export function addStepFromSession(kind: string, label?: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  const parsed = parseAddableKind(kind)
  if (!parsed) throw new Error(`unknown step kind: ${kind}`)
  const added = addPipelineStep(session, parsed, label)
  return added.map((m) => ({ id: m.id, kind: m.kind, label: m.label }))
}

export function patchStepFromSession(
  id: string,
  patch: { label?: string; prompt?: string; note?: string },
  sessionPath?: string,
) {
  const session = openMcpSession(sessionPath, true)
  const step = patchStep(session, id, patch)
  return { id: step.id, label: step.label, kind: step.kind }
}

export function removeStepFromSession(id: string, sessionPath?: string) {
  const session = openMcpSession(sessionPath, true)
  removeStep(session, id)
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
  // AI : TODO (mcp-vibe-http) — POST /api/pipeline-assistant (billed + auth) like GUI Send, not in-process proposePipelineChange.
  const session = openMcpSession(sessionPath, false)
  const assistant =
    kind === "structure" || kind === "testing" || kind === "diagnosis" || kind === "vibe" ? kind : "vibe"
  return askAgent(session, message, { kind: assistant })
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

export function shareFromSession(sessionPath?: string) {
  // AI : TODO (mcp-capability) — list-only; GUI Share mints POST /api/shared-links + hosted-apis + embed.
  const session = openMcpSession(sessionPath, true)
  return toShareView(session.getSnapshot())
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
    case "structure.remove-field":
      if (!args.model || !args.name) throw new Error("model, name required")
      return removeFieldFromSession(args.model, args.name, sessionPath)
    case "structure.add-alias":
      if (!args.name || !args.expr) throw new Error("name, expr required")
      return addAliasFromSession(args.name, args.expr, sessionPath, args.params)
    case "pipeline.add-step":
    case "add_step":
      // AI : TODO (allow-pipeline-non-linear-fork) — add_step args: optional branchId for insert into a lane.
      if (!args.kind) throw new Error("kind required")
      return addStepFromSession(args.kind, args.label, sessionPath)
    case "pipeline.configure-step":
      if (!args.stepId) throw new Error("stepId required")
      return patchStepFromSession(args.stepId, { label: args.label, prompt: args.prompt, note: args.note }, sessionPath)
    case "pipeline.remove-step":
      if (!args.stepId) throw new Error("stepId required")
      return removeStepFromSession(args.stepId, sessionPath)
    case "pipeline.assign-structure":
      if (!args.stepId || !args.model) throw new Error("stepId, model required")
      return assignStructureFromSession(args.stepId, args.model, sessionPath)
    case "documents.upload":
    case "testing.new-file":
    case "add_doc":
      if (!args.name || args.content == null) throw new Error("name, content required")
      return addDocFromSession({ name: args.name, content: args.content, sessionPath })
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
        return applyProjectChangesFromSession(JSON.parse(args.proposalJson) as ProjectProposal, sessionPath)
      }
      return applyPendingProposalFromSession(sessionPath)
    case "inference.start-run":
    case "start_run":
      return startRunFromSession({ sessionPath, testDocName: args.testDocName, testing: args.testing })
    case "testing.run":
    case "run_test":
      return startRunFromSession({ sessionPath, testDocName: args.testDocName, testing: true })
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
      return shareFromSession(sessionPath)
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
    // AI : TODO (mcp-capability) — GUI ids with SpineSession methods but no MCP case yet:
    // AI :   documents.remove → removeDoc, quotes.link → linkQuotes, logging.hydrate → hydrateRunDetail,
    // AI :   docs/project bind → setDocProjects, assistant approve-to-run → executeProposedActions,
    // AI :   session pull/push → pullRemoteState/flushPendingSave, project.resync-examples → resyncExamples.
    // AI :   Host-bound (no session method): inference.stop, jobs.stop, inference.human-review.*,
    // AI :   inference.chatbot.send, inference.custom-code, share mint, Stripe, auth.sign-in.
    default:
      throw new Error(`unknown session_action id: ${id}`)
  }
}
