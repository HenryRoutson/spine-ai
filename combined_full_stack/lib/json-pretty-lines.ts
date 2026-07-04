// AI : map pretty-printed JSON lines to field paths for per-line compare highlighting.

type field_path_string = string

type path_frame =
  | { kind: "object"; path: field_path_string }
  | { kind: "array"; path: field_path_string; nextIndex: number }

const KEY_VALUE_LINE_RE = /^"((?:\\.|[^"\\])*)"\s*:\s*(.*?)(,?)$/

function parentObjectPath(stack: path_frame[]): field_path_string {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].kind === "object") return stack[i].path
  }
  return ""
}

function arrayElementPath(frame: Extract<path_frame, { kind: "array" }>): field_path_string {
  return frame.path ? `${frame.path}[${frame.nextIndex}]` : `[${frame.nextIndex}]`
}

export function assignPathsToPrettyLines(lines: string[]): (field_path_string | undefined)[] {
  const paths: (field_path_string | undefined)[] = lines.map(() => undefined)
  const stack: path_frame[] = []

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim()

    if (t === "{") {
      const top = stack[stack.length - 1]
      // AI : pretty-printed array elements often put "{" on its own line — bind object frame here.
      if (top?.kind === "array") {
        const elemPath = arrayElementPath(top)
        stack.push({ kind: "object", path: elemPath })
        top.nextIndex++
      }
      continue
    }
    if (t === "[") {
      const top = stack[stack.length - 1]
      if (!stack.length) {
        stack.push({ kind: "array", path: "", nextIndex: 0 })
      } else if (top?.kind === "array") {
        const elemPath = arrayElementPath(top)
        stack.push({ kind: "array", path: elemPath, nextIndex: 0 })
        top.nextIndex++
      }
      continue
    }
    if (t === "}" || t === "}," || t === "]" || t === "],") {
      stack.pop()
      continue
    }

    const keyVal = t.match(KEY_VALUE_LINE_RE)
    if (keyVal) {
      const key = JSON.parse(`"${keyVal[1]}"`) as string
      const parentPath = parentObjectPath(stack)
      const fieldPath = parentPath ? `${parentPath}.${key}` : key
      const rest = keyVal[2].trim()
      if (rest === "{") stack.push({ kind: "object", path: fieldPath })
      else if (rest === "[") stack.push({ kind: "array", path: fieldPath, nextIndex: 0 })
      else paths[i] = fieldPath
      continue
    }

    const top = stack[stack.length - 1]
    if (top?.kind !== "array") continue

    const elemPath = arrayElementPath(top)
    const elem = t.replace(/,$/, "").trim()
    top.nextIndex++
    if (elem === "{") stack.push({ kind: "object", path: elemPath })
    else if (elem === "[") stack.push({ kind: "array", path: elemPath, nextIndex: 0 })
    else paths[i] = elemPath
  }

  return paths
}

const PATH_TOKEN_RE = /(\[[^\]]+\]|[^.\[\]]+)/g

export function valueAtJsonPath(root: unknown, path: field_path_string): unknown {
  if (!path) return root
  const tokens = path.match(PATH_TOKEN_RE) ?? []
  let cur: unknown = root
  for (const tok of tokens) {
    if (tok.startsWith("[")) {
      const idx = Number(tok.slice(1, -1))
      if (!Array.isArray(cur)) return undefined
      cur = cur[idx]
      continue
    }
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) return undefined
    cur = (cur as Record<string, unknown>)[tok]
  }
  return cur
}

export function differingPrettyLineIndexes(a: string, b: string): ReadonlySet<number> {
  const left = a.split("\n")
  const right = b.split("\n")
  const out = new Set<number>()
  const n = Math.min(left.length, right.length)
  for (let i = 0; i < n; i++) {
    if (left[i] !== right[i]) out.add(i)
  }
  return out
}

// AI : value fragment for // not "…" comments on aligned compare rows (key value or array/scalar body).
export function prettyJsonLineCompareComment(line: string): string {
  const t = line.trim()
  const keyVal = t.match(KEY_VALUE_LINE_RE)
  if (keyVal) return keyVal[2].trim().replace(/,$/, "")
  return t.replace(/,$/, "")
}
