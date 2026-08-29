// AI : Claude Code / Cursor MCP snippets — in-app Vibe stays default; this is the opt-in heavy path.

export const SPINE_MCP_SERVER_NAME = "spine" as const
export type spine_mcp_server_name = typeof SPINE_MCP_SERVER_NAME

export const SPINE_MCP_LAUNCHER_REL = "mcp_tool/spine-mcp.mjs" as const
export type mcp_launcher_rel = typeof SPINE_MCP_LAUNCHER_REL

export const DEFAULT_MCP_API_URL = "http://127.0.0.1:3000" as const
export type mcp_api_url = string

export type SpineMcpStdioServer = {
  command: string
  args: string[]
  env?: Record<string, string>
}

export type SpineMcpClientFile = {
  mcpServers: Record<string, SpineMcpStdioServer>
}

const QUIET_ENV = {
  DOTENV_CONFIG_QUIET: "true",
  NODE_NO_WARNINGS: "1",
} as const

function posixJoin(root: string, rel: string): string {
  return `${root.replace(/\\/g, "/").replace(/\/$/, "")}/${rel}`
}

export function spineMcpClaudeProjectServer(): SpineMcpStdioServer {
  return { command: "node", args: [SPINE_MCP_LAUNCHER_REL] }
}

export function spineMcpCursorProjectServer(): SpineMcpStdioServer {
  return {
    command: "node",
    args: [`\${workspaceFolder}/${SPINE_MCP_LAUNCHER_REL}`],
    env: { ...QUIET_ENV },
  }
}

export function spineMcpCursorGlobalServer(repoRoot: string, nodeCommand = "node"): SpineMcpStdioServer {
  return {
    command: nodeCommand,
    args: [posixJoin(repoRoot, SPINE_MCP_LAUNCHER_REL)],
    env: { ...QUIET_ENV },
  }
}

export function spineMcpFile(server: SpineMcpStdioServer): SpineMcpClientFile {
  return { mcpServers: { [SPINE_MCP_SERVER_NAME]: server } }
}

export function prettyMcpJson(file: SpineMcpClientFile): string {
  return `${JSON.stringify(file, null, 2)}\n`
}

export function claudeCodeAddCommand(repoRoot?: string): string {
  const launcher = repoRoot ? `"${posixJoin(repoRoot, SPINE_MCP_LAUNCHER_REL)}"` : `"$PWD/${SPINE_MCP_LAUNCHER_REL}"`
  return `claude mcp add ${SPINE_MCP_SERVER_NAME} -- node ${launcher}`
}

export function mcpApiEnvExample(apiUrl: mcp_api_url = DEFAULT_MCP_API_URL, token = ""): string {
  const tokenLine = token ? `SPINE_API_TOKEN="${token}"` : `SPINE_API_TOKEN=""`
  return `SPINE_API_URL="${apiUrl.replace(/\/$/, "")}"\n${tokenLine}\n`
}

export type SpineMcpSetupSnippets = {
  serverName: spine_mcp_server_name
  installCommand: string
  claudeCodeAddCommand: string
  claudeCodeProjectJson: string
  cursorProjectJson: string
  cursorGlobalJson: string
  envExample: string
}

export function spineMcpSetupSnippets(opts?: {
  repoRoot?: string
  nodeCommand?: string
  apiUrl?: mcp_api_url
}): SpineMcpSetupSnippets {
  const repoRoot = opts?.repoRoot
  return {
    serverName: SPINE_MCP_SERVER_NAME,
    installCommand: "npm install --prefix mcp_tool",
    claudeCodeAddCommand: claudeCodeAddCommand(repoRoot),
    claudeCodeProjectJson: prettyMcpJson(spineMcpFile(spineMcpClaudeProjectServer())),
    cursorProjectJson: prettyMcpJson(spineMcpFile(spineMcpCursorProjectServer())),
    cursorGlobalJson: prettyMcpJson(
      spineMcpFile(spineMcpCursorGlobalServer(repoRoot ?? "/absolute/path/to/this/repo", opts?.nodeCommand)),
    ),
    envExample: mcpApiEnvExample(opts?.apiUrl),
  }
}
