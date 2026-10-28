// AI : compile LLM JavaScript into the JSON authoring IR. Library bindings only — no fs/process.
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
import { step, task, workflow } from "./workflow"
import { z } from "zod"

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
  Document: model("Document", {
    content: z.string().optional(),
    filename: z.string(),
  }),
}

function rewriteSpineJsSource(source: string): string {
  let s = source.replace(/^\uFEFF/, "")
  s = s.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
  s = s.replace(/^import\s+['"][^'"]+['"]\s*;?\s*$/gm, "")
  // AI : compile is sync — strip async/await so workflow() can trace without microtasks.
  s = s.replace(/\bPromise\.all\s*\(/g, "__spineAll(")
  s = s.replace(/\bawait\s+/g, "")
  s = s.replace(/\basync\s+(?=\()/g, "")
  s = s.replace(/\basync\s+function\b/g, "function")
  s = s.replace(/^[ \t]*export\s+default\s+/gm, "__spine.default = ")
  s = s.replace(/^[ \t]*export\s+const\s+(\w+)\s*=/gm, "__spine.$1 =")
  s = s.replace(/^[ \t]*export\s+let\s+(\w+)\s*=/gm, "__spine.$1 =")
  return s
}

export function extractSpineJsSource(raw: string): string {
  const fenced = raw.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()
  const trimmed = raw.trim()
  if (/\b(pipeline|workflow|input|llmBatch|llm)\s*\(/.test(trimmed)) return trimmed
  throw new Error("no JavaScript pipeline found — expected workflow(...) / export default pipeline(...) or a ```js fence")
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
  const rewritten = rewriteSpineJsSource(source)
  const names = Object.keys(BINDINGS)
  const values = Object.values(BINDINGS)
  const body = `"use strict";
const process = undefined;
const require = undefined;
function __spineAll(items) { return Array.isArray(items) ? items : [items]; }
const { ${names.join(", ")} } = spine;
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
  const program = programFromExports(exportsObj, takeLastSpineProgram())
  if (!program?.modules?.length) {
    return { ok: false, errors: ["compile: workflow() / pipeline() was not called"] }
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
    prompt.includes("export default pipeline") ||
    prompt.includes("export const main = workflow") ||
    prompt.includes("workflow(async") ||
    prompt.includes("Windmill workflows-as-code") ||
    prompt.includes("spine-js") ||
    prompt.includes("pipeline.js") ||
    (prompt.includes("from \"spine\"") && (prompt.includes("pipeline(") || prompt.includes("workflow(")))
  )
}
