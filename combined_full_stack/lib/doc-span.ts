// AI : quote span — indexOf fallback when stored offsets no longer match source text.
export function resolveSpan(
  text: string,
  start: number,
  end: number,
  expected?: string,
): { start: number; end: number } {
  if (start === end) return { start, end }
  if (!expected || text.slice(start, end) === expected) return { start, end }
  const idx = text.indexOf(expected)
  if (idx !== -1) return { start: idx, end: idx + expected.length }
  return { start: 0, end: 0 }
}
