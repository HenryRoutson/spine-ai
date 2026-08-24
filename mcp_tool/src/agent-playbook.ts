// AI : MCP instructions + prompts — agents get GUI-equivalent *actions*, not a live UI view.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const SPINE_MCP_INSTRUCTIONS = `Spine MCP — schema-first pipeline builder (typed n8n + auto UI). You do not see the browser. Do not clone, search, or read the repo unless a tool fails.

WHAT SPINE IS
Spine sits on top of n8n-class automation with Pydantic/Zod structures. You define models, wire steps, generate the inference form automatically, run golden tests, then share a drag-and-drop page. Data between steps is typed. n8n pieces run local Code-node JavaScript against that type — they do NOT call Slack/Gmail/HTTP live. Webhook is the generic HTTP escape hatch. Pieces are shareable JSON (list_pieces / import_piece / export_piece).

CONNECT (Claude Code / Cursor — no codebase required)
From the Spine repo: claude mcp add spine -- node "$PWD/mcp_tool/spine-mcp.mjs"
Or commit .mcp.json { "mcpServers": { "spine": { "command": "node", "args": ["mcp_tool/spine-mcp.mjs"] } } }
Cursor: .cursor/mcp.json command node + args [absolute path to mcp_tool/spine-mcp.mjs]. The launcher sets SPINE_* paths itself. Local runs default to http://127.0.0.1:3000 (start combined_full_stack with npm run dev).
You are already connected if you can call tools. First tool: auth_status. Then get_project. Follow each tool's next field.

WORKSPACES — never mix:
- Session tools mutate .spine-session.json (omit sessionPath). This is the editable project. Prefer these.
- Bundled templates: list_seeds → import_seed file=<id>. Seed-path tools are optional; lint_pipeline with no args lints the session. pinpoint_failure uses testDocName from session_logs.tests + runJson from wait_for_run.
- Signed-in GUI uses Supabase cookies. MCP start_run sends SPINE_API_TOKEN as Bearer (Supabase access token). Local npm run dev does not need a token.

DEFAULT LOOP
1. auth_status — session path, projects, seeds, canRun. Follow next.
2. get_project — compact review plus next (apply pending proposal, fix issues, or run). If no active project, add_project or import_seed.
3. validate_project — same computeInvalid as the pipeline editor. lint_pipeline with no args for graph lint.
4. Change: ask_agent (kind vibe|structure|testing|diagnosis) → poll get_project if inFlight (do NOT re-send). If assistantError appears, fix from that text. Then apply_project_changes, OR edit with add_step / add_model / add_doc / remove_doc / assign_input / set_docs / configure_n8n_step / session_action structure.add-field.
5. run_test or start_run. Returns {id,status} immediately — then wait_for_run until ok/error (or timedOut; call again). wait_for_run / get_run include runJson.
6. Finished run: pinpoint_failure({ testDocName, runJson }) using session_logs.tests and wait_for_run JSON.

TYPED N8N PIECES (no live integrations)
list_pieces → add_step kind=n8n → configure_n8n_step (nodeType + parametersJson + optional n8nCode).
Catalog: n8n-nodes-base.set | filter | sort | limit | removeDuplicates | itemLists | crypto | dateTime | html | markdown | spreadsheetFile | code.
Each piece has a props schema → the GUI auto-generates the form. n8nCode is n8n Code-node JS: items = [{json}], return items. Prefer a catalog piece over custom-code. import_piece / export_piece share JSON.

FORK DAG
Pipelines are series-parallel. add_step kind=fork, then add_step with forkId + branchId into a lane. Nest another fork in a lane for a generic DAG (no cycles). Join: product | assemble | merge via session_action pipeline.configure-step forkJoin. get_project.steps[].branches shows the tree.

STEP KINDS
input, llm, llm-batch, example-select, transform, chunk, merge, assemble, fork, combine, custom-code, assert, human-review, webhook, n8n, chatbot, output.
Aliases: code→custom-code, http→webhook, piece→n8n, dag→fork. Case-insensitive.

NAMED TOOLS vs session_action:
Prefer named tools. session_action id is the GUI data-spine-id. Extra ids: structure.add-field/remove-field/set-relation/add-alias, pipeline.configure-step/remove-step/assign-structure, assistant.reject, documents.remove, billing.refresh, earnings.refresh, cache.refresh, logging.errors-only.

ERRORS: tools return {ok:false, code, error, next} with isError instead of crashing. Follow next. Never retry the same crashing payload.

NOT TOOLS YET: quotes.link, session pull/push, run cancel, share/hosted-api/embed mint, Stripe, human-review click, chatbot turn, custom-code (browser CodeHost), live n8n Cloud execute.`

function userMessage(text: string) {
  return { messages: [{ role: "user" as const, content: { type: "text" as const, text } }] }
}

export function registerSpinePrompts(server: McpServer): void {
  server.registerPrompt(
    "vibe_loop",
    {
      title: "Spine vibe loop",
      description: "Edit the session project the way a human uses Vibe: inspect, ask, apply, test.",
      argsSchema: { goal: z.string().describe("What to change or fix in the active session project") },
    },
    ({ goal }) =>
      userMessage(
        `Goal: ${goal}\n\nFollow Spine MCP instructions. Loop: auth_status → get_project → validate_project → ask_agent (kind=vibe unless this is clearly structure/testing/diagnosis). If ask_agent times out, poll get_project until pendingProposal or assistantError appears (do not re-ask). Then apply_project_changes (or session_action assistant.reject) → validate_project again → run_test if auth_status.canRun, then wait_for_run. Use session tools (lint_pipeline with no args, pinpoint_failure with testDocName) unless importing a list_seeds template.`,
      ),
  )

  server.registerPrompt(
    "fix_test",
    {
      title: "Fix a failing Spine test",
      description: "Isolate the first diverging step, then patch the session project and re-run.",
      argsSchema: {
        testFilePath: z.string().describe("Path to the *_testing.json file"),
        projectSeedPath: z.string().describe("Path to the matching seeds/*.json (pinpoint reads seeds, not the session file)"),
        runPath: z.string().optional().describe("Finished pipeline run JSON path; omit if you only have inline runJson later"),
      },
    },
    ({ testFilePath, projectSeedPath, runPath }) =>
      userMessage(
        `Failing test: ${testFilePath}\nSeed: ${projectSeedPath}${runPath ? `\nRun JSON: ${runPath}` : ""}\n\nFollow Spine MCP instructions. Prefer pinpoint_failure with testDocName + runJson from wait_for_run when the test lives on the session (session_logs.tests). Seed paths are for bundled templates from list_seeds. Then ask_agent kind=testing or kind=diagnosis with the isolated diffs, apply_project_changes, validate_project, run_test, wait_for_run.`,
      ),
  )

  server.registerPrompt(
    "add_pipeline_step",
    {
      title: "Add a pipeline step",
      description: "Insert and configure a step on the session project without asking Vibe.",
      argsSchema: {
        kind: z.string().describe("Step kind: llm | input | combine | fork | n8n | chunk | …"),
        purpose: z.string().describe("What this step should do (label, prompt, structure)"),
      },
    },
    ({ kind, purpose }) =>
      userMessage(
        `Add a ${kind} step: ${purpose}\n\nFollow Spine MCP instructions. auth_status → get_project → add_step (or session_action pipeline.add-step) → session_action pipeline.configure-step / pipeline.assign-structure / configure_n8n_step as needed → validate_project. For kind=n8n, list_pieces first. For kind=fork, add_step into lanes with forkId + branchId. Do not call seed tools on the session file.`,
      ),
  )

  server.registerPrompt(
    "connect_spine",
    {
      title: "Connect to Spine without the codebase",
      description: "How a Claude Code / Cursor agent should attach this MCP and start building typed pipelines.",
    },
    () =>
      userMessage(
        `You are connected to Spine MCP. Do not clone or search the repo.\n\n1. auth_status — follow next (add_project if projectCount is 0, or import_seed from seeds).\n2. get_project — follow next (apply, reject, or edit).\n3. Add Pydantic-like structures with add_model + session_action structure.add-field (name, type).\n4. Wire steps: input → (fork lanes and/or n8n pieces and/or llm) → output. add_step kinds are listed in server instructions.\n5. validate_project until ok. lint_pipeline with no args for graph lint.\n6. Auto UI is the inference page from those structures — you do not hand-write forms.\n7. If auth_status.canRun, start_run then wait_for_run. pinpoint_failure uses testDocName + runJson.\nShare an n8n piece with export_piece; import someone else's with import_piece.\nNever call live Slack/Gmail. n8n pieces run local Code-node JS with typed in/out.`,
      ),
  )

  server.registerPrompt(
    "n8n_piece",
    {
      title: "Add a typed n8n piece",
      description: "Pick a catalog piece, type the spine, auto-generate the param form.",
      argsSchema: {
        purpose: z.string().describe("What the piece should do (set fields, filter, parse CSV, …)"),
      },
    },
    ({ purpose }) =>
      userMessage(
        `Purpose: ${purpose}\n\nlist_pieces → pick n8nNodeType → add_step kind=n8n → configure_n8n_step with parametersJson matching props → pipeline.assign-structure for typed in/out → validate_project. Optional n8nCode is n8n Code-node JS (items/json). Do not hit vendor APIs.`,
      ),
  )

  server.registerPrompt(
    "fork_dag",
    {
      title: "Build a fork DAG",
      description: "Non-linear series-parallel pipeline using Fork lanes (nested forks allowed).",
      argsSchema: {
        lanes: z.string().describe("Comma-separated lane purposes, e.g. hash id, set fields, filter empty"),
      },
    },
    ({ lanes }) =>
      userMessage(
        `Lanes: ${lanes}\n\nget_project → add_step kind=fork → add_step into each lane with forkId + branchId (kind n8n/llm/assert/…). Nest fork in a lane if a lane itself branches. session_action pipeline.configure-step forkJoin=product|assemble|merge. validate_project. get_project.steps[].branches is the DAG tree.`,
      ),
  )
}
