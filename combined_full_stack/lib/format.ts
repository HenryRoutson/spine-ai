// AI : shared display formatters for cents and latency.

export type CentsAmount = number;

// AI : cents stored to ≤6 dp — USD needs ≤8 dp after ÷100; trim trailing zeros only (no rounding).
const MAX_USD_FRACTION_DIGITS = 8;

function usdStringFromCents(cents: CentsAmount): string {
  const usd = cents / 100;
  return usd
    .toFixed(MAX_USD_FRACTION_DIGITS)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "")
    .replace(/\.$/, "");
}

// AI : all *Cents fields store fractional cents — display only here (÷ 100 → USD).
export function formatCents(cents: CentsAmount): string {
  if (!Number.isFinite(cents) || cents <= 0) return "$0.00";
  return `$${usdStringFromCents(cents)}`;
}

export function formatUsdFromCents(cents: CentsAmount): string {
  return formatCents(cents);
}

export function formatCostCents(cents: CentsAmount): string {
  return formatCents(cents);
}

export function formatSecondsShort(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatMs(n: number): string {
  if (n >= 60000) return `${(n / 60000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${Math.round(n)}ms`;
}
