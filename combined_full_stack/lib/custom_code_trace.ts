import type { CodeLineProfile } from "@/lib/code-exec-ui"
import { instrumentArrowSourceAst, instrumentCodeLinesAst, type InstrumentCodeOpts } from "@/lib/custom_code_trace_ast"

export type { InstrumentCodeOpts } from "@/lib/custom_code_trace_ast"

// AI : line-enter / leave / finish phases for custom-code visual profiling.
export enum CodeTracePhase {
  Enter = "enter",
  Leave = "leave",
  Done = "done",
}

export type CodeTraceEvent = {
  line: number
  slot?: number
  phase: CodeTracePhase
  activeLine?: number
  activeSlot?: number
  lineMs: CodeLineProfile
  msSinceStart: number
}

export type ForgeTraceFinish = {
  lineMs: CodeLineProfile
  lastLine?: number
  lastSlot?: number
}

export type ForgeTraceFn = ((line: number, slot?: number) => void | Promise<void>) & {
  finish: () => ForgeTraceFinish
}

// AI : profile keys are source line ("3") or lambda slot ("3.1") for inline arrows on that line.
export function codeProfileKey(line: number, slot = 0): string {
  return slot > 0 ? `${line}.${slot}` : String(line)
}

export function parseCodeProfileKey(key: string): { line: number; slot: number } {
  const dot = key.indexOf(".")
  if (dot < 0) return { line: Number(key), slot: 0 }
  return { line: Number(key.slice(0, dot)), slot: Number(key.slice(dot + 1)) }
}

export type ProfileSlot = { slot: number; ms: number }

export function groupProfileSlotsByLine(lineMs?: CodeLineProfile): Map<number, ProfileSlot[]> {
  const slotsByLine = new Map<number, ProfileSlot[]>()
  for (const [key, ms] of Object.entries(lineMs ?? {})) {
    const { line, slot } = parseCodeProfileKey(key)
    if (slot <= 0) continue
    const list = slotsByLine.get(line) ?? []
    list.push({ slot, ms })
    slotsByLine.set(line, list)
  }
  for (const list of slotsByLine.values()) list.sort((a, b) => a.slot - b.slot)
  return slotsByLine
}

// AI : acorn AST inject — falls back to raw code if parse fails (syntax check runs separately).
export function instrumentCodeLines(code: string, opts: InstrumentCodeOpts = {}): string {
  try {
    return instrumentCodeLinesAst(code, opts)
  } catch {
    return code
  }
}

// AI : preamble+arrow codegen — avoid wrapping the arrow in extra parens before rejoin.
export function instrumentArrowSource(code: string, opts: InstrumentCodeOpts = {}): string {
  try {
    return instrumentArrowSourceAst(code, opts)
  } catch {
    return code
  }
}

function splitSourceLines(code: string): string[] {
  return code.split("\n")
}

export function makeAsyncFunctionSource(src: string): string {
  const t = src.trim()
  if (/^(\(+)\s*async\s+\(/.test(t)) return src
  return src.replace(/^(\(+)([^)]*)\)\s*=>/, (_m, opens: string, params: string) => {
    if (opens.length === 1) return `(async (${params}) =>`
    return `${opens.slice(0, -1)}async (${params}) =>`
  })
}

export function createForgeTrace(
  onTrace: (e: CodeTraceEvent) => void,
  paint?: () => Promise<void>,
): ForgeTraceFn {
  const lineMs: CodeLineProfile = {}
  let lastKey = ""
  let lastEnter = 0
  const start = performance.now()

  const emit = (
    line: number,
    phase: CodeTracePhase,
    slot: number,
    activeLine?: number,
    activeSlot?: number,
  ) => {
    onTrace({
      line,
      slot: slot > 0 ? slot : undefined,
      phase,
      activeLine,
      activeSlot,
      lineMs: { ...lineMs },
      msSinceStart: performance.now() - start,
    })
  }

  const trace = (line: number, slot = 0): void | Promise<void> => {
    const key = codeProfileKey(line, slot)
    const now = performance.now()
    if (lastKey) {
      lineMs[lastKey] = (lineMs[lastKey] ?? 0) + (now - lastEnter)
      const prev = parseCodeProfileKey(lastKey)
      emit(prev.line, CodeTracePhase.Leave, prev.slot, line, slot > 0 ? slot : undefined)
    }
    lastKey = key
    lastEnter = now
    emit(line, CodeTracePhase.Enter, slot, line, slot > 0 ? slot : undefined)
    if (paint) return paint()
  }

  trace.finish = (): ForgeTraceFinish => {
    const now = performance.now()
    if (lastKey) lineMs[lastKey] = (lineMs[lastKey] ?? 0) + (now - lastEnter)
    let lastLine: number | undefined
    let lastSlot: number | undefined
    if (lastKey) {
      const parsed = parseCodeProfileKey(lastKey)
      lastLine = parsed.line
      lastSlot = parsed.slot > 0 ? parsed.slot : undefined
      emit(parsed.line, CodeTracePhase.Done, parsed.slot, undefined, undefined)
    }
    return { lineMs: { ...lineMs }, lastLine, lastSlot }
  }

  return trace
}

export function formatLineProfileLog(code: string, lineMs: CodeLineProfile): string {
  const lines = splitSourceLines(code)
  const ranked = Object.entries(lineMs)
    .map(([key, ms]) => ({ ...parseCodeProfileKey(key), ms, key }))
    .filter((r) => r.ms > 0)
    .sort((a, b) => b.ms - a.ms)
  if (!ranked.length) return "line profile: (no measurable lines)"
  const parts = ["line profile (ms, slowest first):"]
  for (const { line, slot, ms } of ranked) {
    const text = (lines[line - 1] ?? "").trim()
    const label = slot > 0 ? `L${String(line).padStart(3)}.${slot}` : `L${String(line).padStart(3)}`
    const hint = slot > 0 ? "λ " : ""
    parts.push(`  ${label} ${ms.toFixed(1).padStart(7)}ms  ${hint}${text.slice(0, slot > 0 ? 88 : 96)}`)
  }
  return parts.join("\n")
}
