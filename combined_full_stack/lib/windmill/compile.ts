// AI : Spine pipeline → Windmill OpenFlow. LLM hops use aiagent + Zod JSON Schema; quotes/SQL/tests stay Spine extras.
import { z } from "zod"
import { exampleSelectRelevanceSchema } from "@/lib/example-select-relevance"
import { DEFAULT_EXAMPLE_SELECT_PROMPT, examplePromptColumns } from "@/lib/example-select"
import { forkBranchesOf } from "@/lib/fork-pipeline"
import { padIfElseBranches } from "@/lib/if-else-pipeline"
import { isDefaultCaseMatch, padCaseBranches } from "@/lib/case-pipeline"
import { customCodeEntriesForModule } from "@/lib/custom_code_entries"
import { resolveN8nForExport } from "@/lib/n8n-step"
import { llmSchema } from "@/lib/server/structure"
import { stepEmitsList } from "@/lib/server/type_expr"
import { ModuleKind, type ModuleId, type PipelineModule, type Project, type StructureModel } from "@/lib/types"
import { orderedInputModules } from "@/lib/inference-input"
import { modelToJsonSchema } from "./schema"
import { bunMainForN8n, windmillContentForCustom, windmillLanguageForCustom } from "./scripts"
import type {
  WindmillFlowModule,
  WindmillInputTransform,
  WindmillOpenFlow,
} from "./types"

const SPINE_EXTRAS = [
  "Derived prompts from Zod JSON Schema (system_prompt + output_schema on every LLM hop).",
  "Quote fields click through to source document highlights (quote linker stays in Spine).",
  "Vibe coding authors this graph; OpenFlow is the execution IR.",
  "Shared SQL tables + Zod/Pydantic from one StructureModel (see schema.json / schema.sql / models.py).",
  "Testing: deterministic fields exact-compare; probabilistic fields LLM-check (Testing tab, not this flow).",
].join("\n")

function flowId(moduleId: string): string {
  const raw = moduleId.replace(/[^A-Za-z0-9_-]+/g, "_")
  return /^[A-Za-z]/.test(raw) ? raw : `s_${raw}`
}

function js(expr: string): WindmillInputTransform {
  return { type: "javascript", expr }
}

function lit(value: unknown): WindmillInputTransform {
  return { type: "static", value }
}

function prevExpr(prevId: string | undefined): string {
  return prevId ? `results[${JSON.stringify(flowId(prevId))}]` : "flow_input.input"
}

function pathExpr(root: string, path: string): string {
  const parts = path
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return root
  return parts.reduce((acc, p) => `${acc}?.[${JSON.stringify(p)}]`, root)
}

function modelById(models: StructureModel[], id: string | undefined): StructureModel | undefined {
  return id ? models.find((m) => m.id === id) : undefined
}

function llmOutputSchema(m: PipelineModule, project: Project): Record<string, unknown> | undefined {
  const out = modelById(project.models, m.outStructureId)
  if (!out) return undefined
  return z.toJSONSchema(llmSchema(out, project.models, stepEmitsList(m), project.typeAliases ?? [])) as Record<
    string,
    unknown
  >
}

function unwrapInput(m: PipelineModule, summary: string): WindmillFlowModule {
  return {
    id: flowId(m.id),
    summary,
    value: {
      type: "rawscript",
      language: "bun",
      content: "export async function main(input: unknown) {\n  return input;\n}\n",
      input_transforms: { input: js("flow_input.input") },
    },
  }
}

function passthrough(m: PipelineModule, summary: string, prevId: string | undefined): WindmillFlowModule {
  // AI : Windmill identity for extras Spine still runs (quotes, Nango, OCR). Input unwraps flow_input.input.
  if (!prevId) return unwrapInput(m, summary)
  return {
    id: flowId(m.id),
    summary,
    value: { type: "identity" },
  }
}

function compileLlm(m: PipelineModule, project: Project, prevId: string | undefined): WindmillFlowModule {
  const schema = llmOutputSchema(m, project)
  const userPrompt = m.prompt?.trim() || "Process the input."
  const schemaText = schema ? JSON.stringify(schema, null, 2) : "{}"
  return {
    id: flowId(m.id),
    summary: `${m.label} — structured LLM (Zod-derived output_schema)`,
    value: {
      type: "aiagent",
      tools: [],
      input_transforms: {
        user_message: js(`JSON.stringify(${prevExpr(prevId)})`),
        system_prompt: lit(
          `Respond with ONLY a JSON value that validates against this JSON Schema:\n${schemaText}\n\n${userPrompt}`,
        ),
        ...(schema ? { output_schema: lit(schema) } : {}),
        output_type: lit("text"),
      },
    },
  }
}

function compileLlmBatch(m: PipelineModule, project: Project, prevId: string | undefined): WindmillFlowModule {
  const inner = compileLlm({ ...m, id: `${m.id}_item` as ModuleId } as PipelineModule, project, undefined)
  inner.value =
    inner.value.type === "aiagent"
      ? {
          ...inner.value,
          input_transforms: {
            ...inner.value.input_transforms,
            user_message: js("JSON.stringify(flow_input.iter.value)"),
          },
        }
      : inner.value
  return {
    id: flowId(m.id),
    summary: `${m.label} — parallel structured LLM batch`,
    value: {
      type: "forloopflow",
      iterator: js(`Array.isArray(${prevExpr(prevId)}) ? ${prevExpr(prevId)} : [${prevExpr(prevId)}]`),
      skip_failures: false,
      parallel: true,
      modules: [inner],
    },
  }
}

function compileExampleSelect(m: PipelineModule, prevId: string | undefined): WindmillFlowModule {
  const columns = examplePromptColumns(m)
  const viewNote = columns?.length
    ? `Prompt VIEW projects ${columns.join(", ")} into {example}; spine keeps the full row.`
    : "Prompt VIEW unset — stringify the full candidate into {example}."
  const schema = z.toJSONSchema(exampleSelectRelevanceSchema) as Record<string, unknown>
  const inner: WindmillFlowModule = {
    id: `${flowId(m.id)}_relevance`,
    summary: "per-item relevance (not embeddings)",
    value: {
      type: "aiagent",
      tools: [],
      input_transforms: {
        user_message: js("JSON.stringify(flow_input.iter.value)"),
        system_prompt: lit(
          `Respond with ONLY a JSON value that validates against this JSON Schema:\n${JSON.stringify(schema, null, 2)}\n\n${m.prompt?.trim() || DEFAULT_EXAMPLE_SELECT_PROMPT}\n\n${viewNote}`,
        ),
        output_schema: lit(schema),
        output_type: lit("text"),
      },
    },
  }
  return {
    id: flowId(m.id),
    summary: `${m.label} — example-select (${viewNote})`,
    value: {
      type: "forloopflow",
      iterator: js(`Array.isArray(${prevExpr(prevId)}) ? ${prevExpr(prevId)} : [${prevExpr(prevId)}]`),
      skip_failures: false,
      parallel: true,
      modules: [inner],
    },
  }
}

function compileN8n(m: PipelineModule, prevId: string | undefined): WindmillFlowModule {
  const resolved = resolveN8nForExport(m)
  return {
    id: flowId(m.id),
    summary: `${m.label} — n8n piece ${resolved.nodeType} on Windmill bun`,
    value: {
      type: "rawscript",
      language: "bun",
      content: bunMainForN8n(resolved.code, resolved.params),
      input_transforms: { input: js(prevExpr(prevId)) },
    },
  }
}

function compileCustom(m: PipelineModule, prevId: string | undefined): WindmillFlowModule {
  const entry = customCodeEntriesForModule(m)[0]
  if (!entry?.code.trim()) return passthrough(m, `${m.label} — custom-code passthrough`, prevId)
  return {
    id: flowId(m.id),
    summary: `${m.label} — ${entry.language} on Windmill workers`,
    value: {
      type: "rawscript",
      language: windmillLanguageForCustom(entry.language),
      content: windmillContentForCustom(entry.language, entry.code),
      input_transforms: {
        input: js(prevExpr(prevId)),
        state: js("results"),
      },
    },
  }
}

function compileWebhook(m: PipelineModule, prevId: string | undefined): WindmillFlowModule {
  const method = m.webhookMethod ?? "POST"
  const url = m.webhookUrl?.trim() || ""
  return {
    id: flowId(m.id),
    summary: `${m.label} — webhook ${method}`,
    value: {
      type: "rawscript",
      language: "bun",
      content: `export async function main(input: unknown, url: string) {
  const res = await fetch(url, {
    method: ${JSON.stringify(method)},
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ input }),
  });
  return await res.json();
}
`,
      input_transforms: {
        input: js(prevExpr(prevId)),
        url: lit(url),
      },
    },
  }
}

function compileSql(m: PipelineModule, prevId: string | undefined): WindmillFlowModule {
  const sql = m.sql?.trim() || "SELECT 1"
  return {
    id: flowId(m.id),
    summary: `${m.label} — SQL (Spine app rows; Windmill dialect is postgresql)`,
    value: {
      type: "rawscript",
      language: "postgresql",
      content: sql,
      input_transforms: { input: js(prevExpr(prevId)) },
    },
  }
}

function compileParallel(m: PipelineModule, project: Project, prevId: string | undefined): WindmillFlowModule {
  const branches = m.parallelBranches ?? []
  if (!branches.length) return passthrough(m, `${m.label} — parallel LLM`, prevId)
  return {
    id: flowId(m.id),
    summary: `${m.label} — parallel LLM branches`,
    value: {
      type: "branchall",
      parallel: true,
      branches: branches.map((b) => ({
        summary: b.field,
        skip_failure: false,
        modules: [
          compileLlm(
            {
              ...m,
              id: `${m.id}_${b.field}` as ModuleId,
              prompt: b.prompt,
              outStructureId: b.outStructureId,
            } as PipelineModule,
            project,
            prevId,
          ),
        ],
      })),
    },
  }
}

function compileFork(m: PipelineModule, project: Project, prevId: string | undefined): WindmillFlowModule {
  const branches = forkBranchesOf(m)
  return {
    id: flowId(m.id),
    summary: `${m.label} — parallel fork (${m.forkJoin ?? "product"} join in Spine)`,
    value: {
      type: "branchall",
      parallel: true,
      branches: branches.map((b) => ({
        summary: b.label,
        skip_failure: false,
        modules: compileModuleList(b.modules, project, prevId),
      })),
    },
  }
}

function compileIfElse(m: PipelineModule, project: Project, prevId: string | undefined): WindmillFlowModule {
  const [thenB, elseB] = padIfElseBranches(m.forkBranches)
  const path = m.ifCondition?.path?.trim() ?? ""
  const expr = `Boolean(${pathExpr(prevExpr(prevId), path)})`
  return {
    id: flowId(m.id),
    summary: `${m.label} — if/else on ${path || "bool path"}`,
    value: {
      type: "branchone",
      branches: [
        {
          summary: thenB.label,
          expr,
          modules: compileModuleList(thenB.modules, project, prevId),
        },
      ],
      default: compileModuleList(elseB.modules, project, prevId),
    },
  }
}

function compileCase(m: PipelineModule, project: Project, prevId: string | undefined): WindmillFlowModule {
  const branches = padCaseBranches(m.forkBranches)
  const path = m.ifCondition?.path?.trim() ?? ""
  const disc = `String(${pathExpr(prevExpr(prevId), path)} ?? "")`
  const defaultBranch = branches.find((b) => isDefaultCaseMatch(b.match))
  const arms = branches.filter((b) => !isDefaultCaseMatch(b.match))
  return {
    id: flowId(m.id),
    summary: `${m.label} — case on ${path || "path"}`,
    value: {
      type: "branchone",
      branches: arms.map((b) => ({
        summary: b.label,
        expr: `${disc} === ${JSON.stringify(b.match ?? "")}`,
        modules: compileModuleList(b.modules, project, prevId),
      })),
      default: compileModuleList(defaultBranch?.modules ?? [], project, prevId),
    },
  }
}

function compileOne(
  m: PipelineModule,
  project: Project,
  prevId: string | undefined,
): WindmillFlowModule {
  switch (m.kind) {
    case ModuleKind.Input:
      return passthrough(m, `${m.label} — flow_input.input`, undefined)
    case ModuleKind.Output:
      return passthrough(m, `${m.label} — snapshot`, prevId)
    case ModuleKind.DocToText:
      return passthrough(m, `${m.label} — convert to text (Spine OCR/parser extra)`, prevId)
    case ModuleKind.Quote:
      return passthrough(m, `${m.label} — quote linker (click-to-highlight in Spine documents)`, prevId)
    case ModuleKind.Combine:
    case ModuleKind.Assemble:
    case ModuleKind.Transform:
    case ModuleKind.ControlJoin:
      return m.code?.trim() ? compileCustom(m, prevId) : passthrough(m, `${m.label} — ${m.kind}`, prevId)
    case ModuleKind.Parallel:
      return compileParallel(m, project, prevId)
    case ModuleKind.Llm:
      return compileLlm(m, project, prevId)
    case ModuleKind.Chatbot:
      return passthrough(m, `${m.label} — chatbot pause (Spine extra)`, prevId)
    case ModuleKind.LlmBatch:
      return compileLlmBatch(m, project, prevId)
    case ModuleKind.ExampleSelect:
      return compileExampleSelect(m, prevId)
    case ModuleKind.N8n:
      return compileN8n(m, prevId)
    case ModuleKind.CustomCode:
    case ModuleKind.Chunk:
    case ModuleKind.Merge:
    case ModuleKind.Assert:
      return compileCustom(m, prevId)
    case ModuleKind.Webhook:
      return compileWebhook(m, prevId)
    case ModuleKind.Sql:
      return compileSql(m, prevId)
    case ModuleKind.Connect:
      return passthrough(m, `${m.label} — Nango connect (Spine extra, not a Windmill resource)`, prevId)
    case ModuleKind.HumanReview:
      return {
        ...passthrough(m, `${m.label} — human review`, prevId),
        suspend: { required_events: 1 },
      }
    case ModuleKind.Fork:
      return compileFork(m, project, prevId)
    case ModuleKind.IfElse:
      return compileIfElse(m, project, prevId)
    case ModuleKind.Case:
      return compileCase(m, project, prevId)
  }
}

function compileModuleList(
  modules: PipelineModule[],
  project: Project,
  startPrev: string | undefined,
): WindmillFlowModule[] {
  const out: WindmillFlowModule[] = []
  let prev = startPrev
  for (const m of modules) {
    const compiled = compileOne(m, project, prev)
    out.push(compiled)
    prev = m.id
  }
  return out
}

function flowInputSchema(project: Project): Record<string, unknown> {
  const first = orderedInputModules(project.modules)[0]
  const model = first ? modelById(project.models, first.outStructureId) : undefined
  const inputSchema = model
    ? modelToJsonSchema(model, project.models, project.typeAliases ?? [])
    : { type: "object" }
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {
      input: inputSchema,
    },
    required: ["input"],
  }
}

export function compileProjectToOpenFlow(project: Project): WindmillOpenFlow {
  return {
    summary: project.name,
    description: [
      `Spine pipeline compiled to Windmill OpenFlow.`,
      "",
      "Spine extras (kept — not replaced by this IR):",
      SPINE_EXTRAS,
      project.documentation?.trim() ? `\nProject docs:\n${project.documentation.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    schema: flowInputSchema(project),
    value: { modules: compileModuleList(project.modules, project, undefined) },
  }
}

export function generateOpenFlowJson(project: Project): string {
  return `${JSON.stringify(compileProjectToOpenFlow(project), null, 2)}\n`
}
