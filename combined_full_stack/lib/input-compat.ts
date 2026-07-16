import { docsForInputModule, type InputDocsAssignment } from "@/lib/inference-input-core"
import type {
  DocRef,
  InputCompatCompare,
  InputCompatExtractor,
  InputCompatKey,
  InputCompatNormalize,
  InputCompatWith,
  ModuleId,
  PipelineModule,
} from "@/lib/types"

export type InputCompatKeyStatus = "match" | "mismatch" | "missing"

export type InputCompatKeyResult = {
  label: string
  status: InputCompatKeyStatus
  upstreamValue?: string
  localValue?: string
}

export type InputCompatPairResult = {
  kind: "input-compat"
  localModuleId: ModuleId
  upstreamModuleId: ModuleId
  upstreamLabel: string
  localLabel: string
  localDocName?: string
  keys: InputCompatKeyResult[]
}

type compat_scalar = string
type compat_set = string[]

function compatNormalize(extractor: InputCompatExtractor): InputCompatNormalize | undefined {
  if (extractor.kind === "question-ids-text") return "question-id-set"
  return extractor.normalize
}

function normalizeScalar(value: string, normalize?: InputCompatNormalize): compat_scalar {
  const s = value.trim()
  if (normalize === "lower-trim") return s.toLowerCase()
  if (normalize === "question-id") return s.trim().toUpperCase()
  return s
}

function normalizeSet(values: string[], normalize?: InputCompatNormalize): compat_set {
  const mapped = values.map((v) => normalizeScalar(v, normalize)).filter(Boolean)
  if (normalize === "question-id-set") {
    return [...new Set(mapped.map((v) => v.toUpperCase()))].sort()
  }
  return [...new Set(mapped)].sort()
}

function parseJsonContent(content: string): unknown | null {
  try {
    return JSON.parse(content) as unknown
  } catch {
    return null
  }
}

// AI : json-path — dot segments; [] collects from every array element at that key.
function extractJsonPath(root: unknown, path: string): string[] {
  if (!path.trim()) return []
  const segments = path.split(".").filter(Boolean)
  let nodes: unknown[] = [root]
  for (const segment of segments) {
    const isArray = segment.endsWith("[]")
    const key = isArray ? segment.slice(0, -2) : segment
    const next: unknown[] = []
    for (const node of nodes) {
      if (node == null || typeof node !== "object") continue
      if (Array.isArray(node)) {
        for (const row of node) {
          if (row != null && typeof row === "object" && key in (row as object)) {
            next.push((row as Record<string, unknown>)[key])
          }
        }
        continue
      }
      const obj = node as Record<string, unknown>
      if (!(key in obj)) continue
      const val = obj[key]
      if (isArray) {
        if (Array.isArray(val)) next.push(...val)
      } else {
        next.push(val)
      }
    }
    nodes = next
  }
  return nodes
    .flatMap((v) => {
      if (v == null) return []
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return [String(v)]
      return []
    })
    .filter(Boolean)
}

function extractQuestionIdsFromText(content: string): string[] {
  const out: string[] = []
  const re = /\*\*([Qq]\d+)\.\*\*/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    out.push(m[1]!.toUpperCase())
  }
  return out
}

function extractCompatValues(
  content: string,
  extractor: InputCompatExtractor,
): string[] | null {
  if (extractor.kind === "json-path") {
    const parsed = parseJsonContent(content)
    if (parsed == null) return null
    return extractJsonPath(parsed, extractor.path)
  }
  if (extractor.kind === "text-regex") {
    const flags = extractor.flags ?? "m"
    const re = new RegExp(extractor.pattern, flags)
    const m = content.match(re)
    if (!m) return []
    const group = extractor.group ?? 0
    const raw = m[group]
    return raw != null ? [raw] : []
  }
  if (extractor.kind === "question-ids-text") {
    return extractQuestionIdsFromText(content)
  }
  return null
}

function compareExtracted(
  upstream: string[],
  local: string[],
  compare: InputCompatCompare,
  upstreamNorm: InputCompatExtractor,
  localNorm: InputCompatExtractor,
): InputCompatKeyStatus {
  if (!upstream.length || !local.length) return "missing"
  if (compare === "set-equal") {
    const a = normalizeSet(upstream, compatNormalize(upstreamNorm))
    const b = normalizeSet(local, compatNormalize(localNorm))
    return a.length === b.length && a.every((v, i) => v === b[i]) ? "match" : "mismatch"
  }
  const a = normalizeScalar(upstream[0]!, compatNormalize(upstreamNorm))
  const b = normalizeScalar(local[0]!, compatNormalize(localNorm))
  return a === b ? "match" : "mismatch"
}

function formatCompatValue(values: string[], extractor: InputCompatExtractor): string {
  const norm = compatNormalize(extractor)
  if (extractor.kind === "question-ids-text" || norm === "question-id-set") {
    return normalizeSet(values, norm).join(", ") || "—"
  }
  return values[0] != null ? normalizeScalar(values[0], norm) : "—"
}

export function evaluateCompatKey(
  upstreamContent: string,
  localContent: string,
  key: InputCompatKey,
): InputCompatKeyResult {
  const upstreamVals = extractCompatValues(upstreamContent, key.upstream)
  const localVals = extractCompatValues(localContent, key.local)
  const compare = key.compare ?? "equal"
  const status =
    upstreamVals == null || localVals == null
      ? "missing"
      : compareExtracted(upstreamVals, localVals, compare, key.upstream, key.local)
  return {
    label: key.label,
    status,
    upstreamValue: upstreamVals ? formatCompatValue(upstreamVals, key.upstream) : undefined,
    localValue: localVals ? formatCompatValue(localVals, key.local) : undefined,
  }
}

function upstreamDocForRule(
  assignment: InputDocsAssignment,
  rule: InputCompatWith,
): DocRef | undefined {
  const docs = docsForInputModule(assignment, rule.moduleId)
  return docs[0]
}

export function inputModulesWithCompat(inputModules: PipelineModule[]): PipelineModule[] {
  return inputModules.filter((m) => m.inputCompatWith?.keys?.length)
}

export function evaluateInputCompat(
  inputModules: PipelineModule[],
  assignment: InputDocsAssignment,
  contentByDocId: Partial<Record<string, string>>,
): InputCompatPairResult[] {
  const byId = new Map(inputModules.map((m) => [m.id, m]))
  const results: InputCompatPairResult[] = []

  for (const localModule of inputModulesWithCompat(inputModules)) {
    const rule = localModule.inputCompatWith!
    const upstreamModule = byId.get(rule.moduleId)
    if (!upstreamModule) continue
    const upstreamDoc = upstreamDocForRule(assignment, rule)
    if (!upstreamDoc) continue
    const upstreamContent = contentByDocId[upstreamDoc.id]
    if (upstreamContent === undefined) continue

    const localDocs = docsForInputModule(assignment, localModule.id)
    if (!localDocs.length) continue

    for (const localDoc of localDocs) {
      const localContent = contentByDocId[localDoc.id]
      if (localContent === undefined) continue
      const keys = rule.keys.map((key) => evaluateCompatKey(upstreamContent, localContent, key))
      if (!keys.length) continue
      results.push({
        kind: "input-compat",
        localModuleId: localModule.id,
        upstreamModuleId: upstreamModule.id,
        upstreamLabel: upstreamModule.label,
        localLabel: localModule.label,
        localDocName: localDocs.length > 1 ? localDoc.name : undefined,
        keys,
      })
    }
  }

  return results
}

export function inputCompatHasMismatch(pairs: InputCompatPairResult[]): boolean {
  return pairs.some((p) => p.keys.some((k) => k.status !== "match"))
}

export function inputCompatSummary(pairs: InputCompatPairResult[]): string {
  const mismatches = pairs.flatMap((p) =>
    p.keys
      .filter((k) => k.status !== "match")
      .map((k) => {
        const where = p.localDocName ? `${p.localDocName} · ` : ""
        return `${where}${k.label}: ${k.status.toUpperCase()}`
      }),
  )
  if (!mismatches.length) return ""
  return mismatches[0] ?? ""
}

export function inputCompatPairLabel(pair: InputCompatPairResult): string {
  const doc = pair.localDocName ? ` · ${pair.localDocName}` : ""
  return `${pair.upstreamLabel} ↔ ${pair.localLabel}${doc}`
}

// AI : optional picker hint — when upstream is known, hide docs that would fail the first compat key.
export function docFailsCompatPreview(
  upstreamContent: string,
  localContent: string,
  rule: InputCompatWith,
): boolean {
  const firstKey = rule.keys[0]
  if (!firstKey) return false
  const result = evaluateCompatKey(upstreamContent, localContent, firstKey)
  return result.status !== "match"
}
