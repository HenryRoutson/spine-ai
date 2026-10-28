// AI : per-step pydantic models, schema validation, and derived LLM prompts — same logic as run engine + inspector.

import { resolve } from "node:path"
import { loadProjectContext } from "@/lib/cli/project_context"
import { isLlmKind } from "@/lib/module-kinds"
import { spineEmitsLabel, spineExpectsLabel } from "@/lib/server/assistant-prompt"
import { modelById } from "@/lib/server/run_engine/helpers"
import { allModelsToPydantic, modelToPydantic } from "@/lib/server/pydantic"
import { allModelsToSql } from "@/lib/sql-schema"
import { collectSqlIdTypes } from "@/lib/sql-id-types"
import { inspectCatalogDocs, type InspectIdsFilter } from "@/lib/sql-id-index"
import { readFileSync } from "node:fs"
import {
  formatPipelineTypeSummary,
  generatePipelineTypes,
  type GeneratedPipelineTypes,
} from "@/lib/server/type_codegen"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import {
  formatStructureDef,
  llmSchema,
  llmSchemaJson,
  structuredLlmPrompt,
  validateStepOutput,
} from "@/lib/server/structure"
import { computeInvalid, formatInvalidMapErrors } from "@/lib/server/validity"
import { lintPipeline, lintPipelineJson } from "@/lib/server/pipeline_lint"
import { stepOutputJsonSchema } from "@/lib/step-json-schema"
import { formatTypeExpr, stepEmitsList, stepSpineInType, stepSpineOutType } from "@/lib/server/type_expr"
import { tryParseJson } from "@/lib/json-utils"
import { isComparableStep, isTestingFileName } from "@/lib/testing-files"
import type { PipelineModule, Project } from "@/lib/types"
import type { repo_path_string } from "./spine-pinpoint.js"

export type StepModelDescriptor = {
  label: string
  kind: string
  moduleId: string
  expects?: string
  emits?: string
  spineInType?: string
  spineOutType?: string
  inputStructure?: string
  outputStructure?: string
  outputStructureDef?: string
  pydanticModel?: string
  jsonSchema?: Record<string, unknown> | null
  llmJsonSchema?: unknown
  userPrompt?: string
  derivedStructuredPrompt?: string
}

export type DescribePipelineStepsResult = {
  projectName: string
  seedPath: string
  pipelineStateSummary: string
  stepCount: number
  steps: StepModelDescriptor[]
}

export type ValidateStepOutputResult = {
  step: string
  ok: boolean
  error?: string
  validation: "pipeline_state" | "structure_model"
  outputStructure?: string
  pydanticModel?: string
  jsonSchema?: Record<string, unknown> | null
}

function absPath(path: string, cwd: string): string {
  return resolve(cwd, path)
}

function loadProject(projectSeedPath: repo_path_string, cwd: string) {
  const seedPath = absPath(projectSeedPath, cwd)
  return { seedPath, ctx: loadProjectContext(seedPath) }
}

function moduleByLabel(modules: PipelineModule[], label: string): PipelineModule | undefined {
  return modules.find((m) => labelAsStateKey(m.label) === labelAsStateKey(label))
}

function parseValueJson(valueJson: string): unknown {
  const parsed = tryParseJson(valueJson, { trim: true })
  if (!parsed.ok) throw new Error(`invalid value JSON: ${parsed.error.message}`)
  return parsed.value
}

function deriveStructuredPrompt(m: PipelineModule, project: Project): string | undefined {
  if (!isLlmKind(m.kind)) return undefined
  const out = modelById(project.models, m.outStructureId)
  if (!out) return undefined
  const typeAliases = project.typeAliases ?? []
  const schema = llmSchema(
    out,
    project.models,
    m.kind === "llm-batch" ? false : stepEmitsList(m),
    typeAliases,
  )
  if (m.kind === "llm-batch") {
    const userPrompt = `${m.prompt ?? "Process the item."}\n\nITEM:\n<upstream list item JSON>`
    return structuredLlmPrompt(userPrompt, schema)
  }
  const userPrompt = `${m.prompt ?? "Process the input."}\n\nINPUT DATA:\n<upstream step output JSON>`
  return structuredLlmPrompt(userPrompt, schema)
}

function stepDescriptor(m: PipelineModule, project: Project): StepModelDescriptor {
  const out = modelById(project.models, m.outStructureId)
  const inputModel = modelById(project.models, m.inStructureId)
  const typeAliases = project.typeAliases ?? []
  const spineOut = stepSpineOutType(m)
  const spineIn = stepSpineInType(m)
  const llmSchemaParsed =
    isLlmKind(m.kind) && out
      ? (JSON.parse(llmSchemaJson(out, project.models, stepEmitsList(m), typeAliases)) as unknown)
      : undefined

  return {
    label: m.label,
    kind: m.kind,
    moduleId: m.id,
    expects: spineExpectsLabel(m, project.models),
    emits: spineEmitsLabel(m, project.models),
    spineInType: spineIn ? formatTypeExpr(spineIn, project.models) : undefined,
    spineOutType: spineOut ? formatTypeExpr(spineOut, project.models) : undefined,
    inputStructure: inputModel?.name,
    outputStructure: out?.name,
    outputStructureDef: out ? formatStructureDef(out, project.models) : undefined,
    pydanticModel: out ? modelToPydantic(out, project.models) : undefined,
    jsonSchema: stepOutputJsonSchema(project, m.label),
    llmJsonSchema: llmSchemaParsed,
    userPrompt: isLlmKind(m.kind) ? m.prompt?.trim() || undefined : undefined,
    derivedStructuredPrompt: deriveStructuredPrompt(m, project),
  }
}

export function describePipelineSteps(
  input: { projectSeedPath: repo_path_string; stepLabel?: string },
  cwd: string,
): DescribePipelineStepsResult {
  const { seedPath, ctx } = loadProject(input.projectSeedPath, cwd)
  const { project } = ctx
  const all = project.modules.map((m) => stepDescriptor(m, project))
  const steps = input.stepLabel?.trim()
    ? all.filter((s) => labelAsStateKey(s.label) === labelAsStateKey(input.stepLabel!))
    : all
  if (input.stepLabel?.trim() && !steps.length) {
    throw new Error(`step not found: ${input.stepLabel}`)
  }
  return {
    projectName: project.name,
    seedPath,
    pipelineStateSummary: formatPipelineTypeSummary(project),
    stepCount: steps.length,
    steps,
  }
}

export function validateStepOutputValue(
  input: { projectSeedPath: repo_path_string; stepLabel: string; valueJson: string },
  cwd: string,
): ValidateStepOutputResult {
  const { ctx } = loadProject(input.projectSeedPath, cwd)
  const { project } = ctx
  const mod = moduleByLabel(project.modules, input.stepLabel)
  if (!mod) throw new Error(`step not found: ${input.stepLabel}`)

  const value = parseValueJson(input.valueJson)
  const out = modelById(project.models, mod.outStructureId)
  const jsonSchema = stepOutputJsonSchema(project, mod.label)

  const stateCheck = validatePipelineStateEntry(labelAsStateKey(mod.label), value, project)
  if (!stateCheck.ok) {
    return {
      step: mod.label,
      ok: false,
      error: stateCheck.error,
      validation: "pipeline_state",
      outputStructure: out?.name,
      pydanticModel: out ? modelToPydantic(out, project.models) : undefined,
      jsonSchema,
    }
  }

  if (out && isComparableStep(mod)) {
    const modelCheck = validateStepOutput(value, out, project.models, {
      isList: stepEmitsList(mod),
      rawQuotes: isLlmKind(mod.kind),
      typeAliases: project.typeAliases ?? [],
    })
    if (!modelCheck.ok) {
      return {
        step: mod.label,
        ok: false,
        error: modelCheck.error,
        validation: "structure_model",
        outputStructure: out.name,
        pydanticModel: modelToPydantic(out, project.models),
        jsonSchema,
      }
    }
  }

  return {
    step: mod.label,
    ok: true,
    validation: out && isComparableStep(mod) ? "structure_model" : "pipeline_state",
    outputStructure: out?.name,
    pydanticModel: out ? modelToPydantic(out, project.models) : undefined,
    jsonSchema,
  }
}

export function validatePipelineWiring(input: { projectSeedPath: repo_path_string }, cwd: string) {
  const { seedPath, ctx } = loadProject(input.projectSeedPath, cwd)
  const { project } = ctx
  const invalid = computeInvalid(project.modules, project.models, {
    typeAliases: project.typeAliases ?? [],
  })
  const issues = formatInvalidMapErrors(invalid, project.modules, project.models)
  return {
    projectName: project.name,
    seedPath,
    ok: invalid.size === 0,
    issueCount: [...invalid.values()].reduce((n, xs) => n + xs.length, 0),
    issuesText: issues || undefined,
    invalidByStep: Object.fromEntries(
      [...invalid.entries()].map(([moduleId, stepIssues]) => {
        const mod = project.modules.find((m) => m.id === moduleId)
        return [mod?.label ?? moduleId, stepIssues]
      }),
    ),
  }
}

export function lintPipelineFromInput(
  input: { projectSeedPath?: repo_path_string; pipelineJson?: string; includeExport?: boolean },
  cwd: string,
) {
  const includeExport = input.includeExport ?? true
  if (input.pipelineJson) {
    let raw: unknown
    try {
      raw = JSON.parse(input.pipelineJson)
    } catch (err) {
      throw new Error(`invalid pipeline JSON: ${err instanceof Error ? err.message : "parse failed"}`)
    }
    const result = lintPipelineJson(raw, { includeExport })
    return { ok: result.ok, lintCount: result.lints.length, lints: result.lints }
  }
  if (!input.projectSeedPath) throw new Error("projectSeedPath or pipelineJson required")
  const { seedPath, ctx } = loadProject(input.projectSeedPath, cwd)
  const result = lintPipeline(ctx.project, { includeExport })
  return {
    projectName: ctx.project.name,
    seedPath,
    ok: result.ok,
    lintCount: result.lints.length,
    lints: result.lints,
  }
}

export function exportPydanticProject(
  input: { projectSeedPath: repo_path_string; includePipelineSignatures?: boolean },
  cwd: string,
): {
  projectName: string
  seedPath: string
  modelsPy: string
  schemaSql: string
  idTypes: Array<{ name: string; pk: string; fkFields: string[] }>
  pipelineSignatures?: GeneratedPipelineTypes
} {
  const { seedPath, ctx } = loadProject(input.projectSeedPath, cwd)
  const { project } = ctx
  const modelsPy = allModelsToPydantic(project.models, project.typeAliases ?? [])
  const includePipelineSignatures = input.includePipelineSignatures ?? true
  const pipelineSignatures = includePipelineSignatures ? generatePipelineTypes(project) : undefined
  return {
    projectName: project.name,
    seedPath,
    modelsPy,
    schemaSql: pipelineSignatures?.schemaSql ?? allModelsToSql(project.models, project.modules),
    idTypes: collectSqlIdTypes(project.models).map((t) => ({
      name: t.name,
      pk: `${t.pkModelName}.${t.pkField}`,
      fkFields: t.fkFields.map((f) => `${f.modelName}.${f.field}`),
    })),
    pipelineSignatures,
  }
}

export function inspectIdsFromSeed(
  input: {
    projectSeedPath: repo_path_string
    idType?: string
    docName?: string
    filter?: InspectIdsFilter
  },
  cwd: string,
) {
  const { ctx } = loadProject(input.projectSeedPath, cwd)
  const docs = ctx.seed.docSpecs
    .filter((d) => !isTestingFileName(d.name))
    .filter((d) => !input.docName || d.name === input.docName)
    .map((d) => {
      try {
        return { name: d.name, type: d.type, content: readFileSync(d.path, "utf8") }
      } catch {
        return undefined
      }
    })
    .filter((d): d is NonNullable<typeof d> => !!d)
  return inspectCatalogDocs(ctx.project.models, docs, {
    idType: input.idType,
    filter: input.filter ?? "all",
    typeAliases: ctx.project.typeAliases,
  })
}

export function deriveStepPrompt(
  input: { projectSeedPath: repo_path_string; stepLabel: string; sampleInputJson?: string },
  cwd: string,
) {
  const { ctx } = loadProject(input.projectSeedPath, cwd)
  const mod = moduleByLabel(ctx.project.modules, input.stepLabel)
  if (!mod) throw new Error(`step not found: ${input.stepLabel}`)
  if (!isLlmKind(mod.kind)) {
    throw new Error(`step "${mod.label}" is ${mod.kind} — only llm / llm-batch steps have derived prompts`)
  }

  const out = modelById(ctx.project.models, mod.outStructureId)
  if (!out) throw new Error(`step "${mod.label}" has no output structure`)

  const typeAliases = ctx.project.typeAliases ?? []
  const schema = llmSchema(
    out,
    ctx.project.models,
    mod.kind === "llm-batch" ? false : stepEmitsList(mod),
    typeAliases,
  )
  const sampleInput = input.sampleInputJson?.trim()
    ? parseValueJson(input.sampleInputJson)
    : undefined

  let userPrompt: string
  if (mod.kind === "llm-batch") {
    userPrompt = `${mod.prompt ?? "Process the item."}\n\nITEM:\n${JSON.stringify(sampleInput ?? { _placeholder: "upstream list item" }, null, 2)}`
  } else {
    userPrompt = `${mod.prompt ?? "Process the input."}\n\nINPUT DATA:\n${JSON.stringify(sampleInput ?? { _placeholder: "upstream step output" }, null, 2)}`
  }

  return {
    step: mod.label,
    kind: mod.kind,
    outputStructure: out.name,
    pydanticModel: modelToPydantic(out, ctx.project.models),
    llmJsonSchema: JSON.parse(llmSchemaJson(out, ctx.project.models, stepEmitsList(mod), typeAliases)),
    userPrompt: mod.prompt?.trim() || undefined,
    derivedStructuredPrompt: structuredLlmPrompt(userPrompt, schema),
  }
}

export function schemaValidationForStepOutput(
  project: Project,
  stepLabel: string,
  actual: unknown,
): { ok: boolean; error?: string; validation: "pipeline_state" | "structure_model" } | undefined {
  if (actual === undefined) return undefined
  const mod = moduleByLabel(project.modules, stepLabel)
  if (!mod) return undefined

  const stateCheck = validatePipelineStateEntry(labelAsStateKey(stepLabel), actual, project)
  if (!stateCheck.ok) {
    return { ok: false, error: stateCheck.error, validation: "pipeline_state" }
  }

  const out = modelById(project.models, mod.outStructureId)
  if (out && isComparableStep(mod)) {
    const modelCheck = validateStepOutput(actual, out, project.models, {
      isList: stepEmitsList(mod),
      rawQuotes: isLlmKind(mod.kind),
      typeAliases: project.typeAliases ?? [],
    })
    if (!modelCheck.ok) {
      return { ok: false, error: modelCheck.error, validation: "structure_model" }
    }
  }

  return { ok: true, validation: out && isComparableStep(mod) ? "structure_model" : "pipeline_state" }
}
