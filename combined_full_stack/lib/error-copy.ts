// AI : clipboard payloads for UI errors — include where the banner lives plus stack when available.

export type ErrorClipboardFields = {
  uiLocation: string
  summary: string
  detail?: string
  stack?: string
  context?: Readonly<Record<string, string>>
}

export function captureThrownError(err: unknown): { message: string; stack?: string } {
  if (err instanceof Error) return { message: err.message, stack: err.stack }
  return { message: String(err) }
}

export function formatErrorForClipboard(fields: ErrorClipboardFields): string {
  const lines: string[] = [`UI location: ${fields.uiLocation}`]
  if (fields.context) {
    for (const [key, value] of Object.entries(fields.context)) {
      if (value) lines.push(`${key}: ${value}`)
    }
  }
  lines.push(`Error: ${fields.summary}`)
  if (fields.detail?.trim() && fields.detail.trim() !== fields.summary.trim()) {
    lines.push(`Detail: ${fields.detail.trim()}`)
  }
  if (fields.stack?.trim()) {
    lines.push("", "Stack trace:", fields.stack.trim())
  }
  return lines.join("\n")
}
