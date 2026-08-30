// AI : compile LLM JavaScript into the JSON authoring IR. Library bindings only — no fs/process.
import ts from "typescript"
import {
  assistantResponseSchema,
  type AssistantResponseRaw,
} from "@/lib/server/pipeline-authoring-schema"
import {
  assemble,
  assertStep,
  beginSpineJsProgram,
  chatbot,
  chunk,
  combine,
  connect,
  customCode,
  exampleSelect,
  fork,
  humanReview,
  ifElse,
  input,
  llm,
  llmBatch,
  merge,
  n8n,
  output,
  parallel,
  pipeline,
  sql,
  takeLastSpineProgram,
  transform,
  webhook,
  type SpineProgram,
} from "./api"
import { model } from "./zod-models"
import { z } from "zod"
import {
  beginWorkflowProgram,
  Document,
  generateObject,
  isWorkflowAuthoringSource,
  step,
  stripAsyncAwait,
  takeLastWorkflowProgram,
  task,
  tracingPromiseAll,
  workflow,
} from "./workflow"

export type SpineJsCompileOk = {
  ok: true
  program: SpineProgram
  raw: AssistantResponseRaw
}

export type SpineJsCompileFail = {
  ok: false
  errors: string[]
}

export type SpineJsCompileResult = SpineJsCompileOk | SpineJsCompileFail

const BINDINGS = {
  z,
  model,
  pipeline,
  input,
  llm,
  llmBatch,
  exampleSelect,
  customCode,
  transform,
  chunk,
  merge,
  output,
  assertStep,
  humanReview,
  combine,
  assemble,
  fork,
  ifElse,
  parallel,
  connect,
  n8n,
  sql,
  chatbot,
  webhook,
  workflow,
  task,
  step,
  generateObject,
  Document,
  __promiseAll: tracingPromiseAll,
}

function rewriteSpineJsSource(source: string): string {
  let s = source.replace(/^\uFEFF/, "")
  s = s.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
  s = s.replace(/^import\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
  s = s.replace(/^[ \t]*export\s+default\s+/gm, "__spine.default = ")
  s = s.replace(/^[ \t]*export\s+const\s+(\w+)\s*=/gm, "__spine.$1 =")
  s = s.replace(/^[ \t]*export\s+let\s+(\w+)\s*=/gm, "__spine.$1 =")
  return s
}

function transpileAuthoring(source: string): { ok: true; js: string } | { ok: false; errors: string[] } {
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2019,
      isolatedModules: true,
      skipLibCheck: true,
      strict: false,
    },
    fileName: "pipeline.ts",
    reportDiagnostics: true,
  })
  const errors = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error)
  if (errors.length) {
    return {
      ok: false,
      errors: errors.slice(0, 12).map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")),
    }
  }
  return { ok: true, js: result.outputText }
}

export function extractSpineJsSource(raw: string): string {
  const fenced = raw.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const trimmed = raw.trim()
  if (/\b(pipeline|input|llmBatch|llm|workflow|generateObject|task)\s*\(/.test(trimmed)) return trimmed
  throw new Error("no JavaScript pipeline found — expected export const main = workflow(...) or a ```ts fence")
}

function asDocs(value: unknown): SpineProgram["docs"] {
  if (!Array.isArray(value)) return null
  return value as SpineProgram["docs"]
}

function programFromExports(exports: Record<string, unknown>, captured: SpineProgram | undefined): SpineProgram | undefined {
  const def = exports.default ?? exports.main
  const base =
    def && typeof def === "object" && Array.isArray((def as SpineProgram).modules)
      ? (def as SpineProgram)
      : captured
  if (!base) return undefined
  return {
    ...base,
    message: typeof exports.message === "string" ? exports.message : base.message,
    docs: asDocs(exports.docs) ?? base.docs,
    documentationUpdate:
      typeof exports.documentation === "string" ? exports.documentation : base.documentationUpdate,
    projectNameUpdate:
      typeof exports.projectName === "string" ? exports.projectName : base.projectNameUpdate,
    targetFunctionName:
      typeof exports.targetFunctionName === "string" ? exports.targetFunctionName : base.targetFunctionName,
  }
}

export function compileSpineJs(source: string): SpineJsCompileResult {
  beginSpineJsProgram()
  beginWorkflowProgram()
  const transpiled = transpileAuthoring(source)
  if (!transpiled.ok) return transpiled
  const workflowSrc = isWorkflowAuthoringSource(source)
  const prepared = workflowSrc ? stripAsyncAwait(transpiled.js) : transpiled.js
  const rewritten = rewriteSpineJsSource(prepared)
  const names = Object.keys(BINDINGS)
  const body = `"use strict";
const process = undefined;
const require = undefined;
const Promise = { all: spine.__promiseAll, resolve: globalThis.Promise.resolve.bind(globalThis.Promise), reject: globalThis.Promise.reject.bind(globalThis.Promise) };
const { ${names.filter((n) => n !== "__promiseAll").join(", ")} } = spine;
${rewritten}
return __spine;`
  let exportsObj: Record<string, unknown>
  try {
    const fn = new Function("spine", "__spine", body)
    exportsObj = (fn(BINDINGS, {}) ?? {}) as Record<string, unknown>
  } catch (err) {
    const zodIssues = (err as { issues?: { path: (string | number)[]; message: string }[] }).issues
    if (Array.isArray(zodIssues)) {
      return {
        ok: false,
        errors: zodIssues.slice(0, 12).map((i) => `${i.path.join(".") || "args"}: ${i.message}`),
      }
    }
    return { ok: false, errors: [`compile: ${(err as Error).message}`] }
  }
  const program = programFromExports(exportsObj, takeLastWorkflowProgram() ?? takeLastSpineProgram())
  if (!program?.modules?.length) {
    return {
      ok: false,
      errors: [
        workflowSrc
          ? "compile: workflow() was not called — export const main = workflow(async (files) => { ... })"
          : "compile: pipeline() was not called",
      ],
    }
  }
  const rawParsed = assistantResponseSchema.safeParse({
    message: program.message || "I'll add this pipeline.",
    modules: program.modules,
    modulePatch: null,
    models: program.models,
    typeAliases: null,
    docs: program.docs,
    documentationUpdate: program.documentationUpdate,
    projectNameUpdate: program.projectNameUpdate,
    targetFunctionName: program.targetFunctionName,
    proposedActions: null,
  })
  if (!rawParsed.success) {
    return {
      ok: false,
      errors: rawParsed.error.issues.slice(0, 12).map((i) => `${i.path.join(".") || "root"}: ${i.message}`),
    }
  }
  return { ok: true, program, raw: rawParsed.data }
}

export function isSpineJsAuthoringPrompt(prompt: string): boolean {
  return (
    prompt.includes("export const main = workflow") ||
    prompt.includes("export default pipeline") ||
    prompt.includes("generateObject") ||
    prompt.includes("spine-js") ||
    prompt.includes("pipeline.js") ||
    prompt.includes("pipeline.ts") ||
    (prompt.includes("from \"spine\"") && (prompt.includes("pipeline(") || prompt.includes("workflow(")))
  )
}
