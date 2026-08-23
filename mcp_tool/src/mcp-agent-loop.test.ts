// AI : Claude-Code-shaped loop over stdio — import seed, pieces, fork, n8n, validate — no live Cursor MCP.
import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { describe, expect, it } from "vitest"

const MCP_ROOT = resolve(import.meta.dirname, "..")
const REPO = resolve(MCP_ROOT, "..")
const APP = resolve(REPO, "combined_full_stack")

type JsonRpc = { jsonrpc: "2.0"; id?: number; result?: unknown; error?: { message: string } }

type CallResult = {
  isError?: boolean
  content?: Array<{ text?: string }>
}

function parseTool(msg: JsonRpc): unknown {
  const result = msg.result as CallResult | undefined
  const text = result?.content?.[0]?.text ?? "{}"
  return JSON.parse(text) as unknown
}

async function withMcp(
  sessionPath: string,
  fn: (call: (id: number, name: string, args: Record<string, unknown>) => Promise<JsonRpc>) => Promise<void>,
) {
  const child = spawn(
    process.execPath,
    [
      resolve(MCP_ROOT, "node_modules/tsx/dist/cli.mjs"),
      "--tsconfig",
      resolve(MCP_ROOT, "tsconfig.json"),
      resolve(MCP_ROOT, "src/index.ts"),
    ],
    {
      cwd: process.env.HOME ?? "/",
      env: {
        ...process.env,
        PATH: `${resolve(process.execPath, "..")}:${process.env.PATH ?? ""}`,
        DOTENV_CONFIG_QUIET: "true",
        SPINE_REPO_ROOT: REPO,
        SPINE_APP_ROOT: APP,
        SPINE_SESSION_PATH: sessionPath,
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  )
  const stderrChunks: string[] = []
  child.stderr?.on("data", (buf: Buffer) => {
    stderrChunks.push(buf.toString())
  })
  const rl = createInterface({ input: child.stdout })
  const wait = (id: number) =>
    new Promise<JsonRpc>((resolveReply, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`no MCP reply for id=${id}\nstderr:\n${stderrChunks.join("")}`))
      }, 25_000)
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
        clientInfo: { name: "mcp-agent-loop", version: "0" },
      },
    })}\n`,
  )
  const init = await wait(1)
  if (init.error) throw new Error(JSON.stringify(init.error))
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`)

  const call = async (id: number, name: string, args: Record<string, unknown>) => {
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } })}\n`,
    )
    return wait(id)
  }

  try {
    await fn(call)
  } finally {
    child.kill("SIGTERM")
  }
}

describe("MCP agent loop without the codebase", () => {
  it("import_seed → list_pieces → n8n in a fork lane → validate → wait_for_run envelope", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-loop-"))
    const sessionPath = join(dir, "session.json")
    try {
      await withMcp(sessionPath, async (call) => {
        const imported = await call(2, "import_seed", { file: "lead_enrich_n8n.json", sessionPath })
        expect(imported.error).toBeUndefined()
        const importedBody = parseTool(imported) as { name: string }
        expect(importedBody.name).toBe("Lead Enrich Fork (n8n pieces)")

        const project = parseTool(await call(3, "get_project", { sessionPath })) as {
          steps: Array<{
            kind: string
            id: string
            branches?: Array<{ id: string; label: string; steps: Array<{ n8nNodeType?: string }> }>
          }>
        }
        const steps = project.steps
        const fork = steps.find((s) => s.kind === "fork")
        expect(fork?.branches?.length).toBeGreaterThanOrEqual(2)
        expect(fork?.branches?.some((b) => b.steps.some((st) => st.n8nNodeType === "n8n-nodes-base.crypto"))).toBe(true)

        const pieces = parseTool(await call(4, "list_pieces", {})) as { pieces: Array<{ n8nNodeType: string }> }
        expect(pieces.pieces.some((p) => p.n8nNodeType === "n8n-nodes-base.filter")).toBe(true)

        const added = parseTool(
          await call(5, "add_step", {
            sessionPath,
            kind: "n8n",
            label: "Limit extras",
            forkId: fork!.id,
            branchId: fork!.branches![0]!.id,
          }),
        ) as Array<{ id: string; kind: string }>
        expect(added[0]?.kind).toBe("n8n")

        const configured = parseTool(
          await call(6, "configure_n8n_step", {
            sessionPath,
            stepId: added[0]!.id,
            n8nNodeType: "n8n-nodes-base.limit",
            parametersJson: JSON.stringify({ maxItems: 5 }),
          }),
        ) as { n8nNodeType?: string }
        expect(configured.n8nNodeType).toBe("n8n-nodes-base.limit")

        const validated = parseTool(await call(7, "validate_project", { sessionPath })) as { ok?: boolean }
        expect(validated).toHaveProperty("ok")

        const waitRun = await call(8, "wait_for_run", { sessionPath })
        const waitBody = parseTool(waitRun) as { ok?: boolean; next?: string }
        const result = waitRun.result as CallResult
        expect(result.isError).toBe(true)
        expect(waitBody.ok).toBe(false)
        expect(String(waitBody.next)).toMatch(/start_run|SPINE_API_URL|wait_for_run/)
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("connect_spine from an empty session without reading the repo", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-connect-"))
    const sessionPath = join(dir, "session.json")
    try {
      await withMcp(sessionPath, async (call) => {
        const status = parseTool(await call(2, "auth_status", { sessionPath })) as {
          projectCount: number
          next: string
        }
        expect(status.projectCount).toBe(0)
        expect(status.next).toMatch(/add_project/)

        const missing = await call(3, "get_project", { sessionPath })
        expect((missing.result as CallResult).isError).toBe(true)
        expect(JSON.stringify(parseTool(missing))).toMatch(/add_project/)

        const created = parseTool(await call(4, "add_project", { sessionPath })) as { id: string }
        expect(created.id).toBeTruthy()

        const model = parseTool(await call(5, "add_model", { sessionPath, name: "Lead" })) as { name: string }
        expect(model.name).toBe("Lead")

        await call(6, "session_action", {
          id: "structure.add-field",
          sessionPath,
          model: "Lead",
          name: "email",
          type: "string",
        })

        const input = parseTool(await call(7, "add_step", { sessionPath, kind: "INPUT", label: "Leads" })) as Array<{
          kind: string
        }>
        expect(input[0]?.kind).toBe("input")

        const llm = parseTool(await call(8, "add_step", { sessionPath, kind: "llm", label: "Extract" })) as Array<{
          kind: string
        }>
        expect(llm[0]?.kind).toBe("llm")

        const n8n = parseTool(await call(9, "add_step", { sessionPath, kind: "piece", label: "Set fields" })) as Array<{
          kind: string
          id: string
        }>
        expect(n8n[0]?.kind).toBe("n8n")
        await call(10, "configure_n8n_step", {
          sessionPath,
          stepId: n8n[0]!.id,
          n8nNodeType: "n8n-nodes-base.set",
          parametersJson: JSON.stringify({ keepOnlySet: true }),
        })

        const project = parseTool(await call(11, "get_project", { sessionPath })) as {
          models: Array<{ name: string; fields: string[] }>
          steps: Array<{ kind: string; n8nNodeType?: string; n8nParameters?: Record<string, unknown> }>
        }
        expect(project.models.some((m) => m.name === "Lead" && m.fields.some((f) => f.startsWith("email:")))).toBe(true)
        expect(project.steps.some((s) => s.kind === "n8n" && s.n8nNodeType === "n8n-nodes-base.set")).toBe(true)

        const validated = parseTool(await call(12, "validate_project", { sessionPath })) as { ok?: boolean }
        expect(validated).toHaveProperty("ok")
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
