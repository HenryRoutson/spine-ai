# Spine MCP

Schema-first pipeline builder for **Claude Code / Cursor**. In-app Vibe stays the default; this server is the optional token-heavy editor path.

**Users:** [`docs/mcp_setup.md`](../docs/mcp_setup.md) — install, Claude Code, Cursor, `SPINE_API_TOKEN`.

You do not need to read the rest of the repo after connect. Follow server instructions (`connect_spine` prompt, or call `auth_status`).

Spine adds **types** (Pydantic/Zod structures) and **automatic UI** on top of n8n-style automation. Catalog pieces run local n8n Code-node JavaScript. They do **not** call Slack/Gmail. Share pieces as JSON (`list_pieces` / `import_piece` / `export_piece`). Fork steps are a series-parallel DAG (nested forks render as boxes).

## Claude Code

```bash
npm install --prefix mcp_tool
claude mcp add spine -- node "$PWD/mcp_tool/spine-mcp.mjs"
```

Project file `.mcp.json` is already in the repo root.

## Cursor

`.cursor/mcp.json` uses `${workspaceFolder}` (Cursor may spawn from `$HOME`):

```json
{
  "mcpServers": {
    "spine": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp_tool/spine-mcp.mjs"]
    }
  }
}
```

Print / rewrite that file:

```bash
node mcp_tool/spine-mcp.mjs --write-cursor
node mcp_tool/spine-mcp.mjs --cursor-global
```

Then enable **spine** in Cursor Settings → MCP.

The launcher sets `SPINE_REPO_ROOT`, `SPINE_APP_ROOT`, and `SPINE_SESSION_PATH` from its own location. It also loads repo `.env` / `combined_full_stack/.env.local` for `SPINE_API_TOKEN`.

Then: `auth_status` → `get_project` → `list_pieces` / `list_seeds` → `session_action id=pipeline.add-step kind=n8n` or `kind=fork`. After `start_run` / `run_test`, call `wait_for_run`. Local API defaults to `http://127.0.0.1:3000`.

## Tools

Session (mutate `.spine-session.json`): `auth_status`, `get_project`, `validate_project`, `ask_agent`, `apply_project_changes`, `session_action`, `list_pieces`, `list_connect_actions`, `list_seeds`, `configure_n8n_step`, `configure_connect_step`, `import_piece`, `export_piece`, `wait_for_run`, `get_run`.

Seed/testing (read-only unless session mode): `pinpoint_failure` (`testDocName` + `runJson` on the session, or seed paths), `lint_pipeline` (no args = session), `export_pydantic`, …

`add_step` / `add_model` / `add_doc` are **not** named tools — use `session_action` ids (`pipeline.add-step`, `structure.add-model`, `documents.upload`). Legacy aliases still work as `session_action` `id` values.

Broken JSON and unknown step kinds return `{ ok: false, code, error, next }` instead of crashing the MCP session.

## Development

```bash
npm install --prefix mcp_tool
npm test --prefix mcp_tool
npm run test:perf --prefix mcp_tool
npm run typecheck --prefix mcp_tool
```
