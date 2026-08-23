# Spine MCP

Schema-first pipeline builder for Claude Code / Cursor. **You do not need the repo** — connect this MCP and follow server instructions (`connect_spine` prompt).

Spine adds **types** (Pydantic/Zod structures) and **automatic UI** on top of n8n-style automation. Catalog pieces run local n8n Code-node JavaScript. They do **not** call Slack/Gmail. Share pieces as JSON (`list_pieces` / `import_piece` / `export_piece`). Fork steps are a series-parallel DAG (nested forks render as boxes).

## Claude Code

```bash
claude mcp add spine -- \
  env SPINE_REPO_ROOT="$PWD" \
  SPINE_APP_ROOT="$PWD/combined_full_stack" \
  SPINE_SESSION_PATH="$PWD/combined_full_stack/.spine-session.json" \
  node "$PWD/mcp_tool/node_modules/tsx/dist/cli.mjs" \
  --tsconfig "$PWD/mcp_tool/tsconfig.json" \
  "$PWD/mcp_tool/src/index.ts"
```

Then: `get_project` → `list_pieces` → `add_step kind=n8n` or `kind=fork`. After `start_run` / `run_test`, call `wait_for_run`.

## Setup (Cursor)

Add to `.cursor/mcp.json` in the repo root:

```json
{
  "mcpServers": {
    "spine-pinpoint": {
      "command": "npm",
      "args": ["run", "start", "--prefix", "mcp_tool"],
      "env": {
        "SPINE_REPO_ROOT": "/absolute/path/to/antler_vc_hackathon",
        "SPINE_APP_ROOT": "/absolute/path/to/antler_vc_hackathon/combined_full_stack",
        "SPINE_SESSION_PATH": "/absolute/path/to/antler_vc_hackathon/combined_full_stack/.spine-session.json"
      }
    }
  }
}
```

Install once:

```bash
npm install --prefix mcp_tool
```

## Tools

Session (mutate `.spine-session.json`): `get_project`, `validate_project`, `add_step`, `add_model`, `ask_agent`, `apply_project_changes`, `list_pieces`, `configure_n8n_step`, `import_piece`, `export_piece`, `wait_for_run`, …

Seed/testing (read-only): `pinpoint_failure`, `lint_pipeline`, `export_pydantic`, …

Broken JSON and unknown step kinds return `{ ok: false, code, error, next }` instead of crashing the MCP session.

## Development

```bash
npm install --prefix mcp_tool
npm test --prefix mcp_tool
npm run typecheck --prefix mcp_tool
```
