# Spine MCP

Schema-first pipeline builder for Claude Code / Cursor. **You do not need the rest of the repo** — connect this MCP and follow server instructions (`connect_spine` prompt, or call `auth_status`).

Spine adds **types** (Pydantic/Zod structures) and **automatic UI** on top of n8n-style automation. Catalog pieces run local n8n Code-node JavaScript. They do **not** call Slack/Gmail. Share pieces as JSON (`list_pieces` / `import_piece` / `export_piece`). Fork steps are a series-parallel DAG (nested forks render as boxes).

## Claude Code

From this repository (install once: `npm install --prefix mcp_tool`):

```bash
claude mcp add spine -- node "$PWD/mcp_tool/spine-mcp.mjs"
```

Or drop `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "spine": {
      "command": "node",
      "args": ["mcp_tool/spine-mcp.mjs"]
    }
  }
}
```

The launcher sets `SPINE_REPO_ROOT`, `SPINE_APP_ROOT`, and `SPINE_SESSION_PATH` from its own location.

Then: `auth_status` → `get_project` → `list_pieces` / `list_seeds` → `add_step kind=n8n` or `kind=fork`. After `start_run` / `run_test`, call `wait_for_run`. Local API defaults to `http://127.0.0.1:3000`.

## Setup (Cursor)

Add to `.cursor/mcp.json` (absolute path — Cursor may spawn from `$HOME`):

```json
{
  "mcpServers": {
    "spine-pinpoint": {
      "command": "node",
      "args": ["/absolute/path/to/antler_vc_hackathon/mcp_tool/spine-mcp.mjs"]
    }
  }
}
```

Install once:

```bash
npm install --prefix mcp_tool
```

## Tools

Session (mutate `.spine-session.json`): `auth_status`, `get_project`, `validate_project`, `add_step`, `add_model`, `ask_agent`, `apply_project_changes`, `list_pieces`, `list_seeds`, `configure_n8n_step`, `import_piece`, `export_piece`, `wait_for_run`, `get_run`, `remove_doc`, …

Seed/testing (read-only unless session mode): `pinpoint_failure` (`testDocName` + `runJson` on the session, or seed paths), `lint_pipeline` (no args = session), `export_pydantic`, …

Broken JSON and unknown step kinds return `{ ok: false, code, error, next }` instead of crashing the MCP session.

## Development

```bash
npm install --prefix mcp_tool
npm test --prefix mcp_tool
npm run test:perf --prefix mcp_tool
npm run typecheck --prefix mcp_tool
```
