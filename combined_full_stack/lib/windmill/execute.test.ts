import { describe, expect, it, afterEach } from "vitest"
import { createWindmillClient, setWindmillClientForTests } from "@/lib/windmill/client"
import { runCustomCodeOnWindmill, runN8nPieceOnWindmill, shouldRunOnWindmill } from "@/lib/windmill/execute"
import { bunMainForN8n, bunMainForCustomTs, pythonMainForCustom } from "@/lib/windmill/scripts"
import { getN8nNode } from "@/lib/n8n-catalog"
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"

describe("Windmill sandbox wrappers", () => {
  afterEach(() => {
    setWindmillClientForTests(null)
  })

  it("does not enable Windmill without project flag + env", () => {
    expect(shouldRunOnWindmill({}, {})).toBe(false)
    expect(shouldRunOnWindmill({ windmillExecute: true }, {})).toBe(false)
    expect(
      shouldRunOnWindmill(
        { windmillExecute: true },
        { WINDMILL_URL: "https://windmill.example", WINDMILL_TOKEN: "wm_tok" },
      ),
    ).toBe(true)
  })

  it("inlines n8n piece JS into a bun main (no new Function)", () => {
    const entry = getN8nNode("n8n-nodes-base.set")
    expect(entry).toBeTruthy()
    const src = bunMainForN8n(entry!.n8nCode, { keepOnlySet: true, assignments: { vendor: "={{ $json.name }}" } })
    expect(src).toContain("export async function main")
    expect(src).not.toContain("new Function")
    expect(src).toContain("keepOnlySet")
  })

  it("wraps TypeScript custom-code as Windmill main", () => {
    const src = bunMainForCustomTs("(input) => input")
    expect(src).toContain("export async function main")
    expect(src).toContain("fn(input, state)")
  })

  it("wraps Python transform as Windmill main", () => {
    const src = pythonMainForCustom("return input")
    expect(src).toContain("def transform")
    expect(src).toContain("def main")
  })

  it("runs n8n pieces through the Windmill preview client when injected", async () => {
    const calls: unknown[] = []
    setWindmillClientForTests({
      async runPreview(req) {
        calls.push(req)
        return { vendor: "Acme" }
      },
    })
    const out = await runN8nPieceOnWindmill({
      n8nNodeType: "n8n-nodes-base.set",
      n8nParameters: { keepOnlySet: true, assignments: { vendor: "={{ $json.name }}" } },
      input: { name: "Acme" },
    })
    expect(out).toEqual({ vendor: "Acme" })
    expect(calls).toHaveLength(1)
    const req = calls[0] as { language: string; content: string; args: { input: unknown }; timeoutMs?: number }
    expect(req.language).toBe("bun")
    expect(req.content).toContain("export async function main")
    expect(req.args.input).toEqual({ name: "Acme" })
    expect(req.timeoutMs).toBe(60_000)
  })

  it("runs custom-code through Windmill preview when injected", async () => {
    const calls: unknown[] = []
    setWindmillClientForTests({
      async runPreview(req) {
        calls.push(req)
        return { doubled: 4 }
      },
    })
    const m = {
      id: "m1" as ModuleId,
      kind: ModuleKind.CustomCode,
      label: "Double",
      code: "(input) => input",
    } as PipelineModule
    const out = await runCustomCodeOnWindmill(m, { n: 2 }, {})
    expect(out).toEqual({ doubled: 4 })
    const req = calls[0] as { language: string; content: string; args: { input: unknown }; timeoutMs: number }
    expect(req.language).toBe("bun")
    expect(req.content).toContain("export async function main")
    expect(req.args.input).toEqual({ n: 2 })
    expect(req.timeoutMs).toBe(60_000)
  })

  it("surfaces Windmill preview HTTP errors", async () => {
    const client = createWindmillClient(
      { url: "https://wm.example", token: "tok", workspace: "admins" },
      async (url) => {
        expect(String(url)).toContain("/api/w/admins/jobs/run_wait_result/preview?timeout=")
        return new Response("nope", { status: 500 })
      },
    )
    await expect(
      client.runPreview({ language: "bun", content: "export async function main() {}", args: {} }),
    ).rejects.toThrow(/500/)
  })
})
