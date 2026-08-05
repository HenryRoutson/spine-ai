import type { CodeLineProfile } from "@/lib/code-exec-ui"

export type CodeTraceEvent = {
  line: number
  slot?: number
  phase: "enter" | "leave" | "done"
  activeLine?: number
  activeSlot?: number
  lineMs: CodeLineProfile
  msSinceStart: number
}

export type ForgeTraceFn = ((line: number, slot?: number) => Promise<void>) & {
  finish: () => CodeLineProfile
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

type SlotRef = { n: number }

// AI : inject await __forgeTrace(line[, slot]) inside async bodies — never before a top-level `(…) =>` expression.
export function instrumentCodeLines(code: string): string {
  const preambleArrow = splitPreambleArrow(code)
  if (preambleArrow) {
    const { preamble, arrow } = preambleArrow
    const instPreamble = instrumentStatementLines(preamble)
    const instArrow = instrumentExpressionArrow(arrow)
    const joiner = preamble.length > 0 && !preamble.endsWith("\n") ? "\n" : ""
    return instPreamble + joiner + instArrow
  }
  if (isExpressionForm(code)) return instrumentExpressionArrow(code)
  return instrumentStatementLines(code)
}

function isExpressionForm(code: string): boolean {
  return /^\s*(\(|async\s+\(|function\b)/.test(code.trim())
}

function splitPreambleArrow(code: string): { preamble: string; arrow: string } | null {
  const trimmed = code.trim()
  const m = trimmed.match(/[;\n]\s*(\([^)]*\)\s*=>[\s\S]+)$/)
  if (!m?.[1]) return null
  const arrow = m[1]
  const idx = code.lastIndexOf(arrow)
  if (idx < 0) return null
  return { preamble: code.slice(0, idx), arrow: code.slice(idx) }
}

function splitSourceLines(code: string): string[] {
  const lines: string[] = []
  let cur = ""
  let i = 0
  while (i < code.length) {
    const skip = skipNonCode(code, i)
    if (skip > i) {
      cur += code.slice(i, skip)
      i = skip
      continue
    }
    const ch = code[i]!
    if (ch === "\n") {
      lines.push(cur)
      cur = ""
      i++
      continue
    }
    cur += ch
    i++
  }
  if (cur.length > 0 || code.endsWith("\n")) lines.push(cur)
  return lines
}

function instrumentStatementLines(code: string): string {
  return splitSourceLines(code)
    .map((line, i) => instrumentExecutableLine(line, i + 1))
    .join("\n")
}

function instrumentExpressionArrow(code: string): string {
  const lines = splitSourceLines(code)
  const blockOpenIdx = lines.findIndex((l) => /=>\s*\{/.test(l))
  if (blockOpenIdx < 0) {
    const joined = lines.join("\n")
    return instrumentExprArrowLine(joined, 1)
  }

  let depth = 0
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1
    const line = lines[i]!
    if (i < blockOpenIdx) {
      out.push(instrumentExecutableLine(line, lineNo))
      continue
    }
    if (i === blockOpenIdx) {
      const opened = openExprArrowBlock(line, lineNo)
      depth += braceDelta(opened)
      out.push(opened)
      continue
    }
    depth += braceDelta(line)
    if (depth <= 0) {
      out.push(line)
      continue
    }
    out.push(instrumentExecutableLine(line, lineNo))
  }
  return out.join("\n")
}

function openExprArrowBlock(line: string, lineNo: number): string {
  const m = line.match(/^(\s*)(async\s+)?(\([^)]*\)|[\w$]+)\s*=>\s*\{(.*)$/)
  if (!m) return instrumentExecutableLine(line, lineNo)
  const indent = m[1] ?? ""
  const asyncKw = m[2] ?? ""
  const params = m[3] ?? ""
  const rest = m[4] ?? ""
  const tracedRest = rest ? instrumentInlineLambdas(rest, lineNo) : ""
  return `${indent}${asyncKw || "async "}${params} => { await __forgeTrace(${lineNo}); ${tracedRest}`
}

function instrumentExprArrowLine(line: string, lineNo: number): string {
  const arrow = findTopLevelArrow(line)
  if (!arrow) return instrumentExecutableLine(line, lineNo)
  const { paramsStart, bodyStart, bodyEnd, isBlock, hasAsync } = arrow
  const prefix = line.slice(0, paramsStart)
  const params = line.slice(paramsStart, arrowIdxOf(line, paramsStart)).trim()
  const asyncKw = hasAsync ? "" : "async "
  const trace = `await __forgeTrace(${lineNo}); `
  if (isBlock) {
    const body = line.slice(bodyStart, bodyEnd)
    const innerStart = body.indexOf("{") + 1
    const innerEnd = body.lastIndexOf("}")
    const inner = body.slice(innerStart, innerEnd)
    const close = body.slice(innerEnd)
    return `${prefix}${asyncKw}${params} => { ${trace}${instrumentInlineLambdas(inner, lineNo)}${close}`
  }
  const body = line.slice(bodyStart, bodyEnd)
  const wrapped = instrumentInlineLambdas(body, lineNo)
  const suffix = line.slice(bodyEnd)
  return `${prefix}${asyncKw}${params} => { ${trace}return (${wrapped}); }${suffix}`
}

function arrowIdxOf(line: string, from: number): number {
  const idx = line.indexOf("=>", from)
  return idx < 0 ? line.length : idx
}

function instrumentExecutableLine(line: string, lineNo: number): string {
  if (!line.trim()) return line
  if (/^\s*(\/\/|#)/.test(line)) return line
  const indent = line.match(/^\s*/)?.[0] ?? ""
  const traced = instrumentInlineLambdas(line.trimStart(), lineNo)
  return `${indent}await __forgeTrace(${lineNo}); ${traced}`
}

function instrumentInlineLambdas(src: string, lineNo: number, slotRef: SlotRef = { n: 0 }): string {
  let result = src
  let searchFrom = 0
  while (searchFrom < result.length) {
    let eq = -1
    for (let j = searchFrom; j < result.length - 1; j++) {
      const skip = skipNonCode(result, j)
      if (skip > j) {
        j = skip - 1
        continue
      }
      if (result[j] === "=" && result[j + 1] === ">" && result[j + 2] !== "=") {
        eq = j
        break
      }
    }
    if (eq < 0) break
    const arrow = tryParseArrow(result, eq)
    if (!arrow) {
      searchFrom = eq + 2
      continue
    }
    const slot = ++slotRef.n
    const { paramsStart, bodyStart, bodyEnd, isBlock, hasAsync } = arrow
    const params = result.slice(paramsStart, eq).trim()
    const asyncKw = hasAsync ? "" : "async "
    const trace = `await __forgeTrace(${lineNo}, ${slot}); `
    let replacement: string
    if (isBlock) {
      const body = result.slice(bodyStart, bodyEnd)
      const innerStart = body.indexOf("{") + 1
      const innerEnd = body.lastIndexOf("}")
      const inner = body.slice(innerStart, innerEnd)
      const close = body.slice(innerEnd)
      replacement = `${asyncKw}${params} => { ${trace}${instrumentInlineLambdas(inner, lineNo, slotRef)}${close}`
    } else {
      const body = result.slice(bodyStart, bodyEnd)
      const inner = instrumentInlineLambdas(body, lineNo, slotRef)
      replacement = `${asyncKw}${params} => { ${trace}return (${inner}); }`
    }
    result = result.slice(0, paramsStart) + replacement + result.slice(bodyEnd)
    searchFrom = paramsStart + replacement.length
  }
  return result
}

function findTopLevelArrow(line: string): ReturnType<typeof tryParseArrow> {
  let i = 0
  while (i < line.length) {
    const skip = skipNonCode(line, i)
    if (skip > i) {
      i = skip
      continue
    }
    if (line[i] === "=" && line[i + 1] === ">") {
      const arrow = tryParseArrow(line, i)
      if (arrow) return arrow
    }
    i++
  }
  return null
}

type ParsedArrow = {
  paramsStart: number
  bodyStart: number
  bodyEnd: number
  isBlock: boolean
  hasAsync: boolean
}

function tryParseArrow(src: string, at: number): ParsedArrow | null {
  if (src[at] !== "=" || src[at + 1] !== ">") return null
  if (src[at + 2] === "=") return null
  let i = at - 1
  while (i >= 0 && /\s/.test(src[i]!)) i--
  if (i < 0) return null

  let hasAsync = false
  const asyncPrefix = src.slice(Math.max(0, i - 4), i + 1)
  if (asyncPrefix === "async" || asyncPrefix.endsWith("async")) {
    hasAsync = /\basync$/.test(src.slice(0, i + 1).trimEnd())
    if (hasAsync) {
      i -= 4
      while (i >= 0 && /\s/.test(src[i]!)) i--
      if (i < 0) return null
    }
  }

  let paramsStart: number
  if (src[i] === ")") {
    let depth = 1
    i--
    while (i >= 0 && depth > 0) {
      const skip = skipNonCodeBackward(src, i)
      if (skip < i) {
        i = skip
        continue
      }
      if (src[i] === ")") depth++
      else if (src[i] === "(") depth--
      i--
    }
    paramsStart = i + 1
  } else {
    while (i >= 0 && /[\w$]/.test(src[i]!)) i--
    paramsStart = i + 1
  }

  let bodyStart = at + 2
  while (bodyStart < src.length && /\s/.test(src[bodyStart]!)) bodyStart++
  if (bodyStart >= src.length) return null

  if (src[bodyStart] === "{") {
    const end = scanBalanced(src, bodyStart, "{", "}")
    if (end < 0) return null
    return { paramsStart, bodyStart, bodyEnd: end + 1, isBlock: true, hasAsync }
  }

  const end = scanExprEnd(src, bodyStart)
  return { paramsStart, bodyStart, bodyEnd: end, isBlock: false, hasAsync }
}

function braceDelta(line: string): number {
  let delta = 0
  let i = 0
  while (i < line.length) {
    i = skipNonCode(line, i)
    if (i >= line.length) break
    const ch = line[i]!
    if (ch === "{") delta++
    else if (ch === "}") delta--
    i++
  }
  return delta
}

function skipNonCode(src: string, i: number): number {
  const ch = src[i]
  if (ch === "/" && src[i + 1] === "/") return src.length
  if (ch === "/" && src[i + 1] === "*") {
    const end = src.indexOf("*/", i + 2)
    return end < 0 ? src.length : end + 2
  }
  if (ch === "'" || ch === '"') return scanString(src, i, ch)
  if (ch === "`") return scanTemplate(src, i)
  return i
}

function skipNonCodeBackward(src: string, i: number): number {
  if (src[i] === "/" && src[i - 1] === "/") {
    let j = i - 2
    while (j >= 0 && src[j] !== "\n") j--
    return j
  }
  return i
}

function scanString(src: string, i: number, quote: string): number {
  let j = i + 1
  while (j < src.length) {
    if (src[j] === "\\") {
      j += 2
      continue
    }
    if (src[j] === quote) return j + 1
    j++
  }
  return src.length
}

function scanTemplate(src: string, i: number): number {
  let j = i + 1
  while (j < src.length) {
    if (src[j] === "\\") {
      j += 2
      continue
    }
    if (src[j] === "`") return j + 1
    if (src[j] === "$" && src[j + 1] === "{") {
      j = scanBalanced(src, j + 1, "{", "}") + 1
      continue
    }
    j++
  }
  return src.length
}

function scanBalanced(src: string, openIdx: number, open: string, close: string): number {
  let depth = 0
  let i = openIdx
  while (i < src.length) {
    const skip = skipNonCode(src, i)
    if (skip > i) {
      i = skip
      continue
    }
    if (src[i] === open) depth++
    else if (src[i] === close) {
      depth--
      if (depth === 0) return i
    }
    i++
  }
  return -1
}

function scanExprEnd(src: string, start: number): number {
  let paren = 0
  let brace = 0
  let bracket = 0
  let i = start
  while (i < src.length) {
    const skip = skipNonCode(src, i)
    if (skip > i) {
      i = skip
      continue
    }
    const ch = src[i]!
    if (ch === "(") paren++
    else if (ch === ")") {
      if (paren === 0 && brace === 0 && bracket === 0) return i
      paren--
    } else if (ch === "{") brace++
    else if (ch === "}") {
      if (brace === 0) return i
      brace--
    } else if (ch === "[") bracket++
    else if (ch === "]") bracket--
    else if (ch === "," && paren === 0 && brace === 0 && bracket === 0) return i
    else if (ch === ";" && paren === 0 && brace === 0 && bracket === 0) return i
    i++
  }
  return i
}

export function makeAsyncFunctionSource(src: string): string {
  const t = src.trim()
  if (/^(\(+)\s*async\s+\(/.test(t)) return src
  return src.replace(/^(\(+)([^)]*)\)\s*=>/, (_m, opens: string, params: string) => {
    if (opens.length === 1) return `(async (${params}) =>`
    return `${opens.slice(0, -1)}async (${params}) =>`
  })
}

export function createForgeTrace(onTrace: (e: CodeTraceEvent) => void): ForgeTraceFn {
  const lineMs: CodeLineProfile = {}
  let lastKey = ""
  let lastEnter = 0
  const start = performance.now()

  const emit = (
    line: number,
    phase: CodeTraceEvent["phase"],
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

  const trace = async (line: number, slot = 0) => {
    const key = codeProfileKey(line, slot)
    const now = performance.now()
    if (lastKey) {
      lineMs[lastKey] = (lineMs[lastKey] ?? 0) + (now - lastEnter)
      const prev = parseCodeProfileKey(lastKey)
      emit(prev.line, "leave", prev.slot, line, slot > 0 ? slot : undefined)
    }
    lastKey = key
    lastEnter = now
    emit(line, "enter", slot, line, slot > 0 ? slot : undefined)
    await new Promise<void>((r) => setTimeout(r, 0))
  }

  trace.finish = () => {
    const now = performance.now()
    if (lastKey) lineMs[lastKey] = (lineMs[lastKey] ?? 0) + (now - lastEnter)
    if (lastKey) {
      const { line, slot } = parseCodeProfileKey(lastKey)
      emit(line, "done", slot, undefined, undefined)
    }
    return { ...lineMs }
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
