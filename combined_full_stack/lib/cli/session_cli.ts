// AI : CLI adapter over SpineSession — method names match useStore().

import { readFileSync } from "node:fs"
import { basename } from "node:path"
import { DocLabel, InputType } from "@/lib/types"
import {
  toAgentView,
  toBillingView,
  toCacheView,
  toDocsView,
  toEarningsView,
  toInferenceView,
  toLogsView,
  toMermaidView,
  toPipelineView,
  toSessionSummary,
  toSettingsView,
  toShareView,
  toStructureView,
  toTestingView,
  toValidationView,
} from "@/lib/core/view"
import { SESSION_ACTION_IDS } from "@/lib/core/actions"
import type { CliCommandResult } from "@/lib/cli/types"
import { openCliSession } from "@/lib/cli/session_open"
import {
  addModelField,
  addNamedModel,
  addPipelineStep,
  addTypeAlias,
  assignStepStructure,
  exportSessionPydantic,
  importSeed,
  listSeedIds,
  moveStep,
  parseAddableKind,
  parseFieldType,
  patchStep,
  removeModelField,
  removeStep,
  validateSessionTests,
} from "@/lib/cli/workspace_edits"

export const SPINE_SESSION_HELP = `session — headless workspace (same method names as useStore)

Usage:
  spine session list|snapshot|actions|seeds
  spine session add-project [--open]
  spine session open <id> | rename --name <name> | clone [id] | delete <id>
  spine session import-seed --file <seed.json|id>
  spine session set-docs --text <markdown>
  spine session add-model --name <Name>
  spine session add-field --model <Name> --name <field> --type <text|int|...> [--optional]
  spine session remove-field --model <Name> --name <field>
  spine session add-alias --name <Name> --expr <TypeExpr>
  spine session add-step --kind <llm|input|...> [--label <Label>]
  spine session patch-step --id <id|label> [--label] [--prompt] [--note]
  spine session assign-structure --id <id|label> --model <Name>
  spine session remove-step --id <id|label>
  spine session move-step --id <id|label> --at <index>
  spine session add-doc --name <file> --text <content> | --file <path>
  spine session docs | pipeline | mermaid | structure | pydantic | tests | logs
  spine session assign-input --module <id|label> --doc <name|id>
  spine session start-run | run-test [--file <*_testing.json>]
  spine session pull | push
  spine session billing | earnings | cache | share | settings
  spine session link-quotes --quote <text> --doc <name|id>
  spine session validate | set-model --model <id>

--offline  fail if a command would egress (local actions never do)
SPINE_API_URL / SPINE_API_TOKEN  HTTP egress for pull/push/start-run/billing
`

// AI : TODO (gui-parity) — CLI still lacks vs GUI:
// AI :   kind-specific patch-step fields (model, cache, webhook, parallel, chatbot, code)
// AI :   remove-doc / setDocProjects / binary upload; cloneFromTemplate HTTP; hydrateRunDetail
// AI :   share mint / hosted API / marketplace; billing checkout / withdraw; teams
// AI :   run cancel, human-review elicitation, Node custom-code host
// AI :   inference *_setup.json editor; testing visual editor + alignment

function ok(command: string, data: Record<string, unknown>): CliCommandResult {
  return { ok: true, command, issues: [], data }
}

function usage(message: string): CliCommandResult {
  return {
    ok: false,
    command: "usage",
    issues: [{ level: "error", where: "argv", message }],
    data: { help: SPINE_SESSION_HELP },
  }
}

export async function runSessionCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<CliCommandResult> {
  try {
    return await runSessionCommandInner(positional, flags)
  } catch (err) {
    return {
      ok: false,
      command: `session ${positional[1] ?? ""}`.trim(),
      issues: [{ level: "error", where: "session", message: err instanceof Error ? err.message : String(err) }],
    }
  }
}

async function runSessionCommandInner(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<CliCommandResult> {
  const sub = positional[1]
  if (!sub || sub === "help") {
    return { ok: true, command: "help", issues: [], data: { help: SPINE_SESSION_HELP } }
  }

  if (sub === "actions") {
    return ok("session actions", { actions: SESSION_ACTION_IDS })
  }

  const session = openCliSession(flags)

  if (sub === "list" || sub === "snapshot") {
    const snap = session.getSnapshot()
    return ok(`session ${sub}`, {
      summary: toSessionSummary(snap),
      pipeline: toPipelineView(snap),
      projects: snap.projects.map((p) => ({ id: p.id, name: p.name })),
    })
  }

  if (sub === "add-project") {
    const project = session.addProject({ open: flags.open !== false })
    return ok("session add-project", {
      action: "addProject",
      project: { id: project.id, name: project.name },
      summary: toSessionSummary(session.getSnapshot()),
    })
  }

  if (sub === "open") {
    const id = positional[2] ?? flagString(flags, "id")
    if (!id) return usage("session open requires <id>")
    session.openProject(id)
    return ok("session open", { action: "openProject", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "rename") {
    const name = flagString(flags, "name")
    const id = positional[2] ?? session.activeProjectId
    if (!name || !id) return usage("session rename requires --name and an active project")
    session.renameProject(id, name)
    return ok("session rename", { action: "renameProject", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "delete") {
    const id = positional[2] ?? flagString(flags, "id")
    if (!id) return usage("session delete requires <id>")
    session.deleteProject(id)
    return ok("session delete", { action: "deleteProject", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "clone") {
    const id = positional[2] ?? flagString(flags, "id") ?? session.activeProjectId
    if (!id) return usage("session clone requires an active project or <id>")
    const cloned = session.cloneProject(id, { open: flags.open !== false })
    return ok("session clone", {
      action: "cloneProject",
      project: { id: cloned.id, name: cloned.name },
      summary: toSessionSummary(session.getSnapshot()),
    })
  }

  if (sub === "seeds") {
    return ok("session seeds", { seeds: listSeedIds() })
  }

  if (sub === "import-seed") {
    const file = flagString(flags, "file") ?? positional[2]
    if (!file) return usage("session import-seed requires --file <seed.json|id>")
    const project = importSeed(session, file)
    return ok("session import-seed", {
      action: "ingestProject",
      project: { id: project.id, name: project.name },
      summary: toSessionSummary(session.getSnapshot()),
      pipeline: toPipelineView(session.getSnapshot()),
    })
  }

  if (sub === "set-docs") {
    const text = flagString(flags, "text")
    if (text == null) return usage("session set-docs requires --text")
    session.setDocumentation(text)
    return ok("session set-docs", { action: "setDocumentation", documentation: session.documentation })
  }

  if (sub === "add-model") {
    const name = flagString(flags, "name")
    if (!name) return usage("session add-model requires --name")
    addNamedModel(session, name)
    return ok("session add-model", {
      action: "applyProjectChanges",
      models: session.project?.models.map((m) => m.name) ?? [],
    })
  }

  if (sub === "add-field") {
    const model = flagString(flags, "model")
    const name = flagString(flags, "name")
    const typeRaw = flagString(flags, "type")
    if (!model || !name || !typeRaw) return usage("session add-field requires --model --name --type")
    const type = parseFieldType(typeRaw)
    if (!type) return usage(`unknown field type: ${typeRaw}`)
    addModelField(session, model, name, type, { optional: flags.optional === true })
    return ok("session add-field", { action: "applyProjectChanges", structure: toStructureView(session.getSnapshot()) })
  }

  if (sub === "remove-field") {
    const model = flagString(flags, "model")
    const name = flagString(flags, "name")
    if (!model || !name) return usage("session remove-field requires --model --name")
    removeModelField(session, model, name)
    return ok("session remove-field", { structure: toStructureView(session.getSnapshot()) })
  }

  if (sub === "add-alias") {
    const name = flagString(flags, "name")
    const expr = flagString(flags, "expr")
    if (!name || !expr) return usage("session add-alias requires --name --expr")
    addTypeAlias(session, name, expr)
    return ok("session add-alias", { structure: toStructureView(session.getSnapshot()) })
  }

  if (sub === "add-step") {
    const kindRaw = flagString(flags, "kind")
    if (!kindRaw) return usage("session add-step requires --kind")
    const kind = parseAddableKind(kindRaw)
    if (!kind) return usage(`unknown step kind: ${kindRaw}`)
    const added = addPipelineStep(session, kind, flagString(flags, "label"))
    return ok("session add-step", {
      action: "setModules",
      added: added.map((m) => ({ id: m.id, kind: m.kind, label: m.label })),
      pipeline: toPipelineView(session.getSnapshot()),
    })
  }

  if (sub === "patch-step") {
    const id = flagString(flags, "id") ?? positional[2]
    if (!id) return usage("session patch-step requires --id")
    const patch: { label?: string; prompt?: string; note?: string } = {}
    const label = flagString(flags, "label")
    const prompt = flagString(flags, "prompt")
    const note = flagString(flags, "note")
    if (label) patch.label = label
    if (prompt) patch.prompt = prompt
    if (note) patch.note = note
    const step = patchStep(session, id, patch)
    return ok("session patch-step", { step: { id: step.id, label: step.label, kind: step.kind } })
  }

  if (sub === "assign-structure") {
    const id = flagString(flags, "id") ?? positional[2]
    const model = flagString(flags, "model") ?? positional[3]
    if (!id || !model) return usage("session assign-structure requires --id and --model")
    const assigned = assignStepStructure(session, id, model)
    return ok("session assign-structure", {
      model: { id: assigned.id, name: assigned.name },
      pipeline: toPipelineView(session.getSnapshot()),
    })
  }

  if (sub === "remove-step") {
    const id = flagString(flags, "id") ?? positional[2]
    if (!id) return usage("session remove-step requires --id")
    removeStep(session, id)
    return ok("session remove-step", { pipeline: toPipelineView(session.getSnapshot()) })
  }

  if (sub === "move-step") {
    const id = flagString(flags, "id") ?? positional[2]
    const atRaw = flagString(flags, "at")
    if (!id || atRaw == null) return usage("session move-step requires --id --at")
    moveStep(session, id, Number(atRaw))
    return ok("session move-step", { pipeline: toPipelineView(session.getSnapshot()) })
  }

  if (sub === "add-doc") {
    const file = flagString(flags, "file")
    const text = flagString(flags, "text") ?? (file ? readFileSync(file, "utf8") : undefined)
    const name = flagString(flags, "name") ?? (file ? basename(file) : "note.txt")
    if (text == null) return usage("session add-doc requires --text or --file")
    const doc = session.addDoc({
      name,
      type: InputType.Text,
      content: text,
      label: DocLabel.Inference,
    })
    return ok("session add-doc", { action: "addDoc", doc })
  }

  if (sub === "validate") {
    const view = toValidationView(session.getSnapshot())
    return {
      ok: view.ok,
      command: "session validate",
      issues: view.issues.map((i) => ({ level: i.level, where: i.where, message: i.message })),
      data: { action: "validate", pipeline: toPipelineView(session.getSnapshot()) },
    }
  }

  if (sub === "docs") {
    return ok("session docs", { docs: toDocsView(session.getSnapshot()) })
  }

  if (sub === "structure") {
    return ok("session structure", { structure: toStructureView(session.getSnapshot()) })
  }

  if (sub === "pydantic" || sub === "export") {
    const pydantic = exportSessionPydantic(session)
    return ok("session pydantic", { pydantic, human: pydantic, action: "exportPipeline" })
  }

  if (sub === "pipeline") {
    const snap = session.getSnapshot()
    return ok("session pipeline", {
      pipeline: toPipelineView(snap),
      validation: toValidationView(snap),
      mermaid: toMermaidView(snap),
    })
  }

  if (sub === "mermaid") {
    const chart = toMermaidView(session.getSnapshot())
    return ok("session mermaid", { mermaid: chart, human: chart })
  }

  if (sub === "tests") {
    if (flags.run === true) {
      const run = await session.runTest(flagString(flags, "file"))
      return ok("session tests", { action: "runTest", run: { id: run.id, status: run.status } })
    }
    return validateSessionTests(session)
  }

  if (sub === "logs") {
    return ok("session logs", { logs: toLogsView(session.getSnapshot()), agent: toAgentView(session.getSnapshot()) })
  }

  if (sub === "assign-input") {
    const moduleKey = flagString(flags, "module")
    const docKey = flagString(flags, "doc")
    if (!moduleKey || !docKey) return usage("session assign-input requires --module and --doc")
    const mod = session.modules.find((m) => m.id === moduleKey || m.label === moduleKey)
    const doc = session.docs.find((d) => d.id === docKey || d.name === docKey)
    if (!mod) return usage(`unknown module: ${moduleKey}`)
    if (!doc) return usage(`unknown doc: ${docKey}`)
    session.setInferenceInputDocIds({ ...session.getSnapshot().inferenceInputDocIds, [mod.id]: doc.id })
    return ok("session assign-input", { inference: toInferenceView(session.getSnapshot()) })
  }

  if (sub === "start-run") {
    const run = await session.startRun()
    return ok("session start-run", { action: "startRun", run: { id: run.id, status: run.status } })
  }

  if (sub === "run-test") {
    const run = await session.runTest(flagString(flags, "file"))
    return ok("session run-test", { action: "runTest", run: { id: run.id, status: run.status } })
  }

  if (sub === "pull") {
    await session.pullRemoteState()
    return ok("session pull", { summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "push") {
    await session.flushPendingSave()
    return ok("session push", { action: "flushPendingSave", summary: toSessionSummary(session.getSnapshot()) })
  }

  if (sub === "billing") {
    if (session.egress && !session.egress.blocked) await session.refreshBilling()
    return ok("session billing", { billing: toBillingView(session.getSnapshot()), action: "billing" })
  }

  if (sub === "earnings") {
    if (session.egress && !session.egress.blocked) await session.refreshEarnings()
    return ok("session earnings", { earnings: toEarningsView(session.getSnapshot()) })
  }

  if (sub === "cache") {
    return ok("session cache", { cache: toCacheView(session.getSnapshot()), action: "cacheGet" })
  }

  if (sub === "share") {
    return ok("session share", { share: toShareView(session.getSnapshot()), action: "shareLink" })
  }

  if (sub === "settings") {
    const model = flagString(flags, "model")
    if (model) session.setModel(model)
    return ok("session settings", { settings: toSettingsView(session.getSnapshot()) })
  }

  if (sub === "set-model") {
    const model = flagString(flags, "model") ?? positional[2]
    if (!model) return usage("session set-model requires --model")
    session.setModel(model)
    return ok("session set-model", { settings: toSettingsView(session.getSnapshot()) })
  }

  if (sub === "link-quotes") {
    const quote = flagString(flags, "quote")
    const docKey = flagString(flags, "doc")
    if (!quote || !docKey) return usage("session link-quotes requires --quote and --doc")
    const snap = session.getSnapshot()
    const doc = snap.docs.find((d) => d.id === docKey || d.name === docKey)
    if (!doc) return usage(`unknown doc: ${docKey}`)
    const sourceText = flagString(flags, "text") ?? snap.docContents[doc.id]
    if (!sourceText) return usage(`no content for doc: ${doc.name}`)
    const linked = session.linkQuotes({ quote, sourceText, docId: doc.id })
    return ok("session link-quotes", { action: "linkQuotes", quote: linked })
  }

  if (sub === "testing-view") {
    return ok("session testing-view", { testing: toTestingView(session.getSnapshot()) })
  }

  return usage(`unknown session command: ${sub}`)
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key]
  return typeof v === "string" ? v : undefined
}
