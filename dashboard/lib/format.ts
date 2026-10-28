export type CentsAmount = number;

const MAX_USD_FRACTION_DIGITS = 8;

function usdStringFromCents(cents: CentsAmount): string {
  const usd = cents / 100;
  return usd
    .toFixed(MAX_USD_FRACTION_DIGITS)
    .replace(/(\.\d*?[1-9])0+$/, "$1")
    .replace(/\.0+$/, "")
    .replace(/\.$/, "");
}

export function formatCents(cents: CentsAmount): string {
  if (!Number.isFinite(cents) || cents <= 0) return "$0.00";
  return `$${usdStringFromCents(cents)}`;
}
