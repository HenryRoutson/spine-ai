// AI : document byte-size display — never show 0 KB for a file that has content.

export function sizeKbFromChars(chars: number): number {
  return Math.max(1, Math.round(Math.max(0, chars) / 1024))
}

export function formatSizeKb(sizeKb: number): string {
  if (!Number.isFinite(sizeKb) || sizeKb < 1) return "<1 KB"
  return `${Math.round(sizeKb)} KB`
}
