#!/usr/bin/env node
// AI : one-command MCP entry — Claude Code / Cursor do not need env, tsx args, or the rest of the repo.
import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const mcpRoot = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(mcpRoot, "..")
const appRoot = resolve(repoRoot, "combined_full_stack")
const tsxCli = resolve(mcpRoot, "node_modules/tsx/dist/cli.mjs")
const tsconfig = resolve(mcpRoot, "tsconfig.json")
const entry = resolve(mcpRoot, "src/index.ts")

if (!existsSync(tsxCli)) {
  console.error("Spine MCP: run `npm install --prefix mcp_tool` first.")
  process.exit(1)
}

const env = {
  ...process.env,
  DOTENV_CONFIG_QUIET: process.env.DOTENV_CONFIG_QUIET ?? "true",
  SPINE_REPO_ROOT: process.env.SPINE_REPO_ROOT ?? repoRoot,
  SPINE_APP_ROOT: process.env.SPINE_APP_ROOT ?? appRoot,
  SPINE_SESSION_PATH: process.env.SPINE_SESSION_PATH ?? resolve(appRoot, ".spine-session.json"),
}

const child = spawn(process.execPath, [tsxCli, "--tsconfig", tsconfig, entry], {
  cwd: mcpRoot,
  env,
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
child.on("error", (err) => {
  console.error(err)
  process.exit(1)
})
