# Connect Claude Code or Cursor to Spine (optional)

In-app **Vibe** is the default. It uses Spine’s own models and is the cheap path.

Claude Code, Cursor, and similar editors subsidize large token budgets. Use them when you want a heavier coding loop on the same project. This is opt-in — nothing in Vibe switches to those editors unless you connect MCP.

Spine already ships an MCP server (`mcp_tool/`). This page is the user setup.

## What you get

The editor can create structures, wire pipeline steps, run tests, and share links through MCP tools (`auth_status`, `get_project`, `ask_agent`, `session_action`, …). You do not drive the browser. You do not need to read the rest of this repo after the server is connected.

## 1. One-time install

From the repo root, Node 20+:

```bash
npm install --prefix mcp_tool
```

Or:

```bash
python3 scripts/setup_local.py mcp
```

Keep the app running if you want runs and GUI sync (`python3 scripts/setup_local.py dev` → http://127.0.0.1:3000).

## 2. Claude Code

Project file `.mcp.json` is already in the repo. From the repo root:

```bash
claude mcp add spine -- node "$PWD/mcp_tool/spine-mcp.mjs"
```

Restart Claude Code (or `/mcp`). The server name is `spine`. First tool: `auth_status`.

## 3. Cursor

Project file `.cursor/mcp.json` uses `${workspaceFolder}` so it is portable (Cursor starts MCP from `$HOME` and ignores `cwd`).

1. Open this repository as the workspace folder.
2. Cursor Settings → MCP → enable **spine**.
3. If `node` is missing from Cursor’s PATH (common with nvm), set `command` to the output of `which node`, or write a user config:

```bash
node mcp_tool/spine-mcp.mjs --cursor-global >> ~/.cursor/mcp.json
```

Merge that JSON into `~/.cursor/mcp.json` if the file already has other servers.

## 4. Same project as the signed-in app (optional)

Local MCP edits `.spine-session.json` even without a token. To pull/push the GUI project and to `start_run`:

1. Sign in to Spine.
2. Settings → **Editors (MCP)** → copy the session token.
3. Put this in the repo-root `.env` (gitignored):

```bash
SPINE_API_URL="http://127.0.0.1:3000"
SPINE_API_TOKEN="eyJ..."   # Supabase access token from Settings
```

Hosted app: set `SPINE_API_URL` to that origin (for example `https://www.spine-ai-app.dev`). The token expires with the browser session — copy a fresh one if `auth_status.canRun` is false.

The MCP process loads `.env` and `combined_full_stack/.env.local` on boot. Do not commit tokens.

## 5. Check it

In the editor, ask: “Call `auth_status`, then `get_project`.”

- `projectCount` is 0 → `session_action` `id=project.add`, or `import_seed` from `list_seeds`.
- `canRun` is false → start the app and set `SPINE_API_TOKEN`.
- Tools crash on spawn → `npm install --prefix mcp_tool`, then use an absolute `node` path.

Prompt `connect_spine` is the built-in playbook.

## Not the default

| Path | When |
|---|---|
| In-app Vibe | Default. Cheap models. No editor install. |
| Claude Code / Cursor MCP | Optional. Uses that editor’s token budget. |
| CLI / TUI | `npx tsx combined_full_stack/scripts/spine-cli.ts` |

Other MCP clients (Windsurf, VS Code Copilot, Codex) can use the same stdio command: `node /absolute/path/to/mcp_tool/spine-mcp.mjs`.
