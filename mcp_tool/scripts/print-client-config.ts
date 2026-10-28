#!/usr/bin/env tsx
// AI : print / write Claude Code + Cursor MCP client files from the shared snippet builder.
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { spineMcpSetupSnippets } from "@/lib/mcp-client-config"

const REPO = resolve(import.meta.dirname, "../..")
const flags = new Set(process.argv.slice(2))
const snippets = spineMcpSetupSnippets({ repoRoot: REPO, nodeCommand: process.execPath })

if (flags.has("--write-cursor")) {
  const path = resolve(REPO, ".cursor/mcp.json")
  writeFileSync(path, snippets.cursorProjectJson)
  process.stderr.write(`wrote ${path}\n`)
}

if (flags.has("--cursor-global")) process.stdout.write(snippets.cursorGlobalJson)
else if (flags.has("--cursor")) process.stdout.write(snippets.cursorProjectJson)
else if (flags.has("--claude")) process.stdout.write(`${snippets.claudeCodeAddCommand}\n`)
else if (flags.has("--write-cursor") && flags.size === 1) {
  /* file already written */
} else {
  process.stdout.write(`Claude Code\n${snippets.claudeCodeAddCommand}\n\n`)
  process.stdout.write(`Cursor project (.cursor/mcp.json)\n${snippets.cursorProjectJson}\n`)
  process.stdout.write(`Cursor user (~/.cursor/mcp.json)\n${snippets.cursorGlobalJson}`)
  process.stdout.write(`\nInstall once: ${snippets.installCommand}\n`)
  process.stdout.write(`Then: docs/mcp_setup.md\n`)
}
