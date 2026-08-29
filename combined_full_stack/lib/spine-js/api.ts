// AI : each step function takes one Zod-parsed object. Emits JSON IR, then re-parses moduleSpecSchema.
import { z, type ZodType } from "zod"
import { kindAlwaysEmitsList } from "@/lib/module-kinds"
import {
  assembleBindingsSchema,
  parseModuleSpecsDeep,
  type PipelineAssistantModelSpec,
  type PipelineAssistantModuleSpec,
  type ProjectAssistantDocSpec,
} from "@/lib/server/pipeline-authoring-schema"
import {
  formatStructureIn,
  formatStructureOut,
  isZodType,
  itemNameOfOut,
  model,
  resetSpineJsModels,
  structureRefFromZod,
  collectedModels,
  zodTypeSchema,
} from "./zod-models"

export type StepHandle = {
  kind: string
  spec: PipelineAssistantModuleSpec
  models: PipelineAssistantModelSpec[]
}

export type SpineProgram = {
  modules: PipelineAssistantModuleSpec[]
  models: PipelineAssistantModelSpec[]
  message: string
  docs: ProjectAssistantDocSpec[] | null
  documentationUpdate: string | null
  projectNameUpdate: string | null
  targetFunctionName: string | null
}

let lastProgram: SpineProgram | undefined

export function takeLastSpineProgram(): SpineProgram | undefined {
  return lastProgram
}

const inSchema = z.union([zodTypeSchema, z.string()])

const stepBase = {
  schema: zodTypeSchema,
  note: z.string().optional(),
  label: z.string().optional(),
  inputDescription: z.string().optional(),
  model: z.string().optional(),
}

const inputArgsSchema = z.object({
  ...stepBase,
  note: z.string().min(1),
  type: z.enum(["pdf", "word", "excel", "json", "text", "markdown", "latex", "web", "image", "audio", "video"]).default("text"),
  inputNameContains: z.string().optional(),
  inputMinCount: z.number().int().min(1).optional(),
})

const llmArgsSchema = z.object({
  ...stepBase,
  note: z.string().min(1),
  prompt: z.string().min(1),
  in: inSchema.optional(),
})

const codeArgsSchema = z.object({
  ...stepBase,
  code: z.string().min(1),
  in: inSchema.optional(),
})

const passthroughArgsSchema = z.object({
  schema: zodTypeSchema.optional(),
  note: z.string().optional(),
  label: z.string().optional(),
  in: inSchema.optional(),
  inputDescription: z.string().optional(),
})

const combineArgsSchema = z.object({
  schema: zodTypeSchema.optional(),
  note: z.string().min(1),
  label: z.string().optional(),
  in: inSchema,
  inputDescription: z.string().optional(),
  type: z.enum(["pdf", "word", "excel", "json", "text", "markdown", "latex", "web", "image", "audio", "video"]).optional(),
  inputNameContains: z.string().optional(),
})

const assembleArgsSchema = z.object({
  schema: zodTypeSchema.optional(),
  note: z.string().min(1),
  label: z.string().optional(),
  bindings: assembleBindingsSchema,
})

const stepHandleSchema = z.custom<StepHandle>(
  (v) => !!v && typeof v === "object" && "kind" in v && "spec" in v,
  "expected a spine-js step handle",
)

const forkArgsSchema = z.object({
  note: z.string().min(1),
  label: z.string().optional(),
  join: z.enum(["product", "assemble", "merge"]).optional(),
  branches: z
    .array(
      z.object({
        label: z.string(),
        steps: z.array(stepHandleSchema).max(50),
      }),
    )
    .min(2)
    .max(12),
})

const ifElseArgsSchema = z.object({
  note: z.string().min(1),
  label: z.string().optional(),
  when: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("path"), path: z.string() }),
    z.object({ kind: z.literal("equals"), path: z.string(), value: z.unknown() }),
  ]),
  then: z.array(stepHandleSchema).max(50),
  else: z.array(stepHandleSchema).max(50).optional(),
})

const connectArgsSchema = z.object({
  ...stepBase,
  note: z.string().optional(),
  actionId: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
  in: inSchema.optional(),
})

const n8nArgsSchema = z.object({
  ...stepBase,
  note: z.string().optional(),
  nodeType: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
  code: z.string().optional(),
  in: inSchema.optional(),
})

const sqlArgsSchema = z.object({
  ...stepBase,
  note: z.string().optional(),
  sql: z.string().min(1),
  seedRows: z.array(z.record(z.string(), z.unknown())).max(64).optional(),
  in: inSchema.optional(),
})

const chatbotArgsSchema = z.object({
  note: z.string().optional(),
  label: z.string().optional(),
  mode: z.enum(["single", "until-exit"]).optional(),
  maxTurns: z.number().int().min(1).max(200).optional(),
  schema: zodTypeSchema.optional(),
})

const webhookArgsSchema = z.object({
  ...stepBase,
  note: z.string().optional(),
  in: inSchema.optional(),
})

function labelFrom(kind: string, label: string | undefined, fallback: string): string {
  return label?.trim() || fallback
}

function inName(kind: string, value: ZodType | string | undefined, fallback: string): string | undefined {
  if (typeof value === "string") return value
  if (isZodType(value)) return formatStructureIn(kind, structureRefFromZod(value, fallback))
  return undefined
}

function collectFromSteps(steps: StepHandle[]): PipelineAssistantModelSpec[] {
  const byName = new Map<string, PipelineAssistantModelSpec>()
  for (const s of steps) {
    for (const m of s.models) byName.set(m.name, m)
  }
  for (const m of collectedModels()) byName.set(m.name, m)
  return [...byName.values()]
}

function makeStep(
  kind: string,
  args: {
    schema?: ZodType
    note?: string
    label?: string
    inputDescription?: string
    model?: string
    in?: ZodType | string
    extra?: Record<string, unknown>
  },
): StepHandle {
  const fallback = (args.label || kind).replace(/[^A-Za-z0-9]+/g, "") || "Out"
  const outRef = args.schema ? structureRefFromZod(args.schema, fallback) : undefined
  const specRaw: Record<string, unknown> = {
    kind,
    label: labelFrom(kind, args.label, kind),
    ...(args.note ? { note: args.note } : {}),
    ...(outRef ? { structureOut: formatStructureOut(kind, outRef) } : {}),
    ...(args.in !== undefined ? { structureIn: inName(kind, args.in, fallback) } : {}),
    ...(args.inputDescription ? { inputDescription: args.inputDescription } : {}),
    ...(args.model ? { model: args.model } : {}),
    ...(args.extra ?? {}),
  }
  return {
    kind,
    spec: specRaw as PipelineAssistantModuleSpec,
    models: collectedModels(),
  }
}

export function input(args: unknown): StepHandle {
  const a = inputArgsSchema.parse(args)
  return makeStep("input", {
    schema: a.schema,
    note: a.note,
    label: a.label,
    inputDescription: a.inputDescription,
    extra: {
      inputType: a.type,
      ...(a.inputNameContains ? { inputNameContains: a.inputNameContains } : {}),
      ...(a.inputMinCount ? { inputMinCount: a.inputMinCount } : {}),
    },
  })
}

export function llm(args: unknown): StepHandle {
  const a = llmArgsSchema.parse(args)
  return makeStep("llm", a)
}

export function llmBatch(args: unknown): StepHandle {
  const a = llmArgsSchema.parse(args)
  return makeStep("llm-batch", a)
}

export function exampleSelect(args: unknown): StepHandle {
  const a = llmArgsSchema.parse(args)
  return makeStep("example-select", a)
}

export function customCode(args: unknown): StepHandle {
  const a = codeArgsSchema.parse(args)
  return makeStep("custom-code", { ...a, extra: { code: a.code } })
}

export function transform(args: unknown): StepHandle {
  const a = passthroughArgsSchema.extend({ code: z.string().optional() }).parse(args)
  return makeStep("transform", { ...a, extra: a.code ? { code: a.code } : {} })
}

export function chunk(args: unknown): StepHandle {
  const a = passthroughArgsSchema.parse(args)
  return makeStep("chunk", a)
}

export function merge(args: unknown): StepHandle {
  const a = passthroughArgsSchema.parse(args)
  return makeStep("merge", a)
}

export function output(args: unknown): StepHandle {
  const a = passthroughArgsSchema.parse(args)
  return makeStep("output", a)
}

export function assertStep(args: unknown): StepHandle {
  const a = passthroughArgsSchema.extend({ code: z.string().optional() }).parse(args)
  return makeStep("assert", { ...a, extra: a.code ? { code: a.code } : {} })
}

export function humanReview(args: unknown): StepHandle {
  const a = passthroughArgsSchema.parse(args)
  return makeStep("human-review", a)
}

export function combine(args: unknown): StepHandle {
  const a = combineArgsSchema.parse(args)
  return makeStep("combine", {
    ...a,
    extra: {
      ...(a.type ? { inputType: a.type } : {}),
      ...(a.inputNameContains ? { inputNameContains: a.inputNameContains } : {}),
    },
  })
}

export function assemble(args: unknown): StepHandle {
  const a = assembleArgsSchema.parse(args)
  return makeStep("assemble", { ...a, extra: { assembleBindings: a.bindings } })
}

export function fork(args: unknown): StepHandle {
  const a = forkArgsSchema.parse(args)
  const branchModels = collectFromSteps(a.branches.flatMap((b) => b.steps))
  const spec = {
    kind: "fork" as const,
    label: labelFrom("fork", a.label, "Fork"),
    note: a.note,
    forkJoin: a.join ?? "product",
    forkBranches: a.branches.map((b) => ({
      label: b.label,
      modules: b.steps.map((s) => s.spec),
    })),
  }
  return { kind: "fork", spec: spec as PipelineAssistantModuleSpec, models: branchModels }
}

export function ifElse(args: unknown): StepHandle {
  const a = ifElseArgsSchema.parse(args)
  const nested = [...a.then, ...(a.else ?? [])]
  const spec = {
    kind: "if-else" as const,
    label: labelFrom("if-else", a.label, "If"),
    note: a.note,
    ifCondition: a.when,
    forkBranches: [
      { label: "Then", modules: a.then.map((s) => s.spec) },
      { label: "Else", modules: (a.else ?? []).map((s) => s.spec) },
    ],
  }
  return { kind: "if-else", spec: spec as PipelineAssistantModuleSpec, models: collectFromSteps(nested) }
}

export function parallel(args: unknown): StepHandle {
  const schema = z.object({
    note: z.string().min(1),
    label: z.string().optional(),
    branches: z
      .array(
        z.object({
          field: z.string(),
          prompt: z.string(),
          schema: zodTypeSchema,
          model: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .max(32),
  })
  const a = schema.parse(args)
  const extra = {
    parallelBranches: a.branches.map((b) => {
      const ref = structureRefFromZod(b.schema, b.field)
      return {
        field: b.field,
        prompt: b.prompt,
        structureOut: ref.name,
        ...(b.model ? { model: b.model } : {}),
        ...(b.note ? { note: b.note } : {}),
      }
    }),
  }
  return makeStep("parallel", { note: a.note, label: a.label, extra })
}

export function connect(args: unknown): StepHandle {
  const a = connectArgsSchema.parse(args)
  return makeStep("connect", {
    ...a,
    extra: { connectActionId: a.actionId, ...(a.parameters ? { connectParameters: a.parameters } : {}) },
  })
}

export function n8n(args: unknown): StepHandle {
  const a = n8nArgsSchema.parse(args)
  return makeStep("n8n", {
    ...a,
    extra: {
      n8nNodeType: a.nodeType,
      ...(a.parameters ? { n8nParameters: a.parameters } : {}),
      ...(a.code ? { n8nCode: a.code } : {}),
    },
  })
}

export function sql(args: unknown): StepHandle {
  const a = sqlArgsSchema.parse(args)
  return makeStep("sql", { ...a, extra: { sql: a.sql, ...(a.seedRows ? { sqlSeedRows: a.seedRows } : {}) } })
}

export function chatbot(args: unknown): StepHandle {
  const a = chatbotArgsSchema.parse(args)
  return makeStep("chatbot", {
    note: a.note,
    label: a.label,
    extra: {
      chatbotMode: a.mode ?? "until-exit",
      ...(a.maxTurns ? { maxTurns: a.maxTurns } : {}),
    },
  })
}

export function webhook(args: unknown): StepHandle {
  const a = webhookArgsSchema.parse(args)
  return makeStep("webhook", a)
}

function inferMissingIns(specs: PipelineAssistantModuleSpec[]): PipelineAssistantModuleSpec[] {
  let prevItem: string | undefined
  return specs.map((spec) => {
    let next = spec
    if (!spec.structureIn && spec.kind !== "input" && spec.kind !== "fork" && spec.kind !== "if-else" && spec.kind !== "assemble" && spec.kind !== "parallel") {
      if (prevItem) next = { ...spec, structureIn: prevItem }
    }
    if (spec.kind === "fork" && spec.forkBranches) {
      next = {
        ...next,
        forkBranches: spec.forkBranches.map((b) => ({
          ...b,
          modules: inferMissingIns((b.modules as PipelineAssistantModuleSpec[]) ?? []),
        })),
      }
    }
    const outItem = itemNameOfOut(spec.structureOut) ?? prevItem
    if (kindAlwaysEmitsList(spec.kind)) prevItem = itemNameOfOut(spec.structureOut)
    else prevItem = outItem
    return next
  })
}

export function pipeline(...steps: StepHandle[]): SpineProgram
export function pipeline(opts: {
  steps: StepHandle[]
  message?: string
  docs?: ProjectAssistantDocSpec[] | null
  documentation?: string | null
  projectName?: string | null
  targetFunctionName?: string | null
}): SpineProgram
export function pipeline(
  first: StepHandle | { steps: StepHandle[]; message?: string; docs?: ProjectAssistantDocSpec[] | null; documentation?: string | null; projectName?: string | null; targetFunctionName?: string | null },
  ...rest: StepHandle[]
): SpineProgram {
  const opts =
    first && typeof first === "object" && "steps" in first
      ? first
      : { steps: [first as StepHandle, ...rest] }
  const inferred = inferMissingIns(opts.steps.map((s) => s.spec))
  const parsed = parseModuleSpecsDeep(inferred)
  if (!parsed.ok) {
    throw new Error(`spine-js JSON restrictions failed: ${parsed.errors.join("; ")}`)
  }
  const models = collectFromSteps(opts.steps)
  lastProgram = {
    modules: parsed.data,
    models,
    message: opts.message ?? "",
    docs: opts.docs ?? null,
    documentationUpdate: opts.documentation ?? null,
    projectNameUpdate: opts.projectName ?? null,
    targetFunctionName: opts.targetFunctionName ?? null,
  }
  return lastProgram
}

export function beginSpineJsProgram(): void {
  resetSpineJsModels()
  lastProgram = undefined
}

export { model }
