// AI : few-shot Example 1–5 as a catalog — seed + A/B score the same payloads the JSON prompt already teaches.
import { buildFewShotPromptBlock } from "./assistant-prompt"
import { vibeJsAuthoringEnabled } from "./vibe-coding-mode"
import { payloadToWorkflow } from "@/lib/spine-js/payload-to-workflow"

export type VibeExampleTopology = "batch-map" | "explode" | "split-join" | "combine" | "assemble" | "fork"

export type VibeExamplePayload = {
  message: string
  modules: unknown[]
  modulePatch: null
  models: unknown[]
  typeAliases: null
  docs: Array<{ name: string; type: string; content: string; label?: string }> | null
  documentationUpdate: string | null
  projectNameUpdate: string | null
  targetFunctionName: string | null
  proposedActions: null
}

export type VibeExampleTask = {
  id: string
  title: string
  prompt: string
  topology: VibeExampleTopology
  expectDocs: boolean
  payload: VibeExamplePayload
}

const TOPOLOGY_BY_ID: Record<string, VibeExampleTopology> = {
  ex1: "batch-map",
  ex1b: "batch-map",
  ex1c: "explode",
  ex2: "split-join",
  ex3: "combine",
  ex4: "assemble",
  ex5: "fork",
}

function parseBalancedJson(text: string, start: number): unknown | null {
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!
    if (inString) {
      if (escape) escape = false
      else if (ch === "\\") escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{" || ch === "[") depth++
    else if (ch === "}" || ch === "]") {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as unknown
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function asPayload(raw: Record<string, unknown>): VibeExamplePayload {
  const docs = Array.isArray(raw.docs) ? (raw.docs as VibeExamplePayload["docs"]) : null
  return {
    message: typeof raw.message === "string" ? raw.message : "I'll add this pipeline.",
    modules: Array.isArray(raw.modules) ? raw.modules : [],
    modulePatch: null,
    models: Array.isArray(raw.models) ? raw.models : [],
    typeAliases: null,
    docs,
    documentationUpdate: typeof raw.documentationUpdate === "string" ? raw.documentationUpdate : null,
    projectNameUpdate: typeof raw.projectNameUpdate === "string" ? raw.projectNameUpdate : null,
    targetFunctionName: typeof raw.targetFunctionName === "string" ? raw.targetFunctionName : null,
    proposedActions: null,
  }
}

export function parseFewShotVibeExamples(): VibeExampleTask[] {
  const block = buildFewShotPromptBlock()
  const chunks = block.split(/^Example /m).slice(1)
  const out: VibeExampleTask[] = []
  for (const chunk of chunks) {
    const header = chunk.match(/^(\S+)\s+—\s+([^\n]+)/)
    if (!header) continue
    const id = `ex${header[1]}`
    const title = header[2]!.trim()
    const task = chunk.match(/Task:\s*"([^"]+)"/)
    if (!task?.[1]) continue
    let payload: VibeExamplePayload | null = null
    let brace = chunk.indexOf("{")
    while (brace >= 0) {
      const parsed = parseBalancedJson(chunk, brace)
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        Array.isArray((parsed as { modules?: unknown }).modules)
      ) {
        payload = asPayload(parsed as Record<string, unknown>)
        break
      }
      brace = chunk.indexOf("{", brace + 1)
    }
    if (!payload?.modules.length) continue
    out.push({
      id,
      title,
      prompt: task[1],
      topology: TOPOLOGY_BY_ID[id] ?? "batch-map",
      expectDocs: (payload.docs?.length ?? 0) > 0,
      payload,
    })
  }
  return out
}

let cached: VibeExampleTask[] | null = null

export function vibeExampleTasks(): VibeExampleTask[] {
  cached ??= parseFewShotVibeExamples()
  return cached
}

// AI : catalog lookup for scoring A/B topology — never use this in seed LLM replies.
// AI : Pasting ex.payload because the task string matched is reward hacking (100% without generating).
export function matchVibeExample(text: string): VibeExampleTask | null {
  const src = text.trim()
  if (!src) return null
  for (const ex of vibeExampleTasks()) {
    if (src.includes(ex.prompt)) return ex
  }
  return null
}

const TOPOLOGY_HINTS: Record<VibeExampleTopology, string[]> = {
  "batch-map": ["receipt", "excel", "spreadsheet", "hundreds", "vendor", "files"],
  explode: ["action", "several", "per file", "items", "flatten", "meeting"],
  "split-join": ["checklist", "each line", "bullet", "report", "summarize"],
  combine: ["policy", "expense", "against", "audit"],
  assemble: ["resume", "job", "skill", "match"],
  fork: ["independently", "risks", "parties", "memo", "contract"],
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
}

// AI : 1–3 nearest past-good examples per request — not an exact-task answer-key lookup.
export function retrieveVibeExamples(task: string, k = 3): VibeExampleTask[] {
  const tokens = new Set(tokenize(task))
  const scored = vibeExampleTasks().map((ex) => {
    const hay = tokenize(`${ex.prompt} ${ex.title} ${ex.topology} ${(TOPOLOGY_HINTS[ex.topology] ?? []).join(" ")}`)
    let score = hay.filter((t) => tokens.has(t)).length
    for (const hint of TOPOLOGY_HINTS[ex.topology] ?? []) {
      if (task.toLowerCase().includes(hint)) score += 3
    }
    return { ex, score }
  })
  scored.sort((a, b) => b.score - a.score)
  const positive = scored.filter((s) => s.score > 0)
  return (positive.length ? positive : scored).slice(0, k).map((s) => s.ex)
}

export function exampleTopologyHit(task: VibeExampleTask, kinds: string[], _inputCount: number): boolean {
  switch (task.topology) {
    case "batch-map":
      return kinds.includes("llm-batch")
    case "explode":
      return kinds.includes("llm-batch") && kinds.includes("custom-code")
    case "split-join":
      return kinds.includes("custom-code") && kinds.includes("llm-batch")
    case "combine":
      return kinds.includes("combine")
    case "assemble":
      return kinds.includes("assemble")
    case "fork":
      return kinds.includes("fork")
  }
}

export function structureFileName(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_]/g, "_") || "Model"
  return `structures/${safe}.json`
}

function pretty(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function seedHarnessWriteTools(payload: VibeExamplePayload): Array<{
  tool: "write_file"
  path: string
  content: string
}> {
  const tools: Array<{ tool: "write_file"; path: string; content: string }> = []
  if (vibeJsAuthoringEnabled()) {
    tools.push({ tool: "write_file", path: "pipeline.ts", content: payloadToWorkflow(payload) })
  } else {
    for (const model of payload.models) {
      const name =
        model && typeof model === "object" && "name" in model && typeof (model as { name: unknown }).name === "string"
          ? (model as { name: string }).name
          : "Model"
      tools.push({ tool: "write_file", path: structureFileName(name), content: pretty(model) })
    }
    tools.push({ tool: "write_file", path: "pipeline.json", content: pretty(payload.modules) })
  }
  for (const doc of payload.docs ?? []) {
    const base = doc.name.trim().replace(/^\/+/, "").split("/").pop() ?? "sample.txt"
    const file = base.replace(/[^A-Za-z0-9._-]/g, "_") || "sample.txt"
    tools.push({ tool: "write_file", path: `tests/${file}`, content: doc.content })
  }
  if (payload.documentationUpdate) {
    tools.push({ tool: "write_file", path: "docs.md", content: payload.documentationUpdate })
  }
  tools.push({ tool: "write_file", path: "message.md", content: payload.message })
  if (payload.projectNameUpdate) {
    tools.push({
      tool: "write_file",
      path: "project.json",
      content: pretty({ name: payload.projectNameUpdate, targetFunctionName: null }),
    })
  }
  return tools
}
