#!/usr/bin/env node
// AI : Spine MCP — GUI-equivalent *actions* on SpineSession + Testing-tab pinpoint. Not a live UI view.
// AI : TODO (mcp-tools) — shrink to ~8 vibe tools; session_action duplicates named tools and agents pick the wrong one.
// AI : DONE (mcp-errors) — wrapTool returns { ok:false, code, next } with isError instead of throwing (JSON.parse of proposalJson).
// AI : TODO (mcp-workspace) — one project handle: session pull/push vs seeds vs GUI Supabase currently diverge.
// AI : TODO (mcp-capability) — wrap remaining GUI verbs: pullRemoteState, flushPendingSave,
// AI :   linkQuotes, setDocProjects, executeProposedActions, resyncExamples,
// AI :   billed ask HTTP, share/hosted mint, Stripe, run cancel. Host-bound stays GUI: CodeHost, human-review, chatbot.

import { resolve } from "node:path"
import "./bootstrap-env.js"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import {
  compareRunToTestReport,
  listProjectTests,
  parseTestFileCommand,
  pinpointFailure,
  validateTestFile,
} from "./spine-pinpoint.js"
import {
  deriveStepPrompt,
  describePipelineSteps,
  exportPydanticProject,
  inspectIdsFromSeed,
  lintPipelineFromInput,
  validatePipelineWiring,
  validateStepOutputValue,
} from "./spine-step-models.js"
import {
  addDocFromSession,
  addModelFromSession,
  addProjectFromSession,
  addStepFromSession,
  applyPendingProposalFromSession,
  applyProjectChangesFromSession,
  askAgentFromSession,
  assignInputFromSession,
  authStatusFromSession,
  cloneProjectFromSession,
  configureN8nStepFromSession,
  deleteProjectFromSession,
  getProjectFromSession,
  getRunFromSession,
  importSeedFromSession,
  inspectIdsFromSession,
  lintProjectFromSession,
  listSeedsForMcp,
  openProjectFromSession,
  pinpointFailureFromSession,
  removeDocFromSession,
  renameProjectFromSession,
  runSessionAction,
  sessionLogs,
  setDocsFromSession,
  startRunFromSession,
  validateProjectFromSession,
  waitForRunFromSession,
} from "./spine-session-bar-a.js"
import { registerSpinePrompts, SPINE_MCP_INSTRUCTIONS } from "./agent-playbook.js"
import {
  exportPieceToDisk,
  importPieceJson,
  listPiecesForMcp,
} from "@/lib/n8n-share"

const REPO_ROOT = process.env.SPINE_REPO_ROOT ?? resolve(process.cwd(), "..")
const APP_ROOT = process.env.SPINE_APP_ROOT ?? resolve(REPO_ROOT, "combined_full_stack")

function textContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

function nextHint(error: string): string {
  if (/not valid JSON|JSON\.parse|session file is not valid JSON/i.test(error)) return "Pass proposalJson as a JSON object string, or omit it to apply the pending Vibe proposal. If the session file is corrupt, delete it and call add_project."
  if (/unknown step kind/i.test(error)) return "Use add_step kind from: input, llm, llm-batch, fork, n8n, custom-code, webhook, … — list_pieces for n8n types."
  if (/unknown n8n piece|unknown piece/i.test(error)) return "Call list_pieces and use n8nNodeType exactly."
  if (/no active project/i.test(error)) return "Call add_project (or import_seed file from list_seeds) then retry."
  if (/no pending proposal/i.test(error)) return "ask_agent first, poll get_project until pendingProposal is set, then apply_project_changes with no proposalJson."
  if (/unknown step /i.test(error)) return "get_project and use the step id or label."
  if (/401|sign in required/i.test(error)) return "start_run needs a signed-in API. Local npm run dev without Supabase works. Remote: set SPINE_API_TOKEN to a Supabase access token, then retry."
  if (/SPINE_API_URL|remote action|not reachable|timed out talking/i.test(error)) return "Start combined_full_stack (`npm run dev`) so http://127.0.0.1:3000 responds, then start_run → wait_for_run. Production also needs SPINE_API_TOKEN."
  if (/ECONNREFUSED|fetch failed|Failed to parse URL|ENOTFOUND|network|EgressBlocked|AbortError|aborted/i.test(error)) return "The Next app is not reachable at http://127.0.0.1:3000. Start combined_full_stack with npm run dev, then retry start_run."
  if (/no run to wait for/i.test(error)) return "Call start_run or run_test first, then wait_for_run with that run id."
  if (/seed not found/i.test(error)) return "Call list_seeds (or auth_status.seeds) and pass import_seed file as one of those ids — no path, no .json suffix required."
  if (/projectSeedPath or pipelineJson/i.test(error)) return "Call lint_pipeline with no args to lint the active session project, or pass a seed id from list_seeds as projectSeedPath."
  if (/testDocName required|unknown test doc|provide projectSeedPath/i.test(error)) return "session_logs.tests lists *_testing.json names. Call pinpoint_failure with testDocName plus runJson from wait_for_run."
  if (/unknown module|unknown doc/i.test(error)) return "get_project for step labels; session_logs for document names."
  if (/parametersJson must be/i.test(error)) return "Pass parametersJson as a JSON object string, e.g. {\"maxItems\":5}."
  return "Call auth_status, then get_project. Follow the next field. Do not re-send the same crashing payload."
}

function mcpError(err: unknown, code = "tool_error") {
  const error = err instanceof Error ? err.message : String(err)
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: JSON.stringify({ ok: false, code, error, next: nextHint(error) }, null, 2) }],
  }
}

function wrapTool<Args>(fn: (args: Args) => unknown | Promise<unknown>) {
  return async (args: Args) => {
    try {
      return textContent(await fn(args))
    } catch (err) {
      return mcpError(err)
    }
  }
}

const runSourceSchema = {
  runPath: z
    .string()
    .optional()
    .describe("Path to a pipeline run JSON file (from Logging export or /api/runs)"),
  runJson: z
    .string()
    .optional()
    .describe("Inline pipeline run JSON when runPath is not set"),
}

const server = new McpServer(
  {
    name: "spine-pinpoint",
    version: "0.1.0",
  },
  { instructions: SPINE_MCP_INSTRUCTIONS },
)

server.tool(
  "pinpoint_failure",
  "Compare a finished pipeline run against a *_testing.json file and return the first diverging step. Prefer session mode: testDocName from session_logs.tests + runJson from wait_for_run. Seed paths are only for bundled templates (list_seeds).",
  {
    projectSeedPath: z.string().optional().describe("Path or list_seeds id — omit when using the session"),
    testFilePath: z.string().optional().describe("Filesystem path to *_testing.json — omit when using testDocName"),
    testDocName: z.string().optional().describe("Session *_testing.json name from session_logs.tests"),
    sessionPath: z.string().optional(),
    ...runSourceSchema,
  },
  wrapTool((args) => {
    if (args.testDocName || (!args.projectSeedPath && !args.testFilePath)) {
      return pinpointFailureFromSession(
        {
          sessionPath: args.sessionPath,
          testDocName: args.testDocName,
          runPath: args.runPath,
          runJson: args.runJson,
        },
        REPO_ROOT,
      )
    }
    if (!args.projectSeedPath || !args.testFilePath) {
      throw new Error("provide projectSeedPath+testFilePath (seeds) or testDocName from session_logs.tests")
    }
    return pinpointFailure(
      {
        projectSeedPath: args.projectSeedPath,
        testFilePath: args.testFilePath,
        runPath: args.runPath,
        runJson: args.runJson,
      },
      REPO_ROOT,
    )
  }),
)

server.tool(
  "compare_run_to_test",
  "Full per-step deterministic comparison between a run and a test file. Returns every pinned step status plus failure field records.",
  {
    projectSeedPath: z.string(),
    testFilePath: z.string(),
    ...runSourceSchema,
  },
  wrapTool((args) => compareRunToTestReport(args, REPO_ROOT)),
)

server.tool(
  "validate_test",
  "Validate a *_testing.json file against the current pipeline (labels, types, inputs) — same rules as the Testing tab.",
  {
    projectSeedPath: z.string(),
    testFilePath: z.string(),
  },
  wrapTool((args) => validateTestFile(args, REPO_ROOT)),
)

server.tool(
  "parse_test",
  "Parse a *_testing.json file without a project context.",
  {
    testFilePath: z.string(),
  },
  wrapTool((args) => parseTestFileCommand(args.testFilePath, REPO_ROOT)),
)

server.tool(
  "list_project_tests",
  "List all *_testing.json files referenced by a project seed.",
  {
    projectSeedPath: z.string(),
  },
  wrapTool((args) => ({ tests: listProjectTests(args.projectSeedPath, REPO_ROOT) })),
)

server.tool(
  "describe_pipeline_steps",
  "Break a *seed* pipeline into per-step pydantic models (not the session file). Filter with stepLabel to inspect one step. For the session project, edit with add_step / session_action instead.",
  {
    projectSeedPath: z.string(),
    stepLabel: z.string().optional().describe("Optional step label — omit to list all steps"),
  },
  wrapTool((args) => describePipelineSteps(args, REPO_ROOT)),
)

server.tool(
  "validate_step_output",
  "Validate a JSON value against a step's pydantic / pipeline-state schema — same rules as runtime step output validation.",
  {
    projectSeedPath: z.string(),
    stepLabel: z.string(),
    valueJson: z.string().describe("JSON value to validate as this step's output"),
  },
  wrapTool((args) => validateStepOutputValue(args, REPO_ROOT)),
)

server.tool(
  "derive_step_prompt",
  "Derive the structured LLM prompt for an llm or llm-batch step (user prompt + JSON Schema suffix). Optional sampleInputJson fills the input block.",
  {
    projectSeedPath: z.string(),
    stepLabel: z.string(),
    sampleInputJson: z.string().optional(),
  },
  wrapTool((args) => deriveStepPrompt(args, REPO_ROOT)),
)

server.tool(
  "validate_pipeline_wiring",
  "Check series-parallel spine I/O validity across all steps (including Fork lanes) — same computeInvalid rules as the pipeline editor.",
  {
    projectSeedPath: z.string(),
  },
  wrapTool((args) => validatePipelineWiring(args, REPO_ROOT)),
)

server.tool(
  "lint_pipeline",
  "Lint a pipeline: omit args to lint the active session project (graph). Pass projectSeedPath (list_seeds id) or pipelineJson for a seed. Set includeExport true to also tsc the generated TypeScript export.",
  {
    sessionPath: z.string().optional(),
    projectSeedPath: z.string().optional().describe("Path or list_seeds id to a seeds/*.json project file"),
    pipelineJson: z.string().optional().describe("Inline pipeline JSON ({ models, modules, typeAliases? })"),
    includeExport: z.boolean().optional().describe("Run tsc on generated pipeline.ts (default false for session, true for seeds)"),
  },
  wrapTool((args) => {
    if (!args.projectSeedPath && !args.pipelineJson) {
      return lintProjectFromSession(args.sessionPath, args.includeExport ?? false)
    }
    return lintPipelineFromInput(
      {
        projectSeedPath: args.projectSeedPath,
        pipelineJson: args.pipelineJson,
        includeExport: args.includeExport,
      },
      REPO_ROOT,
    )
  }),
)

server.tool(
  "export_pydantic",
  "Export all structure models as pydantic Python plus generated per-step pipeline signatures, schema.sql, and branded id types.",
  {
    projectSeedPath: z.string(),
    includePipelineSignatures: z.boolean().optional().describe("Include generated step function stubs (default true)"),
  },
  wrapTool((args) => exportPydanticProject(args, REPO_ROOT)),
)

server.tool(
  "inspect_ids",
  "Load JSON/Excel docs into the project's SQL schema and list branded row ids (missing pk, unused pk, duplicate pk). Seed path or session path — not both required.",
  {
    projectSeedPath: z.string().optional().describe("Path to seeds/*.json"),
    sessionPath: z.string().optional(),
    idType: z.string().optional().describe("work_item_id_string or WorkItem.id"),
    docName: z.string().optional(),
    filter: z.enum(["all", "missing", "unused", "duplicate"]).optional(),
  },
  wrapTool((args) => {
    if (args.projectSeedPath) {
      return inspectIdsFromSeed(
        {
          projectSeedPath: args.projectSeedPath,
          idType: args.idType,
          docName: args.docName,
          filter: args.filter,
        },
        REPO_ROOT,
      )
    }
    return inspectIdsFromSession({
      sessionPath: args.sessionPath,
      idType: args.idType,
      docName: args.docName,
      filter: args.filter,
    })
  }),
)

server.tool(
  "auth_status",
  "First call after connect. Returns session path, projects, bundled seed ids, and whether start_run can reach the local Next app. Do not read the repo.",
  { sessionPath: z.string().optional() },
  wrapTool((args) => authStatusFromSession(args.sessionPath)),
)

server.tool(
  "list_seeds",
  "List bundled template ids for import_seed. No repo browsing — pass file as one of these ids (e.g. lead_enrich_n8n).",
  {},
  wrapTool(() => listSeedsForMcp()),
)

server.tool(
  "get_project",
  "Active session project review: kind, field types, inputType, docs, pendingProposal. Same SpineSession as CLI.",
  {
    sessionPath: z.string().optional().describe("Path to .spine-session.json (or SPINE_SESSION_PATH)"),
  },
  wrapTool((args) => getProjectFromSession(args.sessionPath)),
)

server.tool(
  "validate_project",
  "Validate the active session project — same computeInvalid / structure rules as the GUI.",
  {
    sessionPath: z.string().optional(),
  },
  wrapTool((args) => validateProjectFromSession(args.sessionPath)),
)

server.tool(
  "apply_project_changes",
  "Apply a ProjectProposal (or the pending Vibe proposal) onto the session file — same as GUI Approve.",
  {
    sessionPath: z.string().optional(),
    proposalJson: z.string().optional().describe("JSON ProjectProposal; omit to apply the pending Vibe proposal"),
  },
  wrapTool((args) =>
    args.proposalJson
      ? applyProjectChangesFromSession(JSON.parse(args.proposalJson), args.sessionPath)
      : applyPendingProposalFromSession(args.sessionPath),
  ),
)

server.tool(
  "start_run",
  "POST /api/runs for the active session project (GUI Run). Local default is http://127.0.0.1:3000. Returns {id,status} immediately — then wait_for_run until terminal.",
  {
    sessionPath: z.string().optional(),
    testDocName: z.string().optional(),
    testing: z.boolean().optional(),
  },
  wrapTool((args) => startRunFromSession(args)),
)

server.tool(
  "run_test",
  "Start a Testing-tab run for the active session project (GUI Testing → Run). Local default is http://127.0.0.1:3000. Returns immediately; call wait_for_run with the run id.",
  {
    sessionPath: z.string().optional(),
    testDocName: z.string().optional(),
  },
  wrapTool((args) => startRunFromSession({ ...args, testing: true })),
)

server.tool(
  "wait_for_run",
  "Poll GET /api/runs/:id until ok/error or timeout. Use after start_run/run_test. Terminal result includes runJson for pinpoint_failure.",
  {
    sessionPath: z.string().optional(),
    runId: z.string().optional().describe("Run id from start_run; omit to wait on the latest session run"),
    timeoutMs: z.number().optional().describe("Max wait 1s–90s (default 45s). If timedOut, call again."),
  },
  wrapTool((args) => waitForRunFromSession(args)),
)

server.tool(
  "get_run",
  "Return the latest (or specified) session run plus runJson for pinpoint_failure. Call wait_for_run first if the run is still running.",
  {
    sessionPath: z.string().optional(),
    runId: z.string().optional(),
  },
  wrapTool((args) => getRunFromSession(args)),
)

server.tool(
  "session_logs",
  "List local session runs, cache entries, inference docs, and *_testing.json files.",
  {
    sessionPath: z.string().optional(),
  },
  wrapTool((args) => sessionLogs(args.sessionPath)),
)

server.tool(
  "session_action",
  "Dispatch a GUI button id (data-spine-id) against the session file. Prefer named tools when they exist. Extra ids: structure.add-field/remove-field/set-relation/add-alias, pipeline.configure-step/remove-step/assign-structure, assistant.reject, billing.refresh, earnings.refresh, cache.refresh, logging.errors-only, logging.hydrate / wait_for_run.",
  {
    id: z.string().describe("Parity catalog id, e.g. project.add, testing.run, assistant.send"),
    sessionPath: z.string().optional(),
    name: z.string().optional(),
    projectId: z.string().optional(),
    file: z.string().optional(),
    kind: z.string().optional(),
    label: z.string().optional(),
    model: z.string().optional(),
    type: z.string().optional(),
    optional: z.boolean().optional(),
    expr: z.string().optional(),
    params: z.string().optional(),
    stepId: z.string().optional(),
    prompt: z.string().optional(),
    note: z.string().optional(),
    content: z.string().optional(),
    text: z.string().optional(),
    module: z.string().optional(),
    doc: z.string().optional(),
    message: z.string().optional(),
    proposalJson: z.string().optional(),
    testDocName: z.string().optional(),
    testing: z.boolean().optional(),
    relation: z.string().optional().describe("structure.set-relation: pk | none | WorkItem.id"),
    forkId: z.string().optional(),
    branchId: z.string().optional(),
    forkJoin: z.string().optional().describe("pipeline.configure-step on a fork: product | assemble | merge"),
    runId: z.string().optional(),
    timeoutMs: z.number().optional(),
  },
  wrapTool(async (args) => runSessionAction(args)),
)

server.tool(
  "add_project",
  "Create a blank project in the session file — same as GUI New project / session.addProject.",
  { sessionPath: z.string().optional() },
  wrapTool((args) => addProjectFromSession(args.sessionPath)),
)

server.tool(
  "rename_project",
  "Rename a project in the session file.",
  {
    sessionPath: z.string().optional(),
    id: z.string().optional(),
    name: z.string(),
  },
  wrapTool((args) => renameProjectFromSession(args.name, args.id, args.sessionPath)),
)

server.tool(
  "delete_project",
  "Delete a project from the session file.",
  { sessionPath: z.string().optional(), id: z.string() },
  wrapTool((args) => deleteProjectFromSession(args.id, args.sessionPath)),
)

server.tool(
  "open_project",
  "Set the active project in the session file.",
  { sessionPath: z.string().optional(), id: z.string() },
  wrapTool((args) => openProjectFromSession(args.id, args.sessionPath)),
)

server.tool(
  "clone_project",
  "Clone a project in the session file.",
  { sessionPath: z.string().optional(), id: z.string().optional() },
  wrapTool((args) => cloneProjectFromSession(args.id, args.sessionPath)),
)

server.tool(
  "import_seed",
  "Ingest a bundled seed into the session — same as GUI Clone template. file is a list_seeds id (e.g. lead_enrich_n8n), not a filesystem path.",
  { sessionPath: z.string().optional(), file: z.string() },
  wrapTool((args) => importSeedFromSession(args.file, args.sessionPath)),
)

server.tool(
  "add_model",
  "Add a named structure model (press m in the TUI).",
  { sessionPath: z.string().optional(), name: z.string(), params: z.string().optional() },
  wrapTool((args) => addModelFromSession(args.name, args.sessionPath, args.params)),
)

server.tool(
  "add_step",
  "Insert a pipeline step (press s in the TUI).",
  {
    sessionPath: z.string().optional(),
    kind: z.string().describe("llm | input | combine | fork | n8n | chunk | …"),
    label: z.string().optional(),
    forkId: z.string().optional().describe("Fork step id when inserting into a lane"),
    branchId: z.string().optional().describe("Lane id or label when inserting into a Fork"),
  },
  wrapTool((args) => addStepFromSession(args.kind, args.label, args.sessionPath, { forkId: args.forkId, branchId: args.branchId })),
)

server.tool(
  "add_doc",
  "Add a text document to the session (GUI Documents upload for text).",
  {
    sessionPath: z.string().optional(),
    name: z.string(),
    content: z.string(),
  },
  wrapTool((args) => addDocFromSession(args)),
)

server.tool(
  "remove_doc",
  "Remove a document from the session by name or id (GUI Documents delete).",
  {
    sessionPath: z.string().optional(),
    doc: z.string().describe("Document name or id from get_project / session_logs"),
  },
  wrapTool((args) => removeDocFromSession(args.doc, args.sessionPath)),
)

server.tool(
  "set_docs",
  "Set project markdown docs (Docs tab / press w).",
  { sessionPath: z.string().optional(), text: z.string() },
  wrapTool((args) => setDocsFromSession(args.text, args.sessionPath)),
)

server.tool(
  "assign_input",
  "Assign a document to an Input step — same as Inference slot picker. Rejects wrong type / name mismatch.",
  {
    sessionPath: z.string().optional(),
    module: z.string(),
    doc: z.string(),
  },
  wrapTool((args) => assignInputFromSession(args.module, args.doc, args.sessionPath)),
)

server.tool(
  "ask_agent",
  "GUI Send: Vibe/structure/testing/diagnosis. Returns data.proposal (fields, inputType, docs). Then apply_project_changes to Approve (or session_action assistant.reject).",
  {
    sessionPath: z.string().optional(),
    message: z.string(),
    kind: z.string().optional().describe("vibe | structure | testing | diagnosis"),
  },
  wrapTool((args) => askAgentFromSession(args.message, args.sessionPath, args.kind)),
)

server.tool(
  "list_pieces",
  "List typed n8n/Activepieces-style catalog pieces (Set, Filter, CSV, …). Local Code-node JS — no live Slack/Gmail. Use before add_step kind=n8n.",
  {},
  wrapTool(() => ({ pieces: listPiecesForMcp(APP_ROOT) })),
)

server.tool(
  "import_piece",
  "Import a shareable piece JSON (id, n8nNodeType, props, n8nCode) into combined_full_stack/pieces and the live catalog.",
  {
    json: z.string().describe("Shareable piece JSON"),
  },
  wrapTool((args) => ({ piece: importPieceJson(APP_ROOT, args.json) })),
)

server.tool(
  "export_piece",
  "Write a catalog piece to combined_full_stack/pieces/<id>.json so others can import it.",
  {
    n8nNodeType: z.string().describe("Catalog id, e.g. n8n-nodes-base.set"),
  },
  wrapTool((args) => exportPieceToDisk(APP_ROOT, args.n8nNodeType)),
)

server.tool(
  "configure_n8n_step",
  "Set n8nNodeType, parameters, and optional Code-node JS on an n8n step. Auto UI is generated from the piece props schema.",
  {
    sessionPath: z.string().optional(),
    stepId: z.string().describe("Step id or label"),
    n8nNodeType: z.string().optional(),
    parametersJson: z.string().optional().describe("JSON object of piece params"),
    n8nCode: z.string().optional().describe("Optional n8n Code-node JS override"),
  },
  wrapTool((args) => configureN8nStepFromSession(args)),
)

registerSpinePrompts(server)

// AI : auth_status is the connect probe; Bearer SPINE_API_TOKEN is accepted by requireAuth().

async function main() {
  // AI : JSON-RPC is stdout — npm banners and console.log break Cursor's handshake.
  console.log = console.error
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
