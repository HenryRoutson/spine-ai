// AI : line unified diff for test failures — git-diff style over pretty-printed JSON.

export function jsonUnifiedDiff(expected: unknown, actual: unknown): string {
  const a = JSON.stringify(expected, null, 2).split("\n")
  const b = JSON.stringify(actual, null, 2).split("\n")
  const out: string[] = []
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const left = a[i]
    const right = b[i]
    if (left === right) {
      if (left !== undefined) out.push(` ${left}`)
      continue
    }
    if (left !== undefined) out.push(`-${left}`)
    if (right !== undefined) out.push(`+${right}`)
  }
  return out.join("\n")
}
