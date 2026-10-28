// AI : Local n8n Code-node runtime — typed spine in/out. Does not call n8n Cloud or vendor APIs.
// AI : SUPERSEDED (n8n-sidecar-S2-live) — live Slack/Gmail is steps/connect.ts, not this file.
// AI : SUPERSEDED (n8n-sidecar-S3-adapter) — connect uses materializeStepOutput; spineToN8nItems stays local.
import { DEFAULT_N8N_TIMEOUT_MS, getN8nNode, type n8n_node_type_string } from "@/lib/n8n-catalog"

export type N8nItem = { json: Record<string, unknown> }

export function spineToN8nItems(input: unknown): N8nItem[] {
  if (input == null) return [{ json: {} }]
  if (Array.isArray(input)) {
    return input.map((row) => ({
      json: row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : { value: row },
    }))
  }
  if (typeof input === "object") return [{ json: input as Record<string, unknown> }]
  return [{ json: { value: input } }]
}

export function n8nItemsToSpine(items: N8nItem[], inputWasList: boolean): unknown {
  const jsons = items.map((i) => i.json ?? {})
  if (inputWasList) return jsons
  return jsons[0] ?? {}
}

function asItems(raw: unknown, fallback: N8nItem[]): N8nItem[] {
  if (!Array.isArray(raw)) return fallback
  return raw.map((row) => {
    if (row && typeof row === "object" && "json" in row && row.json && typeof row.json === "object") {
      return { json: row.json as Record<string, unknown> }
    }
    if (row && typeof row === "object" && !Array.isArray(row)) return { json: row as Record<string, unknown> }
    return { json: { value: row } }
  })
}

export function evalN8nCode(
  code: string,
  items: N8nItem[],
  params: Record<string, unknown>,
): N8nItem[] {
  const src = code.trim()
  if (!src) return items
  const $input = {
    all: () => items,
    first: () => items[0],
    item: items[0],
  }
  const $json = items[0]?.json ?? {}
  // AI : n8n Code node — Function is parse+run of session-local piece JS, not a hosted tenant sandbox.
  const fn = new Function("items", "$input", "$json", "$parameter", "params", `"use strict";\n${src}`)
  const result = fn(items, $input, $json, params, params)
  return asItems(result, items)
}

export async function runN8nPiece(opts: {
  n8nNodeType: n8n_node_type_string
  n8nCode?: string
  n8nParameters?: Record<string, unknown>
  input: unknown
  timeoutMs?: number
}): Promise<unknown> {
  const entry = getN8nNode(opts.n8nNodeType)
  if (!entry) throw new Error(`unknown n8n piece: ${opts.n8nNodeType}`)
  const params = { ...Object.fromEntries(entry.props.map((p) => [p.name, p.default])), ...(opts.n8nParameters ?? {}) }
  const items = spineToN8nItems(opts.input)
  const code = opts.n8nCode?.trim() || entry.n8nCode
  const timeoutMs = opts.timeoutMs ?? DEFAULT_N8N_TIMEOUT_MS
  const ran = await Promise.race([
    Promise.resolve().then(() => evalN8nCode(code, items, params)),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`n8n piece timed out after ${timeoutMs}ms`)), timeoutMs)
    }),
  ])
  return n8nItemsToSpine(ran, Array.isArray(opts.input))
}
