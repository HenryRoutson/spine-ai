export type JsonParseResult =
  | { ok: true; value: unknown }
  | { ok: false; error: Error }

export function tryParseJson(content: string, opts?: { trim?: boolean }): JsonParseResult {
  const src = opts?.trim ? content.trim() : content
  try {
    return { ok: true, value: JSON.parse(src) as unknown }
  } catch (e) {
    return { ok: false, error: e as Error }
  }
}

export function isValidJsonString(s: string, opts?: { allowEmpty?: boolean }): boolean {
  const t = s.trim()
  if (!t && !opts?.allowEmpty) return false
  return tryParseJson(t).ok
}

export function isDownloadableJson(content: string): boolean {
  return tryParseJson(content).ok
}

export function prettyJsonString(content: string): string {
  const parsed = tryParseJson(content)
  if (!parsed.ok) throw parsed.error
  return JSON.stringify(parsed.value, null, 2)
}
