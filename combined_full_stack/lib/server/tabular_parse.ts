import * as XLSX from "xlsx"
import { parseCsv } from "@/lib/csv-parse"

export type TabularSheet = {
  name: string
  rows: Record<string, unknown>[]
}

// AI : normalize CSV / Excel uploads to JSON text + optional per-sheet row sets for structure inference.
export function tabularBytesToContent(bytes: Uint8Array, filename: string): { content: string; sheets: TabularSheet[] } {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""

  if (ext === "csv") {
    const text = new TextDecoder().decode(bytes)
    const rows = parseCsv(text)
    return {
      content: JSON.stringify(rows, null, 2),
      sheets: [{ name: filename.replace(/\.[^.]+$/, ""), rows }],
    }
  }

  const wb = XLSX.read(bytes, { type: "array" })
  const sheets: TabularSheet[] = wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name]!) as Record<string, unknown>[],
  })).filter((s) => s.rows.length > 0)

  const primary = sheets[0]?.rows ?? []
  const content =
    sheets.length <= 1
      ? JSON.stringify(primary, null, 2)
      : JSON.stringify(
          Object.fromEntries(sheets.map((s) => [s.name, s.rows])),
          null,
          2,
        )
  return {
    content,
    sheets,
  }
}
