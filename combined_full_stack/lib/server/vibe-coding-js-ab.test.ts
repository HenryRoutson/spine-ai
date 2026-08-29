// AI : A/B JSON vs spine-js × direct vs harness. Seed is a notes stub — do not paste few-shot payloads (reward hacking).
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
import { isLiveOpenRouterApiKey } from "@/lib/server/config"

loadEnv({ path: resolve(import.meta.dirname, "../../.env.local") })
loadEnv({ path: resolve(import.meta.dirname, "../../../.env") })

const TASKS = vibeExampleTasks()

type Authoring = "json" | "js"
type Collection = "direct" | "harness"
type Mode = `${Authoring}-${Collection}`

type Score = {
  mode: Mode
  authoring: Authoring
  collection: Collection
  task: string
  hasProposal: boolean
  valid: boolean
  topologyHit: boolean
  reliable: boolean
  invalidCount: number
  stepCount: number
  kinds: string[]
  hasLlm: boolean
  promptTokens: number
  completionTokens: number
  elapsedMs: number
  generator?: string
  error?: string
}

function scoreTask(ex: VibeExampleTask, mode: Mode, result: Awaited<ReturnType<typeof proposePipelineChange>>): Omit<Score, "elapsedMs" | "generator"> {
  const proposal = result.proposal
  const steps = proposal ? flattenPipelineModules(proposal.modules) : []
  const kinds = steps.map((s) => s.kind)
  const valid = Boolean(proposal) && result.invalidCount === 0
  const topologyHit = exampleTopologyHit(ex, kinds, steps.filter((s) => s.kind === ModuleKind.Input).length)
  return {
    mode,
    authoring: mode.startsWith("js") ? "js" : "json",
    collection: mode.endsWith("harness") ? "harness" : "direct",
    task: ex.id,
    hasProposal: Boolean(proposal),
    valid,
    topologyHit,
    reliable: valid && topologyHit,
    invalidCount: result.invalidCount,
    stepCount: steps.length,
    kinds,
    hasLlm: kinds.some((k) => k === ModuleKind.Llm || k === ModuleKind.LlmBatch),
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
  }
}

async function runMode(authoring: Authoring, collection: Collection, ex: VibeExampleTask): Promise<Score> {
  const mode: Mode = `${authoring}-${collection}`
  process.env.SPINE_VIBE_AUTHORING = authoring
  process.env.SPINE_VIBE_HARNESS = collection === "harness" ? "1" : "0"
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
    const generator = labels.includes("harness-done") ? "harness" : labels.includes("js-authoring") ? "js" : "json"
    return { ...scored, generator, elapsedMs: Date.now() - t0 }
  } catch (err) {
    return {
      mode,
      authoring,
      collection,
      task: ex.id,
      hasProposal: false,
      valid: false,
      topologyHit: false,
      reliable: false,
      invalidCount: -1,
      stepCount: 0,
      kinds: [],
      hasLlm: false,
      promptTokens: 0,
      completionTokens: 0,
      elapsedMs: Date.now() - t0,
      generator: mode,
      error: (err as Error).message,
    }
  }
}

function hasLiveOpenRouterKey(): boolean {
  return isLiveOpenRouterApiKey()
}

function summaryLines(rows: Score[]): string[] {
  const lines = [
    "",
    "## Overall (reliability % · seconds per task)",
    "",
    "| mode | n | reliable | reliability % | valid | topology | seconds/task | mean promptTok | mean completionTok |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ]
  for (const mode of ["json-direct", "json-harness", "js-direct", "js-harness"] as const) {
    const slice = rows.filter((r) => r.mode === mode)
    if (!slice.length) continue
    const n = slice.length
    const reliable = slice.filter((r) => r.reliable).length
    const meanTok = (key: "promptTokens" | "completionTokens") => Math.round(slice.reduce((s, r) => s + r[key], 0) / n)
    const seconds = slice.reduce((s, r) => s + r.elapsedMs, 0) / n / 1000
    const pct = ((100 * reliable) / n).toFixed(1)
    lines.push(
      `| ${mode} | ${n} | ${reliable}/${n} | ${pct}% | ${slice.filter((r) => r.valid).length}/${n} | ${slice.filter((r) => r.topologyHit).length}/${n} | ${seconds.toFixed(1)} | ${meanTok("promptTokens")} | ${meanTok("completionTokens")} |`,
    )
  }
  return lines
}

function writeArtifacts(name: string, title: string, note: string, rows: Score[]): void {
  mkdirSync("/opt/cursor/artifacts", { recursive: true })
  writeFileSync(`/opt/cursor/artifacts/${name}.json`, `${JSON.stringify({ generated: new Date().toISOString(), rows }, null, 2)}\n`)
  const lines = [
    `# ${title}`,
    "",
    note,
    "",
    "| task | mode | generator | valid | topology | reliable | sec | steps | kinds | promptTok | completionTok | note |",
    "| --- | --- | --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: | --- |",
    ...rows.map(
      (r) =>
        `| ${r.task} | ${r.mode} | ${r.generator ?? "?"} | ${r.valid} | ${r.topologyHit} | ${r.reliable} | ${(r.elapsedMs / 1000).toFixed(1)} | ${r.stepCount} | ${r.kinds.join("+") || "—"} | ${r.promptTokens} | ${r.completionTokens} | ${r.error ?? ""} |`,
    ),
    ...summaryLines(rows),
    "",
  ]
  writeFileSync(`/opt/cursor/artifacts/${name}.md`, `${lines.join("\n")}\n`)
}

const MODES: Array<[Authoring, Collection]> = [
  ["json", "direct"],
  ["json", "harness"],
  ["js", "direct"],
  ["js", "harness"],
]

describe("vibe json vs spine-js A/B (seed LLM)", () => {
  const prevProvider = process.env.LLM_PROVIDER
  const prevHarness = process.env.SPINE_VIBE_HARNESS
  const prevAuth = process.env.SPINE_VIBE_AUTHORING
  const rows: Score[] = []

  beforeAll(() => {
    process.env.LLM_PROVIDER = "seed"
    clearLlmProviderCache()
  })

  afterAll(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    if (prevHarness === undefined) delete process.env.SPINE_VIBE_HARNESS
    else process.env.SPINE_VIBE_HARNESS = prevHarness
    if (prevAuth === undefined) delete process.env.SPINE_VIBE_AUTHORING
    else process.env.SPINE_VIBE_AUTHORING = prevAuth
    clearLlmProviderCache()
    writeArtifacts(
      "vibe-ab-json-vs-js-seed-no-lookup",
      "JSON vs spine-js library A/B (seed LLM, no answer-key lookup)",
      "Seed emits a generic notes stub (JSON or compiled JS). Pasting the matching few-shot payload is reward hacking and was removed. Direct = structured retry. Harness = file loop. Reliable = valid AND topology. Coding quality is OpenRouter only.",
      rows,
    )
  })

  for (const ex of TASKS) {
    for (const [authoring, collection] of MODES) {
      it(`${ex.id}: ${authoring}-${collection} records a proposal (seed stub, not few-shot ${ex.topology})`, async () => {
        const scored = await runMode(authoring, collection, ex)
        rows.push(scored)
        expect(scored.hasProposal, `${ex.id} ${authoring}-${collection} err=${scored.error}`).toBe(true)
        expect(scored.kinds, `${ex.id} ${authoring}-${collection} seed stub, not few-shot ${ex.topology}`).toEqual([
          "input",
          "llm-batch",
          "output",
        ])
        if (collection === "harness") {
          expect(scored.generator, `${ex.id} harness generator`).toBe("harness")
        }
        if (authoring === "js" && collection === "direct") {
          expect(scored.generator, `${ex.id} js-direct generator`).toBe("js")
        }
      })
    }
  }
})

describe.skipIf(!hasLiveOpenRouterKey())("vibe json vs spine-js A/B (OpenRouter)", () => {
  const prevProvider = process.env.LLM_PROVIDER
  const prevHarness = process.env.SPINE_VIBE_HARNESS
  const prevAuth = process.env.SPINE_VIBE_AUTHORING
  const rows: Score[] = []

  beforeAll(() => {
    delete process.env.LLM_PROVIDER
    clearLlmProviderCache()
  })

  afterAll(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    if (prevHarness === undefined) delete process.env.SPINE_VIBE_HARNESS
    else process.env.SPINE_VIBE_HARNESS = prevHarness
    if (prevAuth === undefined) delete process.env.SPINE_VIBE_AUTHORING
    else process.env.SPINE_VIBE_AUTHORING = prevAuth
    clearLlmProviderCache()
    writeArtifacts(
      "vibe-ab-json-vs-js-openrouter",
      "JSON vs spine-js library A/B (OpenRouter)",
      "Live DEFAULT_MODEL. Direct retry vs harness, JSON vs library. Reliable = valid AND topology.",
      rows,
    )
  })

  for (const ex of TASKS) {
    for (const [authoring, collection] of MODES) {
      it(
        `${ex.id}: ${authoring}-${collection}`,
        { timeout: 600_000 },
        async () => {
          const scored = await runMode(authoring, collection, ex)
          rows.push(scored)
          expect(scored.hasProposal, `${ex.id} ${authoring}-${collection} err=${scored.error}`).toBe(true)
        },
      )
    }
  }
})
