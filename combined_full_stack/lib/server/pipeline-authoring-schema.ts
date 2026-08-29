// AI : single Zod source for vibe JSON authoring — spine-js compiles into this IR and re-parses it.
import { z } from "zod"
import { getConnectAction } from "@/lib/connect-catalog"
import { inputTypesAreAllJsonNative } from "@/lib/inference-input-core"
import { USER_ADDABLE_MODULE_KINDS, asModuleKind, stepRequiresNote } from "@/lib/module-kinds"
import { parseStructureHint, structureModelSpecSchema, typeAliasSpecSchema } from "./assistant-shared"
import { ifConditionSchema } from "@/lib/if-condition"
import { DocLabel, INPUT_TYPES, InputType, ModuleKind } from "./types"

const MODULE_KINDS = USER_ADDABLE_MODULE_KINDS
const INPUT_TYPE_VALUES = INPUT_TYPES.map((t) => t.value)

export const assembleBindingsSchema = z.record(
  z.string(),
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("spine") }),
    z.object({ kind: z.literal("state"), label: z.string() }),
    z.object({
      kind: z.literal("path"),
      from: z.union([z.literal("spine"), z.object({ label: z.string() })]),
      path: z.string(),
    }),
  ]),
)

// AI : moduleSpecSchema nested forkBranches; materialize lane modules via expandModuleSpecs.
export const moduleSpecSchema = z
  .object({
    kind: z.enum(MODULE_KINDS),
    label: z.string(),
    note: z.string().optional(),
    structureIn: z
      .string()
      .optional()
      .describe(
        "Structure name the step reads — combine: pipeline-state structure from an earlier step (required, not list[...])",
      ),
    structureOut: z
      .string()
      .optional()
      .describe("Emitted structure — list[Name] for input/llm/custom-code list emit; item name only for llm-batch/example-select/chunk (those always emit list[item])"),
    inputType: z
      .enum(INPUT_TYPE_VALUES as [string, ...string[]])
      .optional()
      .describe("input steps: upload type; on combine-only specs: applies to auto-inserted side Document input"),
    inputNameContains: z
      .string()
      .optional()
      .describe("filename substring for this input slot — on combine-only specs: applies to auto-inserted side input"),
    inputDescription: z.string().optional(),
    checkInputDescription: z.boolean().optional(),
    prompt: z.string().optional(),
    chatbotMode: z.enum(["single", "until-exit"]).optional(),
    maxTurns: z.number().int().min(1).max(200).optional(),
    code: z
      .string()
      .optional()
      .describe("custom-code only — TypeScript arrow expression e.g. (rows) => rows.map(...)"),
    model: z.string().optional(),
    inputMinCount: z.number().int().min(1).optional(),
    assembleBindings: assembleBindingsSchema
      .optional()
      .describe(
        "assemble only — field → spine | { kind: state, label } | { kind: path, from: spine|{label}, path: dotted }",
      ),
    parallelBranches: z
      .array(
        z.object({
          field: z.string(),
          prompt: z.string(),
          structureOut: z.string(),
          model: z.string().optional(),
          note: z.string().optional(),
        }),
      )
      .max(32)
      .optional()
      .describe("parallel only — each branch: product field name, prompt, and structureOut model name"),
    forkJoin: z
      .enum(["product", "assemble", "merge"])
      .optional()
      .describe("fork only — product (auto field per lane), assemble (bindings), or merge"),
    forkBranches: z
      .array(
        z.object({
          label: z.string(),
          match: z.string().optional().describe("case only — exact match; empty/_/*/default is the fallback arm"),
          modules: z.array(z.any()).max(50),
        }),
      )
      .min(1)
      .max(12)
      .optional()
      .describe("fork / if-else / case — linear lanes; if-else is Then then Else; case arms set match"),
    ifCondition: ifConditionSchema
      .optional()
      .describe(
        "if-else: bool spine path. case: scalar match path. Compute comparisons in custom-code / Python.",
      ),
    n8nNodeType: z
      .string()
      .optional()
      .describe("n8n only — catalog id e.g. piece.set or n8n-nodes-base.set (list_pieces)"),
    n8nParameters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("n8n only — piece params matching the auto-generated form"),
    n8nCode: z.string().optional().describe("n8n only — optional Code-node JS override"),
    connectActionId: z
      .string()
      .optional()
      .describe("connect only — catalog id from list_connect_actions e.g. slack.postMessage"),
    connectParameters: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("connect only — params matching the action props"),
    sql: z
      .string()
      .optional()
      .describe("sql steps only — SELECT / UPDATE / INSERT against the hosted app SQL store"),
    sqlSeedRows: z
      .array(z.record(z.string(), z.unknown()))
      .max(64)
      .optional()
      .describe("sql steps — rows inserted when the table is empty"),
  })
  .superRefine((spec, ctx) => {
    if (stepRequiresNote(asModuleKind(spec.kind)) && !spec.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "note is required for input, combine, assemble, parallel, and llm steps",
        path: ["note"],
      })
    }
    if (spec.kind === ModuleKind.Input && spec.structureOut?.trim()) {
      const hint = parseStructureHint(spec.structureOut)
      const jsonNative =
        spec.inputType != null && inputTypesAreAllJsonNative([spec.inputType as InputType])
      if (hint && !jsonNative && hint.name.toLowerCase() !== "document") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "non-JSON input steps must structureOut Document or list[Document] — typed parsing belongs in a later llm/custom-code step",
          path: ["structureOut"],
        })
      }
    }
    if (spec.kind === ModuleKind.LlmBatch && spec.structureIn?.trim()) {
      const inHint = parseStructureHint(spec.structureIn)
      if (inHint?.isList) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "llm-batch structureIn is the list ITEM type (e.g. Document), not list[Document]",
          path: ["structureIn"],
        })
      }
    }
    if (spec.kind === ModuleKind.Combine) {
      if (!spec.structureIn?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "combine requires structureIn — pipeline-state structure from an earlier step (not list[...])",
          path: ["structureIn"],
        })
      }
      const inHint = parseStructureHint(spec.structureIn)
      if (inHint?.isList) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "combine structureIn is the state structure name (e.g. TableRow), not list[TableRow]",
          path: ["structureIn"],
        })
      }
    }
    if (spec.kind === ModuleKind.Assemble && !spec.assembleBindings) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "assemble requires assembleBindings",
        path: ["assembleBindings"],
      })
    }
    if (spec.kind === ModuleKind.Fork) {
      if (!spec.forkBranches || spec.forkBranches.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fork requires forkBranches (2–12 linear lanes)",
          path: ["forkBranches"],
        })
      }
    }
    if (spec.kind === ModuleKind.IfElse || spec.kind === ModuleKind.Case) {
      if (!spec.ifCondition?.path?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            spec.kind === ModuleKind.Case
              ? "case requires ifCondition.path on the spine"
              : "if-else requires ifCondition.path on the spine",
          path: ["ifCondition"],
        })
      }
    }
    if (spec.kind === ModuleKind.Connect) {
      if (!spec.connectActionId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "connect requires connectActionId from list_connect_actions",
          path: ["connectActionId"],
        })
      } else if (!getConnectAction(spec.connectActionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown connect action "${spec.connectActionId}" — use list_connect_actions`,
          path: ["connectActionId"],
        })
      }
    }
  })

export const modulePatchEntrySchema = z.object({
  index: z.number().int(),
  label: z.string().optional(),
  note: z.string().optional(),
  structureIn: z.string().optional(),
  structureOut: z.string().optional(),
  inputType: z.enum(INPUT_TYPE_VALUES as [string, ...string[]]).optional(),
  inputNameContains: z.string().optional(),
  inputDescription: z.string().optional(),
  checkInputDescription: z.boolean().optional(),
  prompt: z.string().optional(),
  code: z.string().optional(),
  model: z.string().optional(),
  inputMinCount: z.number().int().min(1).optional(),
  assembleBindings: assembleBindingsSchema.optional(),
  ifCondition: ifConditionSchema.optional(),
  n8nNodeType: z.string().optional(),
  n8nParameters: z.record(z.string(), z.unknown()).optional(),
  connectActionId: z.string().optional(),
  connectParameters: z.record(z.string(), z.unknown()).optional(),
  sql: z.string().optional(),
  sqlSeedRows: z.array(z.record(z.string(), z.unknown())).max(64).optional(),
})

const ASSISTANT_DOC_TYPES = [
  InputType.Text,
  InputType.Markdown,
  InputType.Latex,
  InputType.Json,
] as const satisfies readonly InputType[]

export const docSpecSchema = z.object({
  name: z.string(),
  type: z.enum(ASSISTANT_DOC_TYPES),
  content: z.string().max(32_000),
  label: z.enum([DocLabel.Inference, DocLabel.Training]).optional(),
})

export const proposedActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("run_inference"),
  }),
  z.object({
    type: z.literal("run_test"),
    testDocName: z.string().min(1).max(256).optional(),
  }),
])

export const assistantResponseSchema = z.object({
  message: z.string().describe(
    "Short user-facing proposal summary — present/future tense ('I'll add…'), never past tense as if already applied. User must Approve first.",
  ),
  modules: z
    .array(moduleSpecSchema)
    .nullable()
    .describe("FULL pipeline replacement when restructuring; null when using modulePatch or no pipeline change (prefer modulePatch for small edits to existing steps)"),
  modulePatch: z
    .array(modulePatchEntrySchema)
    .nullable()
    .describe("Targeted edits by 0-based step index — null when modules is non-null or on validation-fix retries"),
  models: z
    .array(structureModelSpecSchema)
    .nullable()
    .describe("FULL structure models array when changing schemas; null when unchanged"),
  typeAliases: z.array(typeAliasSpecSchema).nullable(),
  docs: z.array(docSpecSchema).nullable(),
  documentationUpdate: z.string().max(48_000).nullable(),
  projectNameUpdate: z.string().max(120).nullable(),
  targetFunctionName: z
    .string()
    .max(80)
    .nullish()
    .describe(
      "Name of the function (pipeline) these modules belong to. Null = the currently active function. A new name adds a function without replacing the others.",
    ),
  proposedActions: z.array(proposedActionSchema).max(3).nullish(),
})

export type PipelineAssistantModuleSpec = z.infer<typeof moduleSpecSchema>
export type PipelineAssistantModulePatchEntry = z.infer<typeof modulePatchEntrySchema>
export type PipelineAssistantModelSpec = z.infer<typeof structureModelSpecSchema>
export type ProjectAssistantDocSpec = z.infer<typeof docSpecSchema>
export type AssistantProposedAction = z.infer<typeof proposedActionSchema>
export type AssistantResponseRaw = z.infer<typeof assistantResponseSchema>

export function parseModuleSpec(spec: unknown): { ok: true; data: PipelineAssistantModuleSpec } | { ok: false; error: string } {
  const parsed = moduleSpecSchema.safeParse(spec)
  if (parsed.success) return { ok: true, data: parsed.data }
  return {
    ok: false,
    error: parsed.error.issues
      .slice(0, 8)
      .map((i) => `${i.path.length ? i.path.join(".") : "root"}: ${i.message}`)
      .join("; "),
  }
}

export function parseModuleSpecsDeep(specs: unknown[]): { ok: true; data: PipelineAssistantModuleSpec[] } | { ok: false; errors: string[] } {
  const out: PipelineAssistantModuleSpec[] = []
  const errors: string[] = []
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i]
    const parsed = parseModuleSpec(spec)
    if (!parsed.ok) {
      errors.push(`steps[${i}]: ${parsed.error}`)
      continue
    }
    const branches = parsed.data.forkBranches
    if (branches?.length) {
      const nextBranches = []
      for (const b of branches) {
        const nested = Array.isArray(b.modules) ? b.modules : []
        const nestedParsed = parseModuleSpecsDeep(nested)
        if (!nestedParsed.ok) {
          errors.push(`steps[${i}].${b.label}: ${nestedParsed.errors.join("; ")}`)
          nextBranches.push(b)
        } else {
          nextBranches.push({ ...b, modules: nestedParsed.data })
        }
      }
      out.push({ ...parsed.data, forkBranches: nextBranches })
    } else {
      out.push(parsed.data)
    }
  }
  if (errors.length) return { ok: false, errors }
  return { ok: true, data: out }
}
