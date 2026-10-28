// AI : parse .env text client-side — import into Library → Secrets without uploading to server first.

export type env_entry = {
  name: string
  value: string
}

export type parse_env_file_result = {
  entries: env_entry[]
  skipped: string[]
}

const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,127}$/

function normalizeEnvKey(raw: string): string {
  return raw
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/^export\s+/i, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function unquoteEnvValue(raw: string): string {
  const trimmed = raw.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    const inner = trimmed.slice(1, -1)
    if (trimmed.startsWith('"')) return inner.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
    return inner
  }
  return trimmed
}

function parseEnvLine(line: string): env_entry | { skip: string } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null
  const eq = trimmed.indexOf("=")
  if (eq <= 0) return null
  const rawName = trimmed.slice(0, eq).replace(/^\uFEFF/, "").replace(/^export\s+/i, "").trim()
  const name = normalizeEnvKey(rawName)
  if (!name || !SECRET_NAME_RE.test(name)) return rawName ? { skip: rawName.toUpperCase() } : null
  const value = unquoteEnvValue(trimmed.slice(eq + 1))
  if (!value) return null
  return { name, value }
}

export function logicalNameFromPrefixedEnvKey(
  name: string,
  projectPrefix: string | null | undefined,
): string | null {
  if (!projectPrefix) return name
  const head = `${projectPrefix}_`
  if (!name.startsWith(head)) return name
  const logical = name.slice(head.length)
  return logical.length > 0 && SECRET_NAME_RE.test(logical) ? logical : null
}

export function parseEnvFileText(
  text: string,
  opts?: { projectPrefix?: string | null },
): parse_env_file_result {
  const byName = new Map<string, string>()
  const skipped: string[] = []
  const prefix = opts?.projectPrefix?.trim().toUpperCase() || null

  for (const line of text.split(/\r?\n/)) {
    const parsed = parseEnvLine(line)
    if (!parsed) continue
    if ("skip" in parsed) {
      skipped.push(parsed.skip)
      continue
    }
    const logical = logicalNameFromPrefixedEnvKey(parsed.name, prefix)
    if (!logical) {
      skipped.push(parsed.name)
      continue
    }
    byName.set(logical, parsed.value)
  }

  return {
    entries: [...byName.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    skipped,
  }
}
