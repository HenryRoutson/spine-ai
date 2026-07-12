// AI : detect parseable JSON so UIs can show the table viewer instead of raw text.

export function isJsonText(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (t[0] !== "{" && t[0] !== "[") return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}
