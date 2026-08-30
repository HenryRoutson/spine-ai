// AI : compile-time contract the frontend agent sees — never the node/edge IR.
import type { SpineProgram } from "./api"

function specToTsFields(model: { name: string; fields?: Array<{ name: string; type: string; optional?: boolean; ref?: string }> }): string {
  const fields = (model.fields ?? []).map((f) => {
    const t =
      f.type === "int" || f.type === "float"
        ? "number"
        : f.type === "bool"
          ? "boolean"
          : f.type === "json"
            ? "unknown"
            : f.type === "list[text]"
              ? "string[]"
              : f.type === "model" && f.ref
                ? f.ref
                : f.type === "list[model]" && f.ref
                  ? `${f.ref}[]`
                  : f.type === "document"
                    ? "Document"
                    : f.type === "list[document]"
                      ? "Document[]"
                      : "string"
    return `  ${f.name}${f.optional ? "?" : ""}: ${t};`
  })
  return `export interface ${model.name} {\n${fields.join("\n") || "  [key: string]: unknown;"}\n}\n`
}

function hintToTs(hint: string | undefined, asList: boolean): string {
  if (!hint) return asList ? "unknown[]" : "unknown"
  const m = /^list\[(.+)\]$/i.exec(hint.trim())
  if (m) return `${m[1]}[]`
  return asList ? `${hint}[]` : hint
}

export function programToOpenApi(program: SpineProgram): Record<string, unknown> {
  const input = program.modules.find((m) => m.kind === "input")
  const output = [...program.modules].reverse().find((m) => m.kind === "output")
  const schemas: Record<string, unknown> = {}
  for (const model of program.models) {
    schemas[model.name] = {
      type: "object",
      properties: Object.fromEntries(
        (model.fields ?? []).map((f) => [f.name, { type: f.type === "float" || f.type === "int" ? "number" : f.type === "bool" ? "boolean" : "string" }]),
      ),
    }
  }
  return {
    openapi: "3.1.0",
    info: { title: "Spine run contract", version: "1.0.0" },
    paths: {
      "/run": {
        post: {
          operationId: "run",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: `#/components/schemas/${hintName(input?.structureOut) || "Document"}` } } },
          },
          responses: {
            "200": {
              description: "Pipeline output",
              content: { "application/json": { schema: { $ref: `#/components/schemas/${hintName(output?.structureOut) || "Output"}` } } },
            },
          },
        },
      },
    },
    components: { schemas: { Document: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } } }, ...schemas } },
  }
}

function hintName(hint: string | undefined): string {
  if (!hint) return ""
  const m = /^list\[(.+)\]$/i.exec(hint.trim())
  return (m ? m[1] : hint).trim()
}

export function programToOpenApiJson(program: SpineProgram): string {
  return `${JSON.stringify(programToOpenApi(program), null, 2)}\n`
}

export function programToContractDts(program: SpineProgram): string {
  const input = program.modules.find((m) => m.kind === "input")
  const output = [...program.modules].reverse().find((m) => m.kind === "output")
  const inTs = hintToTs(input?.structureOut, false)
  const outTs = hintToTs(output?.structureOut ?? output?.structureIn, input?.structureOut?.startsWith("list[") === true && (output?.kind === "output"))
  const models = program.models.map(specToTsFields).join("\n")
  return [
    "// generated run contract — the frontend calls run(); it does not see the pipeline graph.",
    "export interface Document { filename: string; content?: string }",
    models.trim(),
    `export type RunInput = ${inTs};`,
    `export type RunOutput = ${outTs};`,
    "export declare function run(input: RunInput): Promise<RunOutput>;",
    "",
  ].join("\n")
}
