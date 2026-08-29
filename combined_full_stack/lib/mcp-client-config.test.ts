import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  claudeCodeAddCommand,
  mcpApiEnvExample,
  prettyMcpJson,
  SPINE_MCP_SERVER_NAME,
  spineMcpFile,
  spineMcpClaudeProjectServer,
  spineMcpCursorProjectServer,
  spineMcpSetupSnippets,
} from "@/lib/mcp-client-config"

const REPO = join(import.meta.dirname, "../..")

describe("Spine MCP client config", () => {
  it("names the client server spine", () => {
    expect(SPINE_MCP_SERVER_NAME).toBe("spine")
    const snippets = spineMcpSetupSnippets()
    expect(snippets.claudeCodeAddCommand).toContain("claude mcp add spine")
    expect(snippets.claudeCodeAddCommand).toContain("$PWD/mcp_tool/spine-mcp.mjs")
    expect(JSON.parse(snippets.cursorProjectJson).mcpServers.spine.args[0]).toBe(
      "${workspaceFolder}/mcp_tool/spine-mcp.mjs",
    )
  })

  it("matches committed Claude Code .mcp.json", () => {
    const committed = readFileSync(join(REPO, ".mcp.json"), "utf8")
    expect(JSON.parse(committed)).toEqual(JSON.parse(prettyMcpJson(spineMcpFile(spineMcpClaudeProjectServer()))))
  })

  it("matches committed Cursor .cursor/mcp.json and has no machine paths", () => {
    const committed = readFileSync(join(REPO, ".cursor/mcp.json"), "utf8")
    expect(committed).not.toContain("/Users/")
    expect(committed).not.toContain("nvm/versions")
    expect(JSON.parse(committed)).toEqual(JSON.parse(prettyMcpJson(spineMcpFile(spineMcpCursorProjectServer()))))
  })

  it("prints a global Cursor file with an absolute launcher", () => {
    const snippets = spineMcpSetupSnippets({ repoRoot: "/opt/spine", nodeCommand: "/usr/bin/node" })
    const file = JSON.parse(snippets.cursorGlobalJson) as {
      mcpServers: { spine: { command: string; args: string[] } }
    }
    expect(file.mcpServers.spine.command).toBe("/usr/bin/node")
    expect(file.mcpServers.spine.args).toEqual(["/opt/spine/mcp_tool/spine-mcp.mjs"])
  })

  it("builds API env without leaking a blank token as required", () => {
    expect(mcpApiEnvExample("http://127.0.0.1:3000/")).toBe(
      `SPINE_API_URL="http://127.0.0.1:3000"\nSPINE_API_TOKEN=""\n`,
    )
    expect(claudeCodeAddCommand("/opt/spine")).toContain('"/opt/spine/mcp_tool/spine-mcp.mjs"')
  })
})
