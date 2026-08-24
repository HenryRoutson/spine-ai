// AI : lock vibe-coding MCP budgets so context bloat / blocking ask_agent / hung API cannot regress quietly.
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { createFilePersist } from "@/lib/cli/session_persist"
import { DocLabel, InputType, ModuleKind, type ModuleId } from "@/lib/server/types"
import {
  MCP_API_TIMEOUT_MS,
  addDocFromSession,
  addStepFromSession,
  askAgentFromSession,
  authStatusFromSession,
  getProjectFromSession,
  importSeedFromSession,
  setDocsFromSession,
  validateProjectFromSession,
} from "./spine-session-bar-a.js"

vi.mock("@/lib/cli/agent", () => ({
  askAgent: vi.fn(() => new Promise(() => {})),
}))

// AI : CI-friendly ceilings — measured lead_enrich get_project ≈ 2.4KB / ~3ms locally.
const GET_PROJECT_BYTES_BUDGET = 12_000
const GET_PROJECT_MS_BUDGET = 100
const VALIDATE_MS_BUDGET = 100
const AUTH_STATUS_MS_BUDGET = 500
const ASK_AGENT_PAIR_MS_BUDGET = 500
const VIBE_LOOP_MS_BUDGET = 1_500
const PROMPT_SLICE = 240
const NOTE_SLICE = 160

type StepReview = {
  prompt?: string
  note?: string
  inputDescription?: string
  branches?: Array<{ steps: StepReview[] }>
}

function withTempSession(prefix: string, fn: (sessionPath: string) => void | Promise<void>) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  const sessionPath = join(dir, "session.json")
  return (async () => {
    try {
      await fn(sessionPath)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })()
}

function walkSteps(steps: StepReview[]): StepReview[] {
  return steps.flatMap((s) => [s, ...(s.branches ?? []).flatMap((b) => walkSteps(b.steps ?? []))])
}

describe("MCP vibe coding performance regressions", () => {
  it("keeps API egress timeout bounded so hung Next cannot stall vibe agents", () => {
    expect(MCP_API_TIMEOUT_MS).toBeLessThanOrEqual(8_000)
    expect(MCP_API_TIMEOUT_MS).toBeGreaterThan(0)
  })

  it("get_project stays a compact review on a real seed (byte + latency budget)", async () => {
    await withTempSession("mcp-vibe-bytes-", (sessionPath) => {
      importSeedFromSession("lead_enrich_n8n", sessionPath)
      getProjectFromSession(sessionPath)

      const times: number[] = []
      let review: ReturnType<typeof getProjectFromSession> | null = null
      for (let i = 0; i < 10; i++) {
        const t0 = performance.now()
        review = getProjectFromSession(sessionPath)
        times.push(performance.now() - t0)
      }
      const raw = JSON.stringify(review)
      const p90 = [...times].sort((a, b) => a - b)[8]!

      expect(raw.length).toBeLessThan(GET_PROJECT_BYTES_BUDGET)
      expect(p90).toBeLessThan(GET_PROJECT_MS_BUDGET)
      expect(review).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        steps: expect.any(Array),
        models: expect.any(Array),
        next: expect.any(String),
      })
      expect(raw).not.toMatch(/"documentation"|"chatTurns"|"messages"|docContents/)
      expect(Object.keys(review!).sort()).toEqual(
        [
          "assistantInFlight",
          "docs",
          "id",
          "idTypes",
          "issues",
          "kind",
          "models",
          "name",
          "next",
          "ok",
          "pendingChanged",
          "pendingProposal",
          "requiredSecrets",
          "steps",
        ].sort(),
      )
    })
  })

  it("get_project does not leak large documentation or doc bodies into agent context", async () => {
    await withTempSession("mcp-vibe-fat-", (sessionPath) => {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      const blob = "Z".repeat(80_000)
      session.setDocumentation(blob)
      session.addDocContent({
        name: "lease.txt",
        content: blob,
        type: InputType.Text,
        label: DocLabel.Document,
      })

      const review = getProjectFromSession(sessionPath)
      const raw = JSON.stringify(review)
      expect(raw.length).toBeLessThan(GET_PROJECT_BYTES_BUDGET)
      expect(raw.includes(blob)).toBe(false)
      expect(raw).not.toContain(blob.slice(0, 200))
      expect(review.docs.some((d: { name: string }) => d.name === "lease.txt")).toBe(true)
    })
  })

  it("truncates long step prompts/notes so vibe reviews cannot grow without bound", async () => {
    await withTempSession("mcp-vibe-trunc-", (sessionPath) => {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      const longPrompt = "P".repeat(1_000)
      const longNote = "N".repeat(800)
      session.setModules([
        {
          id: "mod_llm" as ModuleId,
          kind: ModuleKind.Llm,
          label: "Extract",
          note: longNote,
          cached: true,
          avgMs: 0,
          avgCostCents: 0,
          prompt: longPrompt,
        },
      ])

      const review = getProjectFromSession(sessionPath) as { steps: StepReview[] }
      const step = walkSteps(review.steps).find((s) => s.prompt || s.note)
      expect(step?.prompt?.length).toBeLessThanOrEqual(PROMPT_SLICE)
      expect(step?.note?.length).toBeLessThanOrEqual(NOTE_SLICE)
      expect(JSON.stringify(review).includes(longPrompt)).toBe(false)
    })
  })

  it("hot path tools stay under latency budgets (validate + auth_status)", async () => {
    await withTempSession("mcp-vibe-hot-", async (sessionPath) => {
      importSeedFromSession("lead_enrich_n8n", sessionPath)
      validateProjectFromSession(sessionPath)
      await authStatusFromSession(sessionPath)

      const tV0 = performance.now()
      validateProjectFromSession(sessionPath)
      expect(performance.now() - tV0).toBeLessThan(VALIDATE_MS_BUDGET)

      const tA0 = performance.now()
      await authStatusFromSession(sessionPath)
      expect(performance.now() - tA0).toBeLessThan(AUTH_STATUS_MS_BUDGET)
    })
  })

  it("ask_agent returns inFlight immediately so vibe agents can poll get_project", async () => {
    await withTempSession("mcp-vibe-ask-", async (sessionPath) => {
      const session = createSpineSession({ persist: createFilePersist(sessionPath) })
      session.addProject({ open: true })
      const started = performance.now()
      const first = await askAgentFromSession("build a pipeline", sessionPath, "vibe")
      const second = await askAgentFromSession("build a pipeline", sessionPath, "vibe")
      expect(performance.now() - started).toBeLessThan(ASK_AGENT_PAIR_MS_BUDGET)
      expect(first.data.inFlight).toBe(true)
      expect(second.data.inFlight).toBe(true)

      const review = getProjectFromSession(sessionPath)
      expect(review.next).toMatch(/Poll get_project|still running/i)
    })
  })

  it("vibe edit loop (seed → get_project → mutate → validate) stays under wall budget", async () => {
    await withTempSession("mcp-vibe-loop-", async (sessionPath) => {
      const t0 = performance.now()
      importSeedFromSession("lead_enrich_n8n", sessionPath)
      const before = getProjectFromSession(sessionPath)
      expect(before.next).toBeTruthy()
      addStepFromSession("llm", "Perf probe step", sessionPath)
      addDocFromSession({ sessionPath, name: "note.txt", content: "tiny" })
      setDocsFromSession("# docs", sessionPath)
      const validated = validateProjectFromSession(sessionPath)
      const after = getProjectFromSession(sessionPath)
      expect(validated).toHaveProperty("ok")
      expect(after.steps.some((s: { label: string }) => s.label === "Perf probe step")).toBe(true)
      expect(performance.now() - t0).toBeLessThan(VIBE_LOOP_MS_BUDGET)
    })
  })
})
