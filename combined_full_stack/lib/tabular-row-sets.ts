import { tryParseJson } from "@/lib/json-utils"
import type { InputType } from "@/lib/types"

export type TabularRowSet = {
  name: string
  rows: Record<string, unknown>[]
}

function isRowArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => v && typeof v === "object" && !Array.isArray(v))
  )
}

// AI : derive per-sheet row sets from stored tabular JSON — powers multi-sheet structure inference in the UI.
export function tabularRowSetsFromContent(
  content: string,
  docName: string,
  docType: InputType,
): TabularRowSet[] | undefined {
  const ext = docName.split(".").pop()?.toLowerCase() ?? ""
  if (docType !== "excel" && docType !== "json" && ext !== "csv" && ext !== "json") return undefined
  const parsed = tryParseJson(content.trim())
  if (!parsed.ok) return undefined

  if (isRowArray(parsed.value)) {
    return [{ name: docName.replace(/\.[^.]+$/, ""), rows: parsed.value }]
  }

  if (parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value)) {
    const entries = Object.entries(parsed.value as Record<string, unknown>).filter(([, v]) =>
      isRowArray(v),
    )
    if (entries.length) {
      return entries.map(([name, rows]) => ({ name, rows: rows as Record<string, unknown>[] }))
    }
  }

  return undefined
}
