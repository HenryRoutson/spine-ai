// AI : typed backend contract for Lovable-style React — OpenAPI + .d.ts, never the pipeline IR.
import { orderedInputModules } from "@/lib/inference-input"
import { allModelsToDts } from "@/lib/server/pydantic"
import { ModuleKind, type PipelineModule, type Project, type StructureModel } from "@/lib/types"
import { modelToJsonSchema } from "@/lib/windmill/schema"
import { listedWebsitePipelineBindings } from "@/lib/website-pipelines"
import type { HostedSiteOptions } from "@/lib/shared-link-types"

export type pipeline_alias = string

export type PipelineClientContract = {
  openapi: Record<string, unknown>
  types: string
}

function modelById(project: Project, id: string | undefined): StructureModel | undefined {
  return id ? project.models.find((m) => m.id === id) : undefined
}

function jsonSchemaFor(project: Project, model: StructureModel | undefined): Record<string, unknown> {
  if (!model) return { type: "object", additionalProperties: true }
  return modelToJsonSchema(model, project.models, project.typeAliases ?? [])
}

function typeName(model: StructureModel | undefined, fallback: string): string {
  const name = model?.name?.trim()
  return name && /^[A-Za-z][A-Za-z0-9_]*$/.test(name) ? name : fallback
}

function outputModules(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === ModuleKind.Output)
}

export function pipelineOpenApiDocument(
  project: Project,
  aliases: pipeline_alias[] = ["run"],
): Record<string, unknown> {
  const input = orderedInputModules(project.modules)[0]
  const output = outputModules(project.modules)[0]
  const inModel = modelById(project, input?.outStructureId)
  const outModel = modelById(project, output?.outStructureId ?? output?.inStructureId)
  const paths: Record<string, unknown> = {}
  for (const alias of aliases.length ? aliases : ["run"]) {
    paths[`/run/${alias}`] = {
      post: {
        operationId: `run_${alias.replace(/[^A-Za-z0-9]+/g, "_")}`,
        summary: `Run bound pipeline "${alias}"`,
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  files: { type: "array", items: { type: "string", format: "binary" } },
                  json: jsonSchemaFor(project, inModel),
                },
              },
            },
            "application/json": {
              schema: jsonSchemaFor(project, inModel),
            },
          },
        },
        responses: {
          "200": {
            description: "Typed pipeline output",
            content: {
              "application/json": {
                schema: jsonSchemaFor(project, outModel),
              },
            },
          },
        },
      },
    }
  }
  return {
    openapi: "3.1.0",
    info: {
      title: project.name || "Spine pipeline",
      version: "1",
      description:
        "Hosted run contract. Call <RunPipeline alias /> or POST /run/{alias}. Do not invent other backend routes.",
    },
    paths,
  }
}

export function pipelineClientTypes(
  project: Project,
  aliases: pipeline_alias[] = ["run"],
): string {
  const input = orderedInputModules(project.modules)[0]
  const output = outputModules(project.modules)[0]
  const inModel = modelById(project, input?.outStructureId)
  const outModel = modelById(project, output?.outStructureId ?? output?.inStructureId)
  const inName = typeName(inModel, "SpineRunInput")
  const outName = typeName(outModel, "SpineRunOutput")
  const aliasUnion = (aliases.length ? aliases : ["run"]).map((a) => JSON.stringify(a)).join(" | ") || '"run"'
  const models = allModelsToDts(project.models, project.typeAliases ?? []).trim()
  return `${models}

export type SpineRunAlias = ${aliasUnion};
export type SpineRunRequest = ${inName} | { files?: File[]; json?: ${inName} };
export type SpineRunResponse = ${outName};

export declare function runPipeline(alias: SpineRunAlias, input?: SpineRunRequest): Promise<SpineRunResponse>;
`
}

export function pipelineClientContract(
  project: Project,
  siteOptions?: HostedSiteOptions,
): PipelineClientContract {
  const aliases = listedWebsitePipelineBindings(siteOptions?.pipelineBindings ?? [])
    .map((b) => b.alias)
    .filter((a) => a.trim().length > 0)
  const names = aliases.length ? aliases : ["run"]
  return {
    openapi: pipelineOpenApiDocument(project, names),
    types: pipelineClientTypes(project, names),
  }
}

export function pipelineClientContractText(project: Project, siteOptions?: HostedSiteOptions): string {
  const contract = pipelineClientContract(project, siteOptions)
  return `src/spine-api.d.ts (typed backend contract — the only API the page may call):
${contract.types}

OpenAPI (same contract):
${JSON.stringify(contract.openapi, null, 2)}
`
}
