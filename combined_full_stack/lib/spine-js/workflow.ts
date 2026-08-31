// AI : Windmill-shaped authoring — model writes ordinary async TS; we trace it into the JSON IR.
import { z, type ZodType } from "zod"
import {
  assemble,
  combine,
  customCode,
  fork,
  input,
  llm,
  llmBatch,
  output,
  pipeline,
  takeLastSpineProgram,
  type SpineProgram,
  type StepHandle,
} from "./api"
import { isZodType, model, structureRefFromZod, type StructureRef, zodTypeSchema } from "./zod-models"

const TRACE = Symbol("spine-trace")

export type TraceHandle = {
  [TRACE]: true
  id: string
  origin: "input" | "task" | "step" | "fork" | "list"
  structureName: string
  isList: boolean
  name?: string
  label?: string
  note?: string
  prompt?: string
  schema?: ZodType
  code?: string
  fnName?: string
  paramIndex?: number
  iterated?: boolean
  loopOf?: TraceHandle
  input?: TraceHandle
  forkLanes?: TraceHandle[]
  assembleFields?: Record<string, TraceHandle>
}

type WorkflowOp =
  | { type: "task"; handle: TraceHandle }
  | { type: "step"; handle: TraceHandle }
  | { type: "fork"; lanes: TraceHandle[]; out: TraceHandle }
  | { type: "flatMap"; code: string; input: TraceHandle; out: TraceHandle }

const generateObjectArgsSchema = z.object({
  schema: zodTypeSchema,
  prompt: z.string().min(1),
  note: z.string().optional(),
})

const LIST_PARAM_NAMES = new Set([
  "files",
  "docs",
  "documents",
  "resumes",
  "notes",
  "receipts",
  "items",
  "rows",
  "uploads",
  "chunks",
  "lines",
])
const SINGULAR_PARAM_NAMES = new Set([
  "doc",
  "document",
  "file",
  "contract",
  "policy",
  "checklist",
  "report",
  "job",
  "pack",
  "memo",
  "email",
])

let tracing = false
let seq = 0
let currentGenerate: { schema: ZodType; prompt: string; note?: string } | undefined
let params: TraceHandle[] = []
let ops: WorkflowOp[] = []
let lastWorkflowProgram: SpineProgram | undefined
const traceArrays = new WeakSet<object>()

export const Document = model("Document", {
  content: z.string().optional(),
  filename: z.string(),
})

export function beginWorkflowProgram(): void {
  tracing = false
  seq = 0
  currentGenerate = undefined
  params = []
  ops = []
  lastWorkflowProgram = undefined
}

export function takeLastWorkflowProgram(): SpineProgram | undefined {
  return lastWorkflowProgram
}

export function isWorkflowAuthoringSource(source: string): boolean {
  return (
    /\bworkflow\s*\(/.test(source) ||
    /\bgenerateObject\s*\(/.test(source) ||
    /\bexport\s+const\s+main\b/.test(source)
  )
}

function nextId(): string {
  seq += 1
  return `t${seq}`
}

function isHandle(value: unknown): value is TraceHandle {
  return !!value && typeof value === "object" && TRACE in (value as object)
}

function asHandle(value: unknown): TraceHandle | undefined {
  if (isHandle(value)) return value
  if (Array.isArray(value)) {
    const first = value.find(isHandle)
    if (first) return first
  }
  return undefined
}

function humanLabel(name: string): string {
  const spaced = name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim()
  if (!spaced) return "Step"
  return spaced.replace(/\b\w/g, (c) => c.toUpperCase())
}

function pascal(name: string): string {
  return humanLabel(name).replace(/\s+/g, "") || "Out"
}

function paramNames(fn: (...args: never[]) => unknown): string[] {
  const src = fn.toString().trim()
  const header =
    src.match(/^(?:async\s*)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/)?.[1] ??
    src.match(/^(?:async\s*)?\(([^)]*)\)\s*=>/)?.[1] ??
    src.match(/^(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/)?.[1] ??
    ""
  return header
    .split(",")
    .map((p) => p.trim().replace(/\s*=[\s\S]*$/, "").replace(/^\.\.\./, "").split(":")[0]?.trim() ?? "")
    .filter((p) => p && p !== "this")
}

function guessListParam(name: string, arity: number): boolean {
  const key = name.toLowerCase()
  if (SINGULAR_PARAM_NAMES.has(key)) return false
  if (LIST_PARAM_NAMES.has(key)) return true
  return arity === 1
}

function makeHandle(init: Omit<TraceHandle, typeof TRACE | "id"> & { id?: string }): TraceHandle {
  return {
    [TRACE]: true,
    id: init.id ?? nextId(),
    origin: init.origin,
    structureName: init.structureName,
    isList: init.isList,
    name: init.name,
    label: init.label,
    note: init.note,
    prompt: init.prompt,
    schema: init.schema,
    code: init.code,
    fnName: init.fnName,
    paramIndex: init.paramIndex,
    iterated: init.iterated,
    loopOf: init.loopOf,
    input: init.input,
    forkLanes: init.forkLanes,
    assembleFields: init.assembleFields,
  }
}

function wrapProxy(handle: TraceHandle): TraceHandle {
  return new Proxy(handle, {
    get(target, prop, receiver) {
      if (prop === TRACE) return true
      if (prop === "then") return undefined
      if (prop === Symbol.iterator) {
        return function* iterator() {
          target.iterated = true
          const item = makeHandle({
            origin: target.origin,
            structureName: target.structureName,
            isList: false,
            name: target.name,
            paramIndex: target.paramIndex,
            loopOf: target,
            schema: target.schema,
          })
          yield wrapProxy(item)
        }
      }
      if (prop === "content") return "sample line"
      if (prop === "filename") return "sample.txt"
      if (prop in target) {
        const own = Reflect.get(target, prop, receiver)
        if (typeof own === "function") return own.bind(target)
        return own
      }
      if (typeof prop === "symbol") return undefined
      return wrapProxy(
        makeHandle({
          origin: "list",
          structureName: String(prop),
          isList: true,
          input: target,
        }),
      )
    },
  })
}

function schemaRef(schema: ZodType | undefined, fallback: string): StructureRef {
  if (schema && isZodType(schema)) return structureRefFromZod(schema, fallback)
  return { name: fallback, isList: false, models: [] }
}

function placeholderFromSchema(schema: ZodType, fallback: string): TraceHandle {
  const ref = structureRefFromZod(schema, fallback)
  return wrapProxy(
    makeHandle({
      origin: "task",
      structureName: ref.name,
      isList: ref.isList,
      schema,
    }),
  )
}

function markTraceArray(arr: object): void {
  traceArrays.add(arr)
}

function isTraceArray(value: unknown): boolean {
  return !!value && typeof value === "object" && traceArrays.has(value)
}

function handlesInObject(value: unknown): Record<string, TraceHandle> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || isHandle(value)) return undefined
  const fields: Record<string, TraceHandle> = {}
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    const h = asHandle(v)
    if (h) {
      if (Array.isArray(v) || isTraceArray(v)) h.isList = true
      fields[key] = h
    }
  }
  return Object.keys(fields).length >= 2 ? fields : undefined
}

function sameInput(a: TraceHandle | undefined, b: TraceHandle | undefined): boolean {
  if (!a || !b) return false
  if (a.id === b.id) return true
  if (a.paramIndex != null && a.paramIndex === b.paramIndex && !a.loopOf && !b.loopOf) return true
  if (a.loopOf && b.loopOf && a.loopOf.id === b.loopOf.id) return true
  return false
}

function currentSpine(): TraceHandle | undefined {
  const last = ops[ops.length - 1]
  if (!last) return params[0]
  if (last.type === "fork") return last.out
  if (last.type === "flatMap") return last.out
  return last.handle
}

function arrowFromStepFn(fn: (...args: never[]) => unknown, input?: TraceHandle): string {
  const src = fn.toString().trim()
  const param = input?.name || "input"
  const stripped = src.replace(/^(?:async\s*)?\(\s*\)\s*=>\s*/, "").replace(/^(?:async\s*)?function\s*\(\s*\)\s*\{([\s\S]*)\}\s*$/, "$1")
  if (stripped !== src) return `(${param}) => ${stripped.trim()}`
  return `(${param}) => (${src})()`
}

function arrowFromTaskFn(fn: (...args: never[]) => unknown): string {
  const src = fn.toString().trim()
  const named = src.match(/^(?:async\s*)?function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{([\s\S]*)\}$/)
  if (named) {
    const paramsSrc = named[2]!.trim() || "input"
    const body = named[3]!.trim()
    return `(${paramsSrc}) => {\n${body}\n}`
  }
  return src.replace(/^async\s+/, "")
}

function commitTask(fn: (...args: never[]) => unknown, input: TraceHandle | undefined, out: unknown): TraceHandle {
  const gen = currentGenerate
  currentGenerate = undefined
  const assembleFields = handlesInObject(input as unknown) ?? handlesInObject(out)
  const fallbackName = pascal(fn.name || gen?.note || "Out")
  const fromOut = asHandle(out)
  const handle = makeHandle({
    origin: "task",
    structureName: gen ? schemaRef(gen.schema, fallbackName).name : fromOut?.structureName || fallbackName,
    isList: gen ? schemaRef(gen.schema, fallbackName).isList : fromOut?.isList ?? false,
    label: humanLabel(fn.name || "Task"),
    note: gen?.note || (fn.name ? `${humanLabel(fn.name)}.` : "Transform the input."),
    prompt: gen?.prompt,
    schema: gen?.schema ?? fromOut?.schema,
    code: gen ? undefined : arrowFromTaskFn(fn),
    fnName: fn.name,
    input,
    assembleFields,
  })
  ops.push({ type: "task", handle })
  return wrapProxy(handle)
}

export function generateObject<T>(opts: { schema: ZodType<T>; prompt: string; note?: string }): T {
  const parsed = generateObjectArgsSchema.parse(opts)
  if (!tracing) {
    throw new Error("generateObject() only runs while compiling a workflow()")
  }
  currentGenerate = parsed
  return placeholderFromSchema(parsed.schema, "Out") as T
}

export const llmCall = generateObject

export function task<A, R>(fn: (arg: A) => R): (arg: A) => R {
  return (arg: A) => {
    if (!tracing) return fn(arg)
    currentGenerate = undefined
    const input = asHandle(arg)
    const assembled = handlesInObject(arg)
    let out: R
    try {
      out = fn(arg)
    } catch (err) {
      throw new Error(`task(${fn.name || "fn"}): ${(err as Error).message}`)
    }
    const handle = commitTask(fn as (arg: never) => unknown, input, out)
    if (assembled) handle.assembleFields = assembled
    return handle as R
  }
}

export function step<T>(name: string, fn: () => T): T {
  if (!tracing) return fn()
  const input = currentSpine()
  let sample: unknown
  try {
    sample = fn()
  } catch {
    sample = undefined
  }
  const code = arrowFromStepFn(fn as (...args: never[]) => unknown, input)
  const looksList = Array.isArray(sample) || /\.split\b|\.map\b|\.flatMap\b/.test(code)
  let structureName = pascal(name)
  let schema: ZodType | undefined
  if (Array.isArray(sample) && sample[0] && typeof sample[0] === "object" && !Array.isArray(sample[0])) {
    const shape: Record<string, ZodType> = {}
    for (const [key, value] of Object.entries(sample[0] as Record<string, unknown>)) {
      shape[key] = typeof value === "number" ? z.number() : typeof value === "boolean" ? z.boolean() : z.string()
    }
    schema = model(structureName, shape)
  }
  const handle = makeHandle({
    origin: "step",
    structureName,
    isList: looksList,
    label: humanLabel(name),
    note: `${humanLabel(name)}.`,
    code,
    input,
    schema,
    name,
  })
  ops.push({ type: "step", handle })
  return wrapProxy(handle) as T
}

export function tracingPromiseAll(items: unknown[]): unknown {
  const lanes = items.map((item) => asHandle(item)).filter((h): h is TraceHandle => !!h)
  if (lanes.length >= 2 && tracing) {
    const out = wrapProxy(
      makeHandle({
        origin: "fork",
        structureName: "ForkProduct",
        isList: false,
        forkLanes: lanes,
        note: "Independent extracts on the same input.",
        label: "Fork",
      }),
    )
    ops.push({ type: "fork", lanes, out })
    return lanes.map((lane) => wrapProxy(lane))
  }
  return items
}

function withArrayHooks<T>(fn: () => T): T {
  const origPush = Array.prototype.push
  const origFlatMap = Array.prototype.flatMap
  Array.prototype.push = function pushTrace(...args: unknown[]) {
    if (args.some(isHandle) || isTraceArray(this)) markTraceArray(this)
    return origPush.apply(this, args as never[])
  }
  Array.prototype.flatMap = function flatMapTrace<U>(
    this: unknown[],
    cb: (value: unknown, index: number, array: unknown[]) => U,
  ): U[] {
    if (isTraceArray(this) || this.some?.(isHandle)) {
      const input = asHandle(this[0]) ?? currentSpine()
      const out = wrapProxy(
        makeHandle({
          origin: "step",
          structureName: "Row",
          isList: true,
          label: "Flatten",
          note: "Flatten nested rows.",
          code: `(rows) => rows.flatMap(${cb.toString()})`,
          input,
        }),
      )
      ops.push({ type: "flatMap", code: cb.toString(), input: input ?? out, out })
      return out as unknown as U[]
    }
    return origFlatMap.call(this, cb as never) as U[]
  } as typeof origFlatMap
  try {
    return fn()
  } finally {
    Array.prototype.push = origPush
    Array.prototype.flatMap = origFlatMap
  }
}

function schemaForHandle(handle: TraceHandle | undefined, fallback: string): ZodType {
  if (handle?.schema) {
    const ref = structureRefFromZod(handle.schema, fallback)
    return handle.isList && !ref.isList ? z.array(handle.schema) : handle.schema
  }
  if (handle?.structureName === "Document" || !handle) {
    return handle?.isList ? z.array(Document) : Document
  }
  const named = model(handle.structureName, { value: z.string().optional() })
  return handle.isList ? z.array(named) : named
}

function inNameFor(handle: TraceHandle | undefined): string | undefined {
  if (!handle) return undefined
  return handle.loopOf ? handle.structureName : handle.structureName
}

function isBatchInput(handle: TraceHandle | undefined): boolean {
  if (!handle) return false
  if (handle.loopOf) return true
  if (handle.iterated) return true
  return false
}

function lowerToProgram(result: unknown): SpineProgram {
  const steps: StepHandle[] = []
  const p1 = params[1]
  const p0 = params[0]
  const p1IsLlmPrimary = !!p1 && ops.some((op) => op.type === "task" && op.handle.prompt && sameInput(op.handle.input, p1))
  const p0Processed = !!p0 && ops.some((op) => {
    const input = op.type === "fork" ? op.lanes[0]?.input : op.type === "flatMap" ? op.input : op.handle.input
    return sameInput(input, p0) || input?.loopOf === p0 || input?.paramIndex === p0.paramIndex
  })
  const useCombine = params.length >= 2 && p0Processed && !!p1 && !p1IsLlmPrimary
  const useAssemble = params.length >= 2 && p0Processed && p1IsLlmPrimary
  let combineInserted = false
  let assembleInserted = false
  let assembleSchema: ZodType | undefined
  const emittedParams = new Set<number>()

  const emitInput = (p: TraceHandle | undefined) => {
    if (!p || p.paramIndex == null || emittedParams.has(p.paramIndex)) return
    // AI : combine auto-inserts the raw side file — do not emit it as a sibling input.
    if (useCombine && p.paramIndex === 1) return
    emittedParams.add(p.paramIndex)
    const list = p.iterated || p.isList
    p.isList = list
    steps.push(
      input({
        schema: list ? z.array(Document) : Document,
        note: p.note || (list ? `Upload ${p.name || "files"}.` : `Upload ${p.name || "the document"}.`),
        label: p.label || humanLabel(p.name || "Input"),
        type: "text",
        ...(list ? { inputMinCount: 2 } : {}),
        ...(p.name ? { inputNameContains: p.name } : {}),
      }),
    )
  }

  const ensureInputs = (handle: TraceHandle | undefined, fields?: Record<string, TraceHandle>) => {
    const src = handle?.loopOf ?? handle
    if (src?.paramIndex != null) emitInput(params[src.paramIndex])
    for (const h of Object.values(fields ?? handle?.assembleFields ?? {})) {
      const side = h.loopOf ?? h
      if (side.paramIndex != null) emitInput(params[side.paramIndex])
    }
  }

  emitInput(p0)

  const emitCombine = (state: TraceHandle | undefined) => {
    if (combineInserted || !useCombine) return
    combineInserted = true
    const stateName = state?.structureName || "Document"
    const rows = schemaForHandle(state, stateName)
    const out = model("CombinedInput", {
      side_document: Document,
      rows,
    })
    steps.push(
      combine({
        schema: out,
        in: stateName,
        note: "Merge the side document with parsed state.",
        label: "Combine Inputs",
        type: "text",
        ...(p1?.name ? { inputNameContains: p1.name } : {}),
      }),
    )
  }

  const emitAssemble = (fields: Record<string, TraceHandle> | undefined) => {
    if (assembleInserted || !useAssemble) return
    assembleInserted = true
    const keys = Object.keys(fields ?? { left: p0!, right: p1! })
    const bindings: Record<string, { kind: "spine" } | { kind: "state"; label: string }> = {}
    const shape: Record<string, ZodType> = {}
    keys.forEach((key, i) => {
      const h = fields?.[key]
      bindings[key] = i === keys.length - 1 ? { kind: "spine" } : { kind: "state", label: h?.label || "Link Quotes" }
      if (h) shape[key] = schemaForHandle(h, h.structureName)
    })
    assembleSchema = Object.keys(shape).length ? model("Assembled", shape) : undefined
    steps.push(
      assemble({
        note: "Join the already-parsed outputs.",
        label: "Assemble",
        bindings,
        ...(assembleSchema ? { schema: assembleSchema } : {}),
      }),
    )
  }

  // AI : task() runs while evaluating Promise.all args, so skip those ops — the fork node owns the lanes.
  const forkedIds = new Set(ops.flatMap((op) => (op.type === "fork" ? op.lanes.map((l) => l.id) : [])))
  const usesRawSide = (fields: Record<string, TraceHandle> | undefined): boolean => {
    if (!fields || !p1) return false
    return Object.values(fields).some((h) => sameInput(h, p1) || h.origin === "input")
  }

  for (const op of ops) {
    if (op.type === "fork") {
      ensureInputs(op.lanes[0]?.input)
      const branches = op.lanes.map((lane, i) => ({
        label: lane.label || `Lane ${i + 1}`,
        steps: [
          llm({
            schema: lane.schema ?? schemaForHandle(lane, lane.structureName),
            note: lane.note || `${lane.label || "Extract"}.`,
            prompt: lane.prompt || "Extract the fields.",
            label: lane.label,
            in: inNameFor(lane.input) || "Document",
          }),
        ],
      }))
      steps.push(
        fork({
          note: op.out.note || "Independent extracts on the same input.",
          label: op.out.label || "Fork",
          join: "product",
          branches,
        }),
      )
      continue
    }
    if (op.type === "flatMap") {
      ensureInputs(op.input)
      if (useCombine) emitCombine(op.input)
      steps.push(
        customCode({
          schema: schemaForHandle(op.out, "Row"),
          code: op.out.code || `(rows) => rows.flatMap(${op.code})`,
          note: op.out.note || "Flatten nested rows.",
          label: op.out.label || "Flatten",
          in: inNameFor(op.input),
        }),
      )
      continue
    }
    const handle = op.handle
    if (forkedIds.has(handle.id)) continue
    ensureInputs(handle.input, handle.assembleFields)
    if (handle.assembleFields) {
      if (useCombine && usesRawSide(handle.assembleFields)) emitCombine(currentSpineBefore(handle))
      else if (useAssemble) emitAssemble(handle.assembleFields)
    }
    if (useCombine && p1 && (sameInput(handle.input, p1) || (handle.code && handle.input && handle.input !== p0))) {
      emitCombine(currentSpineBefore(handle))
    }
    if (op.type === "step" || (op.type === "task" && !handle.prompt)) {
      if (useCombine && !combineInserted && handle.input && handle.input.paramIndex === 1) emitCombine(handle.input)
      steps.push(
        customCode({
          schema: schemaForHandle(handle, handle.structureName),
          code: handle.code || "(input) => input",
          note: handle.note || `${handle.label || "Transform"}.`,
          label: handle.label || "Transform",
          in: inNameFor(handle.input),
        }),
      )
      continue
    }
    if (handle.prompt && handle.schema) {
      const batch = isBatchInput(handle.input)
      const inputIsForkLane = handle.input ? forkedIds.has(handle.input.id) : false
      const args = {
        schema: handle.schema,
        note: handle.note || `${handle.label || "Extract"}.`,
        prompt: handle.prompt,
        label: handle.label,
        ...(inputIsForkLane ? {} : { in: inNameFor(handle.input) }),
      }
      steps.push(batch ? llmBatch(args) : llm(args))
    }
  }

  if (useAssemble) emitAssemble(handlesInObject(result))

  const outHandle = asHandle(result) ?? (Array.isArray(result) ? asHandle(result[0]) : undefined) ?? currentSpine()
  steps.push(
    output({
      schema: assembleSchema ?? schemaForHandle(outHandle, outHandle?.structureName || "Out"),
      label: "Output",
      in: assembleSchema ? "Assembled" : outHandle && !outHandle.isList ? outHandle.structureName : outHandle?.structureName,
    }),
  )
  return pipeline(...steps)
}

function currentSpineBefore(handle: TraceHandle): TraceHandle | undefined {
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i]!
    if (op.type === "task" && op.handle.id === handle.id) {
      const prev = ops[i - 1]
      if (!prev) return params[0]
      if (prev.type === "fork") return prev.out
      if (prev.type === "flatMap") return prev.out
      return prev.handle
    }
  }
  return params[0]
}

export type WorkflowFn = (...args: never[]) => unknown

export function workflow<I extends unknown[], O>(fn: (...args: I) => O): SpineProgram {
  tracing = true
  params = []
  ops = []
  currentGenerate = undefined
  const names = paramNames(fn as (...args: never[]) => unknown)
  const arity = Math.max(fn.length, names.length)
  const args = Array.from({ length: arity }, (_, i) => {
    const name = names[i] || `input${i || ""}`
    const list = guessListParam(name, arity)
    const handle = makeHandle({
      origin: "input",
      structureName: "Document",
      isList: list,
      name,
      label: humanLabel(name),
      paramIndex: i,
      note: list ? `Upload ${name}.` : `Upload ${name}.`,
    })
    params.push(handle)
    return wrapProxy(handle)
  })
  let result: unknown
  try {
    result = withArrayHooks(() => fn(...(args as I)))
  } finally {
    tracing = false
  }
  // AI : #39 authored input()/llmBatch() inside workflow(); #41 traces generateObject.
  // Prefer the explicit step-helper program when generateObject was not used.
  const usedGenerateObject = ops.some((op) => op.type === "task" && Boolean(op.handle.prompt))
  const captured = takeLastSpineProgram()
  if (!usedGenerateObject && captured?.modules.length) {
    lastWorkflowProgram = captured
    return captured
  }
  lastWorkflowProgram = lowerToProgram(result)
  return lastWorkflowProgram
}

export function stripAsyncAwait(source: string): string {
  return source
    .replace(/\basync\s+function\b/g, "function")
    .replace(/\basync\s*\(/g, "(")
    .replace(/\basync\s+/g, "")
    .replace(/\bawait\s+/g, "")
}
