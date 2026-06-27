// AI : shared display formatters for cents and latency.

export function formatUsdFromCents(cents: number, fractionDigits = 2): string {
  return `$${(cents / 100).toFixed(fractionDigits)}`
}

export function formatSecondsShort(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatMs(n: number): string {
  if (n >= 60000) return `${(n / 60000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`
  return `${Math.round(n)}ms`
}

// AI : pipeline LLM costs are often sub-cent — show "0.04c" not "$0.00".
export function formatCostCents(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0c"
  if (n >= 100) return formatUsdFromCents(n)
  return `${n.toFixed(2)}c`
}
