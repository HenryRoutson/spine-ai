// AI : n8n export step bodies — bake catalog code + params so TS export matches UI runN8nPiece.
// AI : TODO (n8n-sidecar-S7-export) — live mode must emit env-backed HTTP (N8N_BASE_URL / webhook), not baked Code-node JS.
// AI :   py/go/rs already raise for local; keep that until live HTTP export exists.
import {
  DEFAULT_N8N_TIMEOUT_MS,
  getN8nNode,
  piecePropDefaults,
  type N8nNodeCatalogEntry,
} from "@/lib/n8n-catalog"
import type { PipelineModule } from "@/lib/types"

export type N8nExportResolved = {
  nodeType: string
  code: string
  params: Record<string, unknown>
  timeoutMs: number
  entry?: N8nNodeCatalogEntry
}

// AI : same resolution as lib/n8n-run.runN8nPiece — override code wins; else catalog piece JS.
export function resolveN8nForExport(m: PipelineModule): N8nExportResolved {
  const nodeType = m.n8nNodeType?.trim() ?? ""
  const entry = getN8nNode(nodeType)
  const code = m.n8nCode?.trim() || entry?.n8nCode || "return items;"
  const params = {
    ...(entry ? piecePropDefaults(entry) : {}),
    ...(m.n8nParameters ?? {}),
  }
  return {
    nodeType,
    code,
    params,
    timeoutMs: m.n8nTimeoutMs ?? DEFAULT_N8N_TIMEOUT_MS,
    entry: entry ?? undefined,
  }
}

export function exportN8nStepBodyTs(m: PipelineModule, outTs: string): string {
  const r = resolveN8nForExport(m)
  const label = r.entry?.displayName ?? (r.nodeType || "n8n")
  return [
    `// n8n piece ${JSON.stringify(label)} — local Code-node JS (same as UI)`,
    `const raw = await runN8nCode(${JSON.stringify(r.code)}, ${JSON.stringify(r.params)}, input, ${r.timeoutMs});`,
    `return raw as unknown as ${outTs};`,
  ].join("\n")
}

export function exportN8nStepBodyPy(m: PipelineModule, outPy: string): string {
  const r = resolveN8nForExport(m)
  return [
    `# n8n piece ${JSON.stringify(r.nodeType)} — Code-node JS runs in UI / TS export only`,
    ...r.code.split("\n").map((l) => `# ${l}`),
    `raise NotImplementedError("n8n pieces execute via runN8nCode in the TypeScript export")  # ${outPy}`,
  ].join("\n")
}

export function exportN8nStepBodyGo(m: PipelineModule, zero: string): string {
  const r = resolveN8nForExport(m)
  return [
    `// n8n piece ${JSON.stringify(r.nodeType)} — Code-node JS runs in UI / TS export only`,
    ...r.code.split("\n").map((l) => `// ${l}`),
    `return ${zero}, fmt.Errorf("n8n pieces execute via runN8nCode in the TypeScript export")`,
  ].join("\n")
}

export function exportN8nStepBodyRust(m: PipelineModule): string {
  const r = resolveN8nForExport(m)
  return [
    `// n8n piece ${JSON.stringify(r.nodeType)} — Code-node JS runs in UI / TS export only`,
    ...r.code.split("\n").map((l) => `// ${l}`),
    `Err(anyhow::anyhow!("n8n pieces execute via runN8nCode in the TypeScript export"))`,
  ].join("\n")
}
