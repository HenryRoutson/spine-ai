import type { LlmCallRecord } from "@/lib/types"

export type LlmRetryGridCellStatus = "empty" | "ok" | "error" | "retried"

export type LlmRetryGridCell = {
  status: LlmRetryGridCellStatus
  call?: LlmCallRecord
}

export type LlmRetryGrid = {
  promptCount: number
  columnCount: number
  cells: LlmRetryGridCell[][]
}

// AI : infer round from legacy runs that only stored HTTP attempt numbers.
function callRound(call: LlmCallRecord, index: number): number {
  if (call.round != null) return call.round
  if (call.attempt != null) return Math.max(0, call.attempt - 1)
  return index
}

function callPromptIndex(call: LlmCallRecord, index: number, promptCount: number): number {
  if (call.promptIndex != null) return call.promptIndex
  if (promptCount === 1) return 0
  return index
}

export function buildLlmRetryGrid(
  calls: LlmCallRecord[],
  stepSucceeded: boolean,
  promptCountHint?: number,
): LlmRetryGrid | null {
  if (!calls.length) return null

  const promptCount = Math.max(
    promptCountHint ?? 0,
    ...calls.map((c, i) => callPromptIndex(c, i, promptCountHint ?? 1) + 1),
  )
  const columnCount =
    Math.max(...calls.map((c, i) => callRound(c, i) + 1), 1)

  const buckets = new Map<string, LlmCallRecord[]>()
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i]!
    const promptIndex = callPromptIndex(call, i, promptCount)
    const round = callRound(call, i)
    const key = `${promptIndex}:${round}`
    const list = buckets.get(key) ?? []
    list.push(call)
    buckets.set(key, list)
  }

  const cells: LlmRetryGridCell[][] = Array.from({ length: promptCount }, () =>
    Array.from({ length: columnCount }, () => ({ status: "empty" as const })),
  )

  for (const [key, group] of buckets) {
    const [pi, ri] = key.split(":").map(Number) as [number, number]
    if (pi >= promptCount || ri >= columnCount) continue
    const last = group[group.length - 1]!
    cells[pi]![ri] = {
      status: last.status === "ok" ? "ok" : "error",
      call: last,
    }
  }

  if (stepSucceeded) {
    for (let pi = 0; pi < promptCount; pi++) {
      let recovered = false
      for (let ri = columnCount - 1; ri >= 0; ri--) {
        const cell = cells[pi]![ri]!
        if (cell.status === "ok") recovered = true
        else if (cell.status === "error" && recovered) cell.status = "retried"
      }
    }
  }

  const hasFailures = cells.some((row) => row.some((c) => c.status === "error" || c.status === "retried"))
  if (!hasFailures) return null

  // AI : legacy llm-batch runs lack promptIndex — grid rows would be meaningless.
  if (
    promptCountHint != null &&
    promptCountHint > 1 &&
    !calls.some((c) => c.promptIndex != null)
  ) {
    return null
  }

  return { promptCount, columnCount, cells }
}
