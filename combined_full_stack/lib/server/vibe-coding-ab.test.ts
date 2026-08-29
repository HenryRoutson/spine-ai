// AI : A/B JSON vs file-harness. Seed is a notes stub — do not paste few-shot payloads (reward hacking).
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { config as loadEnv } from "dotenv"
import { createSpineSession } from "@/lib/core/session"
import { proposePipelineChange } from "@/lib/server/pipeline_assistant"
import { clearLlmProviderCache } from "@/lib/server/llm/registry"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { ModuleKind } from "@/lib/types"
import {
  exampleTopologyHit,
  vibeExampleTasks,
  type VibeExampleTask,
} from "@/lib/server/vibe-coding-examples"

loadEnv({ path: resolve(import.meta.dirname, "../../.env.local") })
loadEnv({ path: resolve(import.meta.dirname, "../../../.env") })

const TASKS = vibeExampleTasks()

type Mode = "json" | "harness"

type VibeAbScore = {
  mode: Mode
  task: string
  hasProposal: boolean
  valid: boolean
  topologyHit: boolean
  reliable: boolean
  invalidCount: number
  stepCount: number
  kinds: string[]
  hasLlm: boolean
  inputCount: number
  hasDocs: boolean
  promptTokens: number
  completionTokens: number
  capability: number
  elapsedMs: number
  usageCents?: number
  generator?: "harness" | "json"
  error?: string
}

function scoreTask(ex: VibeExampleTask, mode: Mode, result: Awaited<ReturnType<typeof proposePipelineChange>>): VibeAbScore {
  const proposal = result.proposal
  const steps = proposal ? flattenPipelineModules(proposal.modules) : []
  const kinds = steps.map((s) => s.kind)
  const hasLlm = kinds.some((k) => k === ModuleKind.Llm || k === ModuleKind.LlmBatch)
  const inputCount = steps.filter((s) => s.kind === ModuleKind.Input).length
  const hasDocs = (proposal?.docs.length ?? 0) > 0
  const valid = Boolean(proposal) && result.invalidCount === 0
  const topologyHit = exampleTopologyHit(ex, kinds, inputCount)
  const reliable = valid && topologyHit
  let capability = 0
  if (proposal) capability += 1
  if (valid) capability += 2
  if (hasLlm) capability += 1
  if (topologyHit) capability += 1
  if (ex.expectDocs ? hasDocs : true) capability += 1
  return {
    mode,
    task: ex.id,
    hasProposal: Boolean(proposal),
    valid,
    topologyHit,
    reliable,
    invalidCount: result.invalidCount,
    stepCount: steps.length,
    kinds,
    hasLlm,
    inputCount,
    hasDocs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    capability,
    elapsedMs: 0,
    usageCents: result.usageCents,
  }
}

async function runMode(mode: Mode, ex: VibeExampleTask): Promise<VibeAbScore> {
  process.env.SPINE_VIBE_HARNESS = mode === "harness" ? "1" : "0"
  const session = createSpineSession()
  session.addProject({ open: true })
  const t0 = Date.now()
  const labels: string[] = []
  try {
    const result = await proposePipelineChange(session.project!, ex.prompt, [], undefined, {
      onLlmResponse: (label) => {
        labels.push(label)
      },
    })
    const scored = scoreTask(ex, mode, result)
    const generator = labels.includes("harness-done") ? "harness" : "json"
    return { ...scored, generator, elapsedMs: Date.now() - t0 }
  } catch (err) {
    return {
      mode,
      task: ex.id,
      hasProposal: false,
      valid: false,
      topologyHit: false,
      reliable: false,
      invalidCount: -1,
      stepCount: 0,
      kinds: [],
      hasLlm: false,
      inputCount: 0,
      hasDocs: false,
      promptTokens: 0,
      completionTokens: 0,
      capability: 0,
      elapsedMs: Date.now() - t0,
      generator: mode,
      error: (err as Error).message,
    }
  }
}

function hasLiveOpenRouterKey(): boolean {
  const key = process.env.OPENROUTER_API_KEY?.trim() ?? ""
  return key.startsWith("sk-or-v1-") && !/placeholder|local-dev/i.test(key)
}

function summaryLines(rows: VibeAbScore[]): string[] {
  const lines = [
    "",
    "## Overall (reliability % · seconds per task)",
    "",
    "| mode | n | reliable | reliability % | valid | topology | seconds/task | mean promptTok | mean completionTok |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]
  for (const mode of ["json", "harness"] as const) {
    const slice = rows.filter((r) => r.mode === mode)
    if (!slice.length) continue
    const n = slice.length
    const reliable = slice.filter((r) => r.reliable).length
    const meanTok = (key: "promptTokens" | "completionTokens") =>
      Math.round(slice.reduce((s, r) => s + r[key], 0) / n)
    const seconds = slice.reduce((s, r) => s + r.elapsedMs, 0) / n / 1000
    const pct = ((100 * reliable) / n).toFixed(1)
    lines.push(
      `| ${mode} | ${n} | ${reliable}/${n} | ${pct}% | ${slice.filter((r) => r.valid).length}/${n} | ${slice.filter((r) => r.topologyHit).length}/${n} | ${seconds.toFixed(1)} | ${meanTok("promptTokens")} | ${meanTok("completionTokens")} |`,
    )
  }
  return lines
}

function writeAbArtifacts(name: string, title: string, note: string, rows: VibeAbScore[]): void {
  mkdirSync("/opt/cursor/artifacts", { recursive: true })
  writeFileSync(
    `/opt/cursor/artifacts/${name}.json`,
    `${JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2)}\n`,
  )
  const lines = [
    `# ${title}`,
    "",
    note,
    "",
    "| task | mode | generator | capability | valid | topology | reliable | sec | steps | kinds | promptTok | completionTok | note |",
    "| --- | --- | --- | ---: | --- | --- | --- | ---: | ---: | --- | ---: | ---: | --- |",
    ...rows.map(
      (r) =>
        `| ${r.task} | ${r.mode} | ${r.generator ?? "?"} | ${r.capability} | ${r.valid} | ${r.topologyHit} | ${r.reliable} | ${(r.elapsedMs / 1000).toFixed(1)} | ${r.stepCount} | ${r.kinds.join("+") || "—"} | ${r.promptTokens} | ${r.completionTokens} | ${r.error ?? ""} |`,
    ),
    ...summaryLines(rows),
    "",
  ]
  writeFileSync(`/opt/cursor/artifacts/${name}.md`, `${lines.join("\n")}\n`)
}

describe("vibe json vs file-harness A/B (seed LLM)", () => {
  const prevProvider = process.env.LLM_PROVIDER
  const prevHarness = process.env.SPINE_VIBE_HARNESS
  const rows: VibeAbScore[] = []

  beforeAll(() => {
    process.env.LLM_PROVIDER = "seed"
    clearLlmProviderCache()
  })

  afterAll(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    if (prevHarness === undefined) delete process.env.SPINE_VIBE_HARNESS
    else process.env.SPINE_VIBE_HARNESS = prevHarness
    clearLlmProviderCache()
    writeAbArtifacts(
      "vibe-ab-seed-no-lookup",
      "Vibe JSON vs file-harness A/B (seed LLM, few-shot tasks, no answer-key lookup)",
      "Seed emits a generic notes stub. Looking up the matching few-shot payload is reward hacking and was removed. Reliable = valid AND topology. Wiring = hasProposal. Coding quality is OpenRouter only.",
      rows,
    )
  })

  for (const ex of TASKS) {
    it(`${ex.id}: json path returns a proposal (seed is a stub, not the few-shot answer)`, async () => {
      const json = await runMode("json", ex)
      rows.push(json)
      expect(json.hasProposal, `${ex.id} json proposal`).toBe(true)
      expect(json.kinds, `${ex.id} json seed stub, not few-shot ${ex.topology}`).toEqual([
        "input",
        "llm-batch",
        "output",
      ])
    })

    it(`${ex.id}: file harness returns a proposal without pasting the few-shot answer`, async () => {
      const json = rows.find((r) => r.task === ex.id && r.mode === "json")
      const harness = await runMode("harness", ex)
      rows.push(harness)
      expect(json).toBeTruthy()
      expect(harness.hasProposal, `${ex.id} harness proposal err=${harness.error}`).toBe(true)
      expect(harness.generator, `${ex.id} must use the file loop`).toBe("harness")
    })
  }
})

describe.skipIf(!hasLiveOpenRouterKey())("vibe json vs file-harness A/B (OpenRouter, all examples)", () => {
  const prevProvider = process.env.LLM_PROVIDER
  const prevHarness = process.env.SPINE_VIBE_HARNESS
  const rows: VibeAbScore[] = []

  beforeAll(() => {
    delete process.env.LLM_PROVIDER
    clearLlmProviderCache()
  })

  afterAll(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    if (prevHarness === undefined) delete process.env.SPINE_VIBE_HARNESS
    else process.env.SPINE_VIBE_HARNESS = prevHarness
    clearLlmProviderCache()
    writeAbArtifacts(
      "vibe-ab-openrouter",
      "Vibe JSON vs file-harness A/B (OpenRouter, all few-shot examples)",
      "Live DEFAULT_MODEL. Reliable = valid AND topology. Overall metric = reliability % and mean seconds/task.",
      rows,
    )
  })

  for (const ex of TASKS) {
    it(
      `${ex.id}: json path proposes a pipeline`,
      { timeout: 600_000 },
      async () => {
        const json = await runMode("json", ex)
        rows.push(json)
        expect(json.hasProposal, `${ex.id} json proposal err=${json.error}`).toBe(true)
        expect(json.hasLlm, `${ex.id} json has llm kinds=${json.kinds.join(",")}`).toBe(true)
      },
    )

    it(
      `${ex.id}: file harness proposes a pipeline`,
      { timeout: 600_000 },
      async () => {
        const harness = await runMode("harness", ex)
        rows.push(harness)
        expect(harness.hasProposal, `${ex.id} harness proposal err=${harness.error}`).toBe(true)
        expect(harness.hasLlm, `${ex.id} harness has llm kinds=${harness.kinds.join(",")}`).toBe(true)
      },
    )
  }
})
