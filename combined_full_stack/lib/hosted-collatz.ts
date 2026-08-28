// AI : hosted demo math — Double is one step; odd Collatz is times-three then plus-one.

export type hosted_action_kind = "double" | "collatz"

export type hosted_arith_step = {
  label: string
  from: number
  to: number
  expr: string
}

export function parseHostedNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value)
  return null
}

export function doublePreview(n: number): hosted_arith_step[] {
  return [{ label: "Double", from: n, to: n * 2, expr: `${n} × 2` }]
}

export function collatzPreview(n: number): hosted_arith_step[] {
  if (n % 2 === 0) {
    return [{ label: "Divide by two", from: n, to: n / 2, expr: `${n} ÷ 2` }]
  }
  const timesThree = n * 3
  return [
    { label: "Times three", from: n, to: timesThree, expr: `${n} × 3` },
    { label: "Plus one", from: timesThree, to: timesThree + 1, expr: `${timesThree} + 1` },
  ]
}

export function hostedActionPreview(kind: hosted_action_kind, n: number): hosted_arith_step[] {
  return kind === "collatz" ? collatzPreview(n) : doublePreview(n)
}

export function hostedArithLabels(kind: hosted_action_kind, n: number | null): string[] {
  if (n == null) return kind === "collatz" ? ["Times three", "Plus one"] : ["Double"]
  return hostedActionPreview(kind, n).map((step) => step.label)
}

export type hosted_preview_line = {
  expr: string
  result: string
}

// AI : idle cards show algebra; live cards show both sides of each arithmetic step.
export function hostedPreviewLines(kind: hosted_action_kind, n: number | null): hosted_preview_line[] {
  if (n == null) {
    return kind === "collatz"
      ? [
          { expr: "n × 3", result: "3n" },
          { expr: "3n + 1", result: "3n+1" },
        ]
      : [{ expr: "n × 2", result: "2n" }]
  }
  return hostedActionPreview(kind, n).map((step) => ({ expr: step.expr, result: String(step.to) }))
}

export function hostedActionCardTitle(kind: hosted_action_kind): string {
  return kind === "collatz" ? "3n + 1" : "Double"
}
