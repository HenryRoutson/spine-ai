// AI : MCP instructions + prompts — agents get GUI-equivalent *actions*, not a live UI view.
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

export const SPINE_MCP_INSTRUCTIONS = `Spine MCP: same actions a human has in the GUI (edit, validate, ask, apply, run, test). You do not see the browser — that is fine. Do not try to "look at" the live React store.

WORKSPACES — never mix:
- Session tools mutate .spine-session.json (omit sessionPath → SPINE_SESSION_PATH). This is your editable project (same SpineSession as the CLI).
- Seed tools (pinpoint_failure, compare_run_to_test, validate_test, parse_test, list_project_tests, describe_pipeline_steps, validate_step_output, derive_step_prompt, validate_pipeline_wiring, lint_pipeline, export_pydantic) read seeds/*.json + *_testing.json. They do not write the session.
- Signed-in GUI uses Supabase via cookies. pullRemoteState / flushPendingSave exist on SpineSession but are not MCP tools yet.

DEFAULT LOOP (vibe like clicking the UI):
1. get_project — handle only (id, name, step list). Not a full graph dump.
2. validate_project — same computeInvalid as the pipeline editor.
3. Change the project: ask_agent (kind vibe|structure|testing|diagnosis) then apply_project_changes, OR edit with add_step / add_model / add_doc / assign_input / set_docs.
4. run_test or start_run (needs SPINE_API_URL). Returns {id,status} immediately — there is no wait_for_run yet.
5. With a finished run JSON: pinpoint_failure(projectSeedPath, testFilePath, runJson|runPath).

NAMED TOOLS vs session_action:
Prefer named tools. session_action id is the GUI data-spine-id (docs/parity.md). Use it when there is no named tool:
  structure.add-field, structure.remove-field, structure.add-alias,
  pipeline.configure-step, pipeline.remove-step, pipeline.assign-structure,
  assistant.reject, billing.refresh, earnings.refresh, cache.refresh, logging.errors-only.

NOT TOOLS YET (do not invent them): documents.remove, quotes.link, logging.hydrate, session pull/push, wait_for_run, run cancel, share/hosted-api/embed mint, Stripe, human-review, chatbot turn, custom-code (browser CodeHost), auth login.`

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
        `Goal: ${goal}\n\nFollow Spine MCP instructions. Loop: get_project → validate_project → ask_agent (kind=vibe unless this is clearly structure/testing/diagnosis) → read the proposal → apply_project_changes (or session_action assistant.reject) → validate_project again → run_test if SPINE_API_URL is set. Use session tools only (not seed lint) unless pinpointing a finished run against seeds/*.json.`,
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
        `Failing test: ${testFilePath}\nSeed: ${projectSeedPath}${runPath ? `\nRun JSON: ${runPath}` : ""}\n\nFollow Spine MCP instructions. If you have run JSON, call pinpoint_failure first (seed + test + run) — do not dump the whole pipeline. Then ask_agent kind=testing or kind=diagnosis with the isolated diffs, apply_project_changes, validate_project, run_test. Pinpoint uses the seed file; session edits go through session tools.`,
      ),
  )

  server.registerPrompt(
    "add_pipeline_step",
    {
      title: "Add a pipeline step",
      description: "Insert and configure a step on the session project without asking Vibe.",
      argsSchema: {
        kind: z.string().describe("Step kind: llm | input | combine | chunk | …"),
        purpose: z.string().describe("What this step should do (label, prompt, structure)"),
      },
    },
    ({ kind, purpose }) =>
      userMessage(
        `Add a ${kind} step: ${purpose}\n\nFollow Spine MCP instructions. get_project → add_step (or session_action pipeline.add-step) → session_action pipeline.configure-step / pipeline.assign-structure as needed → validate_project. Do not call seed tools on the session file.`,
      ),
  )
}
