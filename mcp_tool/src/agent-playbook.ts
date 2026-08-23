// AI : MCP instructions + prompts — agents get GUI-equivalent *actions*, not a live UI view.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const SPINE_MCP_INSTRUCTIONS = `Spine MCP — schema-first pipeline builder (typed n8n + auto UI). You do not see the browser. Do not read the repo unless a tool fails.

WHAT SPINE IS
Spine sits on top of n8n-class automation with Pydantic/Zod structures. You define models, wire steps, generate the inference form automatically, run golden tests, then share a drag-and-drop page. Data between steps is typed. n8n pieces run local Code-node JavaScript against that type — they do NOT call Slack/Gmail/HTTP live. Webhook is the generic HTTP escape hatch. Activepieces-style pieces are shareable JSON (list_pieces / import_piece / export_piece).

CONNECT (Claude Code / Cursor — no codebase required)
claude mcp add spine -- env SPINE_REPO_ROOT=<repo> SPINE_APP_ROOT=<repo>/combined_full_stack SPINE_SESSION_PATH=<repo>/combined_full_stack/.spine-session.json node <repo>/mcp_tool/node_modules/tsx/dist/cli.mjs --tsconfig <repo>/mcp_tool/tsconfig.json <repo>/mcp_tool/src/index.ts
Or .cursor/mcp.json / .mcp.json with command node + those args + env. After connect: get_project.

WORKSPACES — never mix:
- Session tools mutate .spine-session.json (omit sessionPath → SPINE_SESSION_PATH). This is the editable project (same SpineSession as the CLI).
- Seed tools (pinpoint_failure, compare_run_to_test, validate_test, parse_test, list_project_tests, describe_pipeline_steps, validate_step_output, derive_step_prompt, validate_pipeline_wiring, lint_pipeline, export_pydantic, inspect_ids) read seeds/*.json + *_testing.json. They do not write the session.
- Signed-in GUI uses Supabase cookies. pullRemoteState / flushPendingSave are not MCP tools yet.

DEFAULT LOOP
1. get_project — compact review (id, kind, field types, inputType, docs, pendingProposal, issues, assistantInFlight, fork branches, n8nNodeType).
2. validate_project — same computeInvalid as the pipeline editor.
3. Change: ask_agent (kind vibe|structure|testing|diagnosis) → poll get_project if inFlight → apply_project_changes, OR edit with add_step / add_model / add_doc / assign_input / set_docs / configure_n8n_step.
   If ask_agent times out (MCP -32001) or returns data.inFlight, do NOT send the same message again. Poll get_project until pendingProposal or assistantInFlight is null, then validate_project.
4. run_test or start_run (needs SPINE_API_URL). Returns {id,status} immediately — then wait_for_run until ok/error (or timedOut; call again).
5. Finished run JSON: pinpoint_failure(projectSeedPath, testFilePath, runJson|runPath).

TYPED N8N PIECES (no live integrations)
list_pieces → add_step kind=n8n → configure_n8n_step (nodeType + parametersJson + optional n8nCode).
Catalog: n8n-nodes-base.set | filter | sort | limit | removeDuplicates | itemLists | crypto | dateTime | html | markdown | spreadsheetFile | code.
Each piece has a props schema → the GUI auto-generates the form. n8nCode is n8n Code-node JS: items = [{json}], return items. Prefer a catalog piece over custom-code. import_piece / export_piece share JSON (Activepieces-style).

FORK DAG
Pipelines are series-parallel. add_step kind=fork, then add_step with forkId + branchId into a lane. Nest another fork in a lane for a generic DAG (no cycles). Join: product | assemble | merge. get_project.steps[].branches shows the tree.

NON-TECHNICAL BACKEND
Structures generate the inference UI. simpleKindBlurb / piece display names hide code. n8n code is an optional advanced override — non-technical users pick a piece and fill the auto form.

NAMED TOOLS vs session_action:
Prefer named tools. session_action id is the GUI data-spine-id. Extra ids: structure.add-field/remove-field/set-relation/add-alias, pipeline.configure-step/remove-step/assign-structure, assistant.reject, billing.refresh, earnings.refresh, cache.refresh, logging.errors-only.

ERRORS: tools return {ok:false, code, error, next} with isError instead of crashing. Follow next.

NOT TOOLS YET: documents.remove, quotes.link, session pull/push, run cancel, share/hosted-api/embed mint, Stripe, human-review, chatbot turn, custom-code (browser CodeHost), auth login, live n8n Cloud execute.
ID / catalog: inspect_ids lists branded row ids. get_project.models fields include fk→ and idTypes.`

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
        `Goal: ${goal}\n\nFollow Spine MCP instructions. Loop: get_project → validate_project → ask_agent (kind=vibe unless this is clearly structure/testing/diagnosis). If ask_agent times out, poll get_project until pendingProposal appears (do not re-ask). Then apply_project_changes (or session_action assistant.reject) → validate_project again → run_test if SPINE_API_URL is set, then wait_for_run. Use session tools only (not seed lint) unless pinpointing a finished run against seeds/*.json.`,
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
        `Failing test: ${testFilePath}\nSeed: ${projectSeedPath}${runPath ? `\nRun JSON: ${runPath}` : ""}\n\nFollow Spine MCP instructions. If you have run JSON, call pinpoint_failure first (seed + test + run) — do not dump the whole pipeline. Then ask_agent kind=testing or kind=diagnosis with the isolated diffs, apply_project_changes, validate_project, run_test, wait_for_run. Pinpoint uses the seed file; session edits go through session tools.`,
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
        `Add a ${kind} step: ${purpose}\n\nFollow Spine MCP instructions. get_project → add_step (or session_action pipeline.add-step) → session_action pipeline.configure-step / pipeline.assign-structure / configure_n8n_step as needed → validate_project. For kind=n8n, list_pieces first. For kind=fork, add_step into lanes with forkId + branchId. Do not call seed tools on the session file.`,
      ),
  )

  server.registerPrompt(
    "connect_spine",
    {
      title: "Connect to Spine without the codebase",
      description: "How a Claude Code / Cursor agent should attach this MCP and start building typed pipelines.",
      argsSchema: {},
    },
    () =>
      userMessage(
        `You are connected to Spine MCP. Do not clone or search the repo.\n\n1. get_project (create with add_project if none).\n2. Add Pydantic-like structures with add_model + session_action structure.add-field.\n3. Wire steps: input → (fork lanes and/or n8n pieces and/or llm) → output.\n4. validate_project until ok.\n5. Auto UI is the inference page from those structures — you do not hand-write forms.\n6. Share an n8n piece with export_piece; import someone else's with import_piece.\nNever call live Slack/Gmail. n8n pieces run local Code-node JS with typed in/out.`,
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
        `Lanes: ${lanes}\n\nget_project → add_step kind=fork → add_step into each lane with forkId + branchId (kind n8n/llm/assert/…). Nest fork in a lane if a lane itself branches. validate_project. get_project.steps[].branches is the DAG tree.`,
      ),
  )
}
