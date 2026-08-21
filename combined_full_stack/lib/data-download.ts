import { isDownloadableJson, prettyJsonString, tryParseJson } from "@/lib/json-utils"
import { downloadBlob } from "@/lib/download-blob"

type tabular_row = Record<string, string | number | boolean | null>

function cellToExportValue(v: unknown): string | number | boolean | null {
  if (v === null || v === undefined) return null
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v
  return JSON.stringify(v)
}

// AI : one-level object flatten — mirrors json-viewer table export expectations.
// AI : TODO (media-view-A-download) — when value has doc_id + mime audio/video/3d, download original bytes; keep JSON as second format.
function flattenRow(obj: Record<string, unknown>, prefix = "", depth = 0): tabular_row {
  const cols: tabular_row = {}
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === "object" && !Array.isArray(v) && depth < 1) {
      Object.assign(cols, flattenRow(v as Record<string, unknown>, key, depth + 1))
    } else {
      cols[key] = cellToExportValue(v)
    }
  }
  return cols
}

export function extractTabularRows(parsed: unknown): tabular_row[] {
  if (Array.isArray(parsed)) {
    if (!parsed.length) return []
    if (typeof parsed[0] === "object" && parsed[0] !== null && !Array.isArray(parsed[0])) {
      return parsed.map((row) => flattenRow(row as Record<string, unknown>))
    }
    return parsed.map((v, i) => ({ index: i, value: cellToExportValue(v) }))
  }
  if (typeof parsed === "object" && parsed !== null) {
    return [flattenRow(parsed as Record<string, unknown>)]
  }
  return [{ value: cellToExportValue(parsed) }]
}

function escapeCsvCell(v: string | number | boolean | null): string {
  if (v === null) return ""
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function rowsToCsv(rows: tabular_row[]): string {
  if (!rows.length) return ""
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const header = keys.map(escapeCsvCell).join(",")
  const body = rows.map((r) => keys.map((k) => escapeCsvCell(r[k] ?? null)).join(","))
  return [header, ...body].join("\n")
}

export type DataDownloadFormat = "json" | "csv" | "xlsx"

export function downloadDataAs(content: string, format: DataDownloadFormat, baseName = "data") {
  if (format === "json") {
    downloadBlob(`${baseName}.json`, prettyJsonString(content), "application/json")
    return
  }
  const parsed = tryParseJson(content)
  if (!parsed.ok) throw parsed.error
  const rows = extractTabularRows(parsed.value)
  if (format === "csv") {
    downloadBlob(`${baseName}.csv`, rowsToCsv(rows), "text/csv")
    return
  }
  void (async () => {
    const XLSX = await import("xlsx")
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer
    downloadBlob(`${baseName}.xlsx`, buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  })()
}

export { isDownloadableJson }
