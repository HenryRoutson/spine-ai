// AI : A/B the old one-shot JSON Vibe path vs the file harness on the same greenfield tasks.
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { mkdirSync, writeFileSync } from "node:fs"
import { createSpineSession } from "@/lib/core/session"
import { proposePipelineChange } from "@/lib/server/pipeline_assistant"
import { clearLlmProviderCache } from "@/lib/server/llm/registry"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { ModuleKind } from "@/lib/types"

const TASKS = [
  {
    id: "receipts",
    prompt: "Convert hundreds of unstructured receipts into a single Excel file",
  },
  {
    id: "kyc",
    prompt:
      "Pass in KYC requirements and company documentation. Break the legal doc into atomic rules, then batch-assess the company against each rule. Build example files.",
  },
] as const

type Mode = "json" | "harness"

type VibeAbScore = {
  mode: Mode
  task: string
  hasProposal: boolean
  valid: boolean
  invalidCount: number
  stepCount: number
  kinds: string[]
  hasLlm: boolean
  hasBatchOrListInput: boolean
  inputCount: number
  hasCombineOrAssemble: boolean
  hasDocs: boolean
  promptTokens: number
  completionTokens: number
  capability: number
  error?: string
}

function scoreTask(task: string, mode: Mode, result: Awaited<ReturnType<typeof proposePipelineChange>>): VibeAbScore {
  const proposal = result.proposal
  const steps = proposal ? flattenPipelineModules(proposal.modules) : []
  const kinds = steps.map((s) => s.kind)
  const hasLlm = kinds.some((k) => k === ModuleKind.Llm || k === ModuleKind.LlmBatch)
  const hasBatchOrListInput = steps.some(
    (s) => s.kind === ModuleKind.LlmBatch || (s.kind === ModuleKind.Input && s.emitsList),
  )
  const inputCount = steps.filter((s) => s.kind === ModuleKind.Input).length
  const hasCombineOrAssemble = kinds.some((k) => k === ModuleKind.Combine || k === ModuleKind.Assemble)
  const hasDocs = (proposal?.docs.length ?? 0) > 0
  const valid = Boolean(proposal) && result.invalidCount === 0
  let capability = 0
  if (proposal) capability += 1
  if (valid) capability += 2
  if (hasLlm) capability += 1
  if (task === "receipts") {
    if (hasBatchOrListInput) capability += 1
    if (hasDocs) capability += 1
  } else {
    if (inputCount >= 2 || hasCombineOrAssemble) capability += 1
    if (hasDocs) capability += 1
  }
  return {
    mode,
    task,
    hasProposal: Boolean(proposal),
    valid,
    invalidCount: result.invalidCount,
    stepCount: steps.length,
    kinds,
    hasLlm,
    hasBatchOrListInput,
    inputCount,
    hasCombineOrAssemble,
    hasDocs,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    capability,
  }
}

async function runMode(mode: Mode, taskId: string, prompt: string): Promise<VibeAbScore> {
  process.env.SPINE_VIBE_HARNESS = mode === "harness" ? "1" : "0"
  const session = createSpineSession()
  session.addProject({ open: true })
  const t0 = Date.now()
  try {
    const result = await proposePipelineChange(session.project!, prompt, [])
    const scored = scoreTask(taskId, mode, result)
    return { ...scored, error: `${Date.now() - t0}ms` }
  } catch (err) {
    return {
      mode,
      task: taskId,
      hasProposal: false,
      valid: false,
      invalidCount: -1,
      stepCount: 0,
      kinds: [],
      hasLlm: false,
      hasBatchOrListInput: false,
      inputCount: 0,
      hasCombineOrAssemble: false,
      hasDocs: false,
      promptTokens: 0,
      completionTokens: 0,
      capability: 0,
      error: (err as Error).message,
    }
  }
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
    mkdirSync("/opt/cursor/artifacts", { recursive: true })
    writeFileSync("/opt/cursor/artifacts/vibe-ab-seed.json", `${JSON.stringify(payload, null, 2)}\n`)
    const lines = [
      "# Vibe JSON vs file-harness A/B (seed LLM)",
      "",
      "Seed fills the assistant JSON schema, not the tools schema. No live OpenRouter key in this env.",
      "",
      "| task | mode | capability | valid | proposal | steps | kinds | promptTok | note |",
      "| --- | --- | ---: | --- | --- | ---: | --- | ---: | --- |",
      ...rows.map((r) =>
        `| ${r.task} | ${r.mode} | ${r.capability} | ${r.valid} | ${r.hasProposal} | ${r.stepCount} | ${r.kinds.join("+") || "—"} | ${r.promptTokens} | ${r.error ?? ""} |`,
      ),
      "",
    ]
    writeFileSync("/opt/cursor/artifacts/vibe-ab-seed.md", `${lines.join("\n")}\n`)
  })

  for (const task of TASKS) {
    it(`${task.id}: json path still builds a valid pipeline`, async () => {
      const json = await runMode("json", task.id, task.prompt)
      rows.push(json)
      expect(json.hasProposal, `${task.id} json proposal`).toBe(true)
      expect(json.valid, `${task.id} json valid`).toBe(true)
      expect(json.hasLlm, `${task.id} json has llm`).toBe(true)
    })

    it(`${task.id}: file harness is not more capable than json on seed`, async () => {
      const json = rows.find((r) => r.task === task.id && r.mode === "json")
      const harness = await runMode("harness", task.id, task.prompt)
      rows.push(harness)
      expect(json).toBeTruthy()
      expect(
        harness.capability,
        `${task.id} harness capability ${harness.capability} vs json ${json!.capability} kinds=${harness.kinds.join(",")} err=${harness.error}`,
      ).toBeLessThanOrEqual(json!.capability)
    })
  }
})
