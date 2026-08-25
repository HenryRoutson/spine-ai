// AI : MCP instructions + prompts — agents get GUI-equivalent *actions*, not a live UI view.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const SPINE_MCP_INSTRUCTIONS = `Spine MCP — schema-first pipeline builder (typed n8n + auto UI). You do not see the browser. Do not clone, search, or read the repo unless a tool fails.

WHAT SPINE IS
Spine sits on top of n8n-class automation with Pydantic/Zod structures. You define models, wire steps, generate the inference form automatically, run golden tests, then share a drag-and-drop page. Data between steps is typed. n8n pieces run local Code-node JavaScript against that type — they do NOT call Slack/Gmail/HTTP live. Live apps use kind=connect (list_connect_actions). Webhook is the generic HTTP escape hatch. Pieces are shareable JSON (list_pieces / import_piece / export_piece).

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
2. get_project — compact review plus next (apply pending proposal, fix issues, or run). If no active project, session_action id=project.add or import_seed. To edit the same project as a signed-in GUI: pull_remote_state (needs SPINE_API_TOKEN) → mutate → push_remote_state.
3. validate_project — same computeInvalid as the pipeline editor. lint_pipeline with no args for graph lint.
4. Change: ask_agent (kind vibe|structure|testing|diagnosis) → poll get_project if inFlight (do NOT re-send). If assistantError appears, fix from that text. Then apply_project_changes, OR edit with session_action (project/structure/pipeline/docs/inference ids) / configure_n8n_step / configure_connect_step.
5. run_test or start_run. Returns {id,status} immediately — then wait_for_run until ok/error (or timedOut; call again). wait_for_run / get_run include runJson.
6. Finished run: pinpoint_failure({ testDocName, runJson }) using session_logs.tests and wait_for_run JSON.

TYPED N8N PIECES (no live integrations)
list_pieces → session_action id=pipeline.add-step kind=n8n → configure_n8n_step (nodeType + parametersJson + optional n8nCode).
Catalog: n8n-nodes-base.set | filter | sort | limit | removeDuplicates | itemLists | crypto | dateTime | html | markdown | spreadsheetFile | code. Aliases: piece.set, piece.filter, …
Each piece has a props schema → the GUI auto-generates the form. n8nCode is n8n Code-node JS: items = [{json}], return items. Prefer a catalog piece over custom-code. import_piece / export_piece share JSON.

LIVE APPS (kind=connect)
list_connect_actions → session_action id=pipeline.add-step kind=connect → configure_connect_step. Catalog: slack.postMessage, gmail.send, sheets.append, http.request. After Approve, the human taps Connect {App} (vendor OAuth popup only). Golden tests mock connect output — never hit Slack from *_testing.json.

FORK DAG
Pipelines are series-parallel. session_action id=pipeline.add-step kind=fork, then session_action with forkId + branchId into a lane. Nest another fork in a lane for a generic DAG (no cycles). Join: product | assemble | merge via session_action pipeline.configure-step forkJoin. get_project.steps[].branches shows the tree.

STEP KINDS
input, llm, llm-batch, example-select, transform, chunk, merge, assemble, fork, combine, custom-code, assert, human-review, webhook, n8n, connect, chatbot, output.
Aliases: code→custom-code, http→webhook, piece→n8n, app→connect, dag→fork. Case-insensitive.

SHARE / HOSTED PAGE / API (same HTTP as the GUI Share tab)
session_action share.create-link — public /run/{id} (fundingMode sharer_pays|viewer_pays|viewer_signs_in).
session_action share.create-site — hosted HTML page /site/{id}; pass companyName (defaults to project name). Optional params JSON: tagline, customHtml, customCss.
session_action share.create-embed — /embed/{id}; allowedOrigins is required (comma-separated).
session_action share.deploy-api — hosted API + apiKey (shown once). fundingMode owner_pays|caller_pays.
session_action share.marketplace-publish — name is the listing title.
session_action nav.window.share — list minted link/api ids (needs API + token). Default spend limit matches GUI ($10) unless spendLimitCents is set.

SCHEDULE (same HTTP as the GUI Schedule tab)
session_action schedule.create — cron (default 0 9 * * *) + timezone (default UTC). name defaults to describeCronExpr.
session_action nav.window.schedule — list. schedule.toggle (scheduleId + enabled), schedule.run-now, schedule.delete.

CONNECT OAUTH
list_connect_actions / configure_connect_step wire the step. Vendor OAuth popup is GUI-only (Connect chip). After the human approves, pull_remote_state or configure_connect_step connectConnectionId. session_action connect.start-session probes Nango (returns sessionToken) — do not invent connection ids.

CORE SESSION TOOLS (vibe loop — do not bounce between duplicate names):
auth_status → get_project → validate_project → ask_agent → apply_project_changes → session_action (structure/pipeline/docs/share/schedule ids) → start_run or run_test → wait_for_run → pinpoint_failure.
Sync with GUI: pull_remote_state → edit → push_remote_state.

session_action vs named CRUD:
session_action id is the GUI data-spine-id (project.add, pipeline.move-step, quotes.link, share.create-site, schedule.create, …). Legacy aliases (add_project, rename_project, …) still work inside session_action id. Prefer catalog ids.
Extra session_action ids: structure.add-field/remove-field/set-relation/add-alias, pipeline.configure-step/remove-step/assign-structure, assistant.reject, documents.set-projects, billing.refresh, earnings.refresh, cache.refresh, logging.errors-only, logging.hydrate, share.create-link/create-embed/create-site/deploy-api, schedule.create/toggle/run-now/delete, connect.start-session.

ERRORS: tools return {ok:false, code, error, next} with isError instead of crashing. Follow next. Never retry the same crashing payload.

NOT TOOLS YET: run cancel, Stripe checkout + keys, teams invite, human-review click, chatbot turn, custom-code (browser CodeHost). Live Slack/Gmail is kind=connect (list_connect_actions), not n8n Cloud. OAuth popup stays GUI. pull_remote_state / push_remote_state / quotes.link / project.resync-examples / pipeline.move-step / documents.set-projects / share mint / schedule mint are available (named or session_action).`

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
        `Add a ${kind} step: ${purpose}\n\nFollow Spine MCP instructions. auth_status → get_project → add_step (or session_action pipeline.add-step) → session_action pipeline.configure-step / pipeline.assign-structure / configure_n8n_step / configure_connect_step as needed → validate_project. For kind=n8n, list_pieces first. For kind=connect, list_connect_actions first. For kind=fork, add_step into lanes with forkId + branchId. Do not call seed tools on the session file.`,
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
        `You are connected to Spine MCP. Do not clone or search the repo.\n\n1. auth_status — follow next (session_action id=project.add if projectCount is 0, or import_seed from seeds).\n2. get_project — follow next (apply, reject, or edit).\n3. Add Pydantic-like structures with session_action id=structure.add-model + session_action structure.add-field (name, type).\n4. Wire steps: input → (fork lanes and/or n8n pieces and/or connect and/or llm) → output. session_action id=pipeline.add-step kinds are listed in server instructions.\n5. validate_project until ok. lint_pipeline with no args for graph lint.\n6. Auto UI is the inference page from those structures — you do not hand-write forms.\n7. If auth_status.canRun, start_run then wait_for_run. pinpoint_failure uses testDocName + runJson.\n8. Publish: session_action share.create-link | share.create-site (companyName) | share.create-embed (allowedOrigins) | share.deploy-api. Recurring: session_action schedule.create (cron + timezone).\nShare an n8n piece with export_piece; import someone else's with import_piece.\nLive Slack/Gmail: list_connect_actions → kind=connect. Local Set/Filter: list_pieces (piece.set). Human taps Connect in the GUI for OAuth.`,
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
        `Purpose: ${purpose}\n\nlist_pieces → pick n8nNodeType (piece.set aliases n8n-nodes-base.set) → add_step kind=n8n → configure_n8n_step with parametersJson matching props → pipeline.assign-structure for typed in/out → validate_project. Optional n8nCode is n8n Code-node JS (items/json). Do not hit vendor APIs — use kind=connect for Slack/Gmail.`,
      ),
  )

  server.registerPrompt(
    "connect_app",
    {
      title: "Add a live app connect step",
      description: "Slack / Gmail / Sheets / HTTP via kind=connect — not a node canvas.",
      argsSchema: {
        purpose: z.string().describe("What the app should do (post to Slack, send email, append a sheet, …)"),
      },
    },
    ({ purpose }) =>
      userMessage(
        `Purpose: ${purpose}\n\nlist_connect_actions → pick connectActionId (slack.postMessage | gmail.send | sheets.append | http.request) → add_step kind=connect → configure_connect_step with parametersJson → pipeline.assign-structure → validate_project. After Approve, the human taps Connect {App}. run_test mocks connect output. Do not use n8n Cloud or invent action ids.`,
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

  server.registerPrompt(
    "share_pipeline",
    {
      title: "Publish a share link, hosted page, embed, or API",
      description: "Same HTTP as the GUI Share tab — mint a run link, hosted HTML page, embed, or hosted API.",
      argsSchema: {
        surface: z.string().describe("link | site | embed | api | marketplace"),
      },
    },
    ({ surface }) =>
      userMessage(
        `Publish surface: ${surface}\n\nFollow Spine MCP instructions. auth_status.canRun must be true (Next up + token for signed-in mint). get_project until valid. Then session_action:\n- link → id=share.create-link (fundingMode sharer_pays|viewer_pays|viewer_signs_in)\n- site → id=share.create-site companyName=… (optional params JSON tagline/customHtml)\n- embed → id=share.create-embed allowedOrigins=https://example.com\n- api → id=share.deploy-api (copy apiKey from the result once)\n- marketplace → id=share.marketplace-publish name=title\nDo not mint from a seed path. Vendor OAuth stays the GUI Connect chip.`,
      ),
  )

  server.registerPrompt(
    "schedule_pipeline",
    {
      title: "Schedule recurring runs",
      description: "Same HTTP as the GUI Schedule tab — cron + timezone, then list/toggle/run-now/delete.",
      argsSchema: {
        when: z.string().describe("When it should fire, e.g. every weekday at 9am Australia/Sydney"),
      },
    },
    ({ when }) =>
      userMessage(
        `Schedule: ${when}\n\nFollow Spine MCP instructions. get_project until valid. session_action id=schedule.create with cron (5 fields) and timezone (IANA). Default is 0 9 * * * UTC. List with nav.window.schedule. Toggle with scheduleId + enabled. Run once with schedule.run-now. Delete with schedule.delete.`,
      ),
  )
}
