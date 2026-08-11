import { llmStructured } from "../../llm"
import { deferBrowserLlmIfNeeded } from "../defer_browser_llm"
import { llmSchema, structuredLlmPrompt } from "../../structure"
import type { PipelineModule } from "../../types"
import { llmCallBudget, materializeHints, materializeStepOutput, modelById, prevModuleFor } from "../helpers"
import { requireLinearInput } from "../context"
import { jsonStringifyStepValue } from "../results"
import type { ExecResult, RunCtx, RunLogger } from "../engine_types"
import { deriveParallelStepTypes } from "@/lib/assemble-type-expr"

export async function execParallelStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project } = ctx
  const branches = m.parallelBranches ?? []
  if (!branches.length) throw new Error(`parallel step ${m.id} has no branches`)

  const synced = deriveParallelStepTypes(m, prevModuleFor(project.modules, ctx.prevModuleId), project.models)
  const out = modelById(synced.models, synced.module.outStructureId)
  if (!out) throw new Error(`parallel step ${m.id} has no output structure`)

  const inputData = requireLinearInput(m, ctx)
  const context = `INPUT DATA:\n${JSON.stringify(inputData, null, 2)}`

  // AI : skip empty-field branches — matches deriveParallelStepTypes.
  const runnableBranches = branches.filter((b) => b.field.trim() && b.outStructureId)
  if (!runnableBranches.length) throw new Error(`parallel step ${m.id} has no runnable branches`)

  const prompts = runnableBranches.map((b) => {
    const branchOut = modelById(project.models, b.outStructureId)
    if (!branchOut) throw new Error(`parallel branch "${b.field}" missing out structure`)
    const schema = llmSchema(branchOut, project.models, false, project.typeAliases ?? [])
    const userPrompt = `${b.prompt || "Process the input."}\n\n${context}`
    return { branch: b, schema, userPrompt, prompt: structuredLlmPrompt(userPrompt, schema) }
  })

  const firstModel = runnableBranches[0]!.model ?? ctx.model
  deferBrowserLlmIfNeeded(
    firstModel,
    ({ providerId, providerModel }) => ({
      providerId,
      providerModel,
      prompts: prompts.map((p) => p.prompt),
      jsonMode: true,
      useBatch: true,
      inputPreview: `${prompts.length} parallel LLM branches`,
    }),
    log,
    "parallel — deferring to browser provider",
    { moduleId: m.id, branches: prompts.length },
  )

  ctx.reportSub?.({ label: "Parallel LLM", current: 0, total: prompts.length })
  ctx.stepLlmCalls = []

  let completed = 0
  const rows = await Promise.all(
    prompts.map(async ({ branch, schema, userPrompt }) => {
      const stepModel = branch.model ?? ctx.model
      const raw = await llmStructured(
        userPrompt,
        schema,
        {
          model: stepModel,
          ledger: ctx.ledger,
          llmCalls: ctx.stepLlmCalls,
          ...llmCallBudget(ctx, `${m.label}/${branch.field}`),
        },
        log.child(`parallel:${branch.field}`),
      )
      completed += 1
      ctx.reportSub?.({ label: "Parallel LLM", current: completed, total: prompts.length })
      return { field: branch.field.trim(), value: raw }
    }),
  )

  const value: Record<string, unknown> = {}
  for (const row of rows) value[row.field] = row.value

  const prev = prevModuleFor(project.modules, ctx.prevModuleId)
  const merged = materializeStepOutput(
    synced.module,
    { ...project, models: synced.models },
    value,
    materializeHints(m, ctx),
    prev,
  )

  log.info(`parallel complete`, { moduleId: m.id, branches: prompts.length, outStructure: out.name })
  return {
    value: merged,
    preview: `parallel → {${prompts.map((p) => `"${p.branch.field.trim()}"`).join(", ")}}`,
    json: jsonStringifyStepValue(merged),
    inputPreview: prompts.map((p) => p.prompt).join("\n\n———\n\n"),
    llmCalls: ctx.stepLlmCalls,
  }
}
