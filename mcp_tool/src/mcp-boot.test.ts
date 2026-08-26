// AI : spawn the real stdio server — vitest imports do not catch tsx ESM / stdout handshake failures.
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { isMcpStdoutChunk } from "./bootstrap-env.js"

const MCP_ROOT = resolve(import.meta.dirname, "..")
const REPO = resolve(MCP_ROOT, "..")
const APP = resolve(REPO, "combined_full_stack")

type JsonRpc = { jsonrpc: "2.0"; id?: number; result?: unknown; error?: { message: string } }

async function handshake(): Promise<{
  init: JsonRpc
  tools: JsonRpc
  prompts: JsonRpc
  badApply: JsonRpc
  pieces: JsonRpc
  stderr: string
}> {
  // AI : Cursor MCP spawn ignores cwd and starts from $HOME — use absolute tsx + tsconfig.
  const nodeBin = process.execPath
  const tsxCli = resolve(MCP_ROOT, "node_modules/tsx/dist/cli.mjs")
  const tsconfig = resolve(MCP_ROOT, "tsconfig.json")
  const entry = resolve(MCP_ROOT, "src/index.ts")
  const child = spawn(nodeBin, [tsxCli, "--tsconfig", tsconfig, entry], {
    cwd: process.env.HOME ?? "/",
    env: {
      ...process.env,
      PATH: `${resolve(nodeBin, "..")}:${process.env.PATH ?? ""}`,
      DOTENV_CONFIG_QUIET: "true",
      SPINE_REPO_ROOT: REPO,
      SPINE_APP_ROOT: APP,
      SPINE_SESSION_PATH: resolve(APP, ".spine-session.json"),
    },
    stdio: ["pipe", "pipe", "pipe"],
  })

  const stderrChunks: string[] = []
  child.stderr?.on("data", (buf: Buffer) => {
    stderrChunks.push(buf.toString())
  })

  const rl = createInterface({ input: child.stdout })
  const replies: JsonRpc[] = []
  const wait = (id: number) =>
    new Promise<JsonRpc>((resolveReply, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`no MCP reply for id=${id}\nstderr:\n${stderrChunks.join("")}`))
      }, 20_000)
      const onLine = (line: string) => {
        const trimmed = line.trim()
        if (!trimmed.startsWith("{")) return
        try {
          const msg = JSON.parse(trimmed) as JsonRpc
          if (msg.id !== id) return
          rl.off("line", onLine)
          clearTimeout(timer)
          resolveReply(msg)
        } catch {
          reject(new Error(`non-JSON stdout: ${trimmed.slice(0, 200)}`))
        }
      }
      rl.on("line", onLine)
    })

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-boot-test", version: "0" },
      },
    })}\n`,
  )
  const init = await wait(1)
  replies.push(init)

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`)
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })}\n`)
  const tools = await wait(2)
  replies.push(tools)

  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "prompts/list" })}\n`)
  const prompts = await wait(3)
  replies.push(prompts)

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "apply_project_changes", arguments: { proposalJson: "not-json" } },
    })}\n`,
  )
  const badApply = await wait(4)

  child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "list_pieces", arguments: {} },
    })}\n`,
  )
  const pieces = await wait(5)

  child.kill("SIGTERM")
  return { init, tools, prompts, badApply, pieces, stderr: stderrChunks.join("") }
}

describe("MCP stdio boot", () => {
  it("keeps only JSON-RPC on stdout", () => {
    expect(isMcpStdoutChunk('{"jsonrpc":"2.0","id":1}\n')).toBe(true)
    expect(isMcpStdoutChunk('Content-Length: 12\r\n\r\n')).toBe(true)
    expect(isMcpStdoutChunk('{"level":"info","msg":"boot"}\n')).toBe(false)
    expect(isMcpStdoutChunk("tsx compiling...\n")).toBe(false)
  })
  it("initialize + tools/list + prompts/list over newline JSON-RPC", async () => {
    const { init, tools, prompts, badApply, pieces } = await handshake()
    expect(init.error, JSON.stringify(init.error)).toBeUndefined()
    const result = init.result as
      | { serverInfo?: { name?: string }; instructions?: string }
      | undefined
    expect(result?.serverInfo?.name).toBe("spine-pinpoint")
    expect(result?.instructions).toContain("get_project")
    expect(result?.instructions).toContain("auth_status")
    expect(result?.instructions).toContain("session_action")
    expect(result?.instructions).toContain("do not see the browser")
    expect(result?.instructions).toContain("list_seeds")
    expect(result?.instructions).toContain("testDocName")
    expect(result?.instructions).toContain("share.create-site")
    expect(result?.instructions).toContain("schedule.create")
    expect(result?.instructions).toContain("list_connect_actions")
    expect(result?.instructions).toContain("pipeline.add-step")
    expect(result?.instructions).not.toContain("add_step kind")
    expect(tools.error, JSON.stringify(tools.error)).toBeUndefined()
    const names = ((tools.result as { tools?: Array<{ name: string }> })?.tools ?? []).map((t) => t.name)
    expect(names).toContain("get_project")
    expect(names).toContain("auth_status")
    expect(names).toContain("pinpoint_failure")
    expect(names).toContain("ask_agent")
    expect(names).toContain("list_pieces")
    expect(names).toContain("configure_n8n_step")
    expect(names).toContain("list_connect_actions")
    expect(names).toContain("configure_connect_step")
    expect(names).toContain("import_piece")
    expect(names).toContain("export_piece")
    expect(names).toContain("wait_for_run")
    expect(names).toContain("get_run")
    expect(names).toContain("list_seeds")
    expect(names).toContain("pull_remote_state")
    expect(names).toContain("push_remote_state")
    expect(names).not.toContain("add_project")
    expect(names).not.toContain("add_step")
    expect(names).not.toContain("add_model")
    expect(names).not.toContain("add_doc")
    expect(names).not.toContain("remove_doc")
    expect(names).not.toContain("assign_input")
    expect(prompts.error, JSON.stringify(prompts.error)).toBeUndefined()
    const promptNames = ((prompts.result as { prompts?: Array<{ name: string }> })?.prompts ?? []).map(
      (p) => p.name,
    )
    expect(promptNames).toContain("vibe_loop")
    expect(promptNames).toContain("fix_test")
    expect(promptNames).toContain("add_pipeline_step")
    expect(promptNames).toContain("connect_spine")
    expect(promptNames).toContain("n8n_piece")
    expect(promptNames).toContain("connect_app")
    expect(promptNames).toContain("fork_dag")
    expect(promptNames).toContain("share_pipeline")
    expect(promptNames).toContain("schedule_pipeline")
    expect(badApply.error, JSON.stringify(badApply.error)).toBeUndefined()
    const applyText = (badApply.result as { content?: Array<{ text?: string }>; isError?: boolean }) ?? {}
    expect(applyText.isError).toBe(true)
    expect(applyText.content?.[0]?.text).toContain('"ok":false')
    expect(applyText.content?.[0]?.text).toContain("next")
    const piecesText = (pieces.result as { content?: Array<{ text?: string }> })?.content?.[0]?.text ?? ""
    expect(piecesText).toContain("n8n-nodes-base.set")
    expect(piecesText).toContain("n8n-nodes-base.filter")
    expect(piecesText).not.toContain('"props"')
  }, 30_000)

  it("launcher + official SDK client works without SPINE_* env", async () => {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js")
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js")
    const { mkdtempSync, rmSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")
    const dir = mkdtempSync(join(tmpdir(), "mcp-sdk-"))
    const sessionPath = join(dir, "session.json")
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [resolve(MCP_ROOT, "spine-mcp.mjs")],
      cwd: process.env.HOME ?? "/",
      stderr: "pipe",
      env: {
        PATH: `${resolve(process.execPath, "..")}:${process.env.PATH ?? ""}`,
        DOTENV_CONFIG_QUIET: "true",
        SPINE_SESSION_PATH: sessionPath,
      },
    })
    const client = new Client({ name: "mcp-sdk-test", version: "0" })
    try {
      await client.connect(transport)
      const instructions = client.getInstructions() ?? ""
      expect(instructions).toContain("auth_status")
      expect(instructions).toContain("Do not clone")
      const tools = await client.listTools()
      expect(tools.tools.some((t) => t.name === "auth_status")).toBe(true)
      expect(tools.tools.some((t) => t.name === "list_seeds")).toBe(true)
      const status = await client.callTool({ name: "auth_status", arguments: { sessionPath } })
      const text = (status.content as Array<{ text?: string }>)[0]?.text ?? "{}"
      const body = JSON.parse(text) as { projectCount: number; next: string; appRoot?: string; seeds?: string[] }
      expect(body.projectCount).toBe(0)
      expect(body.next).toMatch(/project\.add|session_action/)
      expect(body.seeds?.length).toBeGreaterThan(0)
      expect(String(body.appRoot)).toMatch(/combined_full_stack$/)
      const prompt = await client.getPrompt({ name: "connect_spine" })
      const promptText = JSON.stringify(prompt)
      expect(promptText).toContain("Do not clone or search the repo")
      expect(promptText).toContain("auth_status")
      const addStep = await client.getPrompt({ name: "add_pipeline_step", arguments: { kind: "n8n", purpose: "limit rows" } })
      const addStepText = JSON.stringify(addStep)
      expect(addStepText).toContain("pipeline.add-step")
      expect(addStepText).not.toContain("add_step kind")
    } finally {
      await client.close()
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)
})
