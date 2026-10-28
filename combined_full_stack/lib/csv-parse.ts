// AI : minimal RFC4180-style CSV — handles quoted fields with commas.
function coerceCell(val: string): unknown {
  const t = val.trim()
  if (!t) return ""
  if (t === "true" || t === "false") return t === "true"
  if (/^-?\d+$/.test(t)) return parseInt(t, 10)
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t)
  if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
    try {
      return JSON.parse(t) as unknown
    } catch {
      return t
    }
  }
  return t
}

function splitCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
      continue
    }
    if (ch === ",") {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export function sanitizeFieldName(raw: string): string {
  let s = raw
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, "_")
  if (!s) s = "field"
  if (/^\d/.test(s)) s = `col_${s}`
  return s.toLowerCase()
}

export function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = splitCsvRow(lines[0]!).map(sanitizeFieldName)
  const rows: Record<string, unknown>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]!)
    if (cells.every((c) => !c.trim())) continue
    const row: Record<string, unknown> = {}
    headers.forEach((h, j) => {
      row[h] = coerceCell(cells[j] ?? "")
    })
    rows.push(row)
  }
  return rows
}
