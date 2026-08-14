// AI : spawn the real stdio server — vitest imports do not catch tsx ESM / stdout handshake failures.
import { spawn } from "node:child_process"
import { createInterface } from "node:readline"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const MCP_ROOT = resolve(import.meta.dirname, "..")
const REPO = resolve(MCP_ROOT, "..")
const APP = resolve(REPO, "combined_full_stack")

type JsonRpc = { jsonrpc: "2.0"; id?: number; result?: unknown; error?: { message: string } }

async function handshake(): Promise<{ init: JsonRpc; tools: JsonRpc; prompts: JsonRpc; stderr: string }> {
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

  child.kill("SIGTERM")
  return { init, tools, prompts, stderr: stderrChunks.join("") }
}

describe("MCP stdio boot", () => {
  it("initialize + tools/list + prompts/list over newline JSON-RPC", async () => {
    const { init, tools, prompts } = await handshake()
    expect(init.error, JSON.stringify(init.error)).toBeUndefined()
    const result = init.result as
      | { serverInfo?: { name?: string }; instructions?: string }
      | undefined
    expect(result?.serverInfo?.name).toBe("spine-pinpoint")
    expect(result?.instructions).toContain("get_project")
    expect(result?.instructions).toContain("session_action")
    expect(result?.instructions).toContain("do not see the browser")
    expect(tools.error, JSON.stringify(tools.error)).toBeUndefined()
    const names = ((tools.result as { tools?: Array<{ name: string }> })?.tools ?? []).map((t) => t.name)
    expect(names).toContain("get_project")
    expect(names).toContain("pinpoint_failure")
    expect(names).toContain("ask_agent")
    expect(prompts.error, JSON.stringify(prompts.error)).toBeUndefined()
    const promptNames = ((prompts.result as { prompts?: Array<{ name: string }> })?.prompts ?? []).map(
      (p) => p.name,
    )
    expect(promptNames).toContain("vibe_loop")
    expect(promptNames).toContain("fix_test")
    expect(promptNames).toContain("add_pipeline_step")
  })
})
