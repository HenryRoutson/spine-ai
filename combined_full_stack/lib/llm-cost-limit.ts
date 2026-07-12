import type { PipelineModule } from "@/lib/types"

// AI : default per-llm-step spend cap — $1.00 unless overridden on the module.
export const DEFAULT_LLM_STEP_COST_LIMIT_CENTS = 100

export function llmStepCostLimitCents(m: PipelineModule): number {
  const raw = m.costLimitCents
  if (raw == null || !Number.isFinite(raw) || raw < 0) return DEFAULT_LLM_STEP_COST_LIMIT_CENTS
  return raw
}

export function formatCostLimitUsdInput(cents: number): string {
  const usd = cents / 100
  if (!Number.isFinite(usd)) return "1"
  const s = usd.toFixed(2).replace(/\.?0+$/, "")
  return s || "0"
}

export function parseCostLimitUsdInput(raw: string): number | undefined {
  const trimmed = raw.trim().replace(/^\$/, "")
  if (!trimmed) return undefined
  const usd = Number(trimmed)
  if (!Number.isFinite(usd) || usd < 0) return undefined
  return Math.round(usd * 100 * 1_000_000) / 1_000_000
}
