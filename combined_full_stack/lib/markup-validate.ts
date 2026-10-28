import {
  MarkupKind,
  type markup_source_string,
} from "@/lib/markup-kinds"

export type MarkupIssueSeverity = "error" | "warning"

export type MarkupValidationIssue = {
  severity: MarkupIssueSeverity
  message: string
  line?: number
}

export type MarkupValidationResult = {
  ok: boolean
  issues: MarkupValidationIssue[]
}

// AI : SECURITY — allowlist only; no shell-escape, write18, or filesystem packages.
export const LATEX_ALLOWED_PACKAGES: readonly string[] = [
  "amsmath",
  "amssymb",
  "amsfonts",
  "mathtools",
  "geometry",
  "graphicx",
  "xcolor",
  "hyperref",
  "booktabs",
  "enumitem",
  "setspace",
  "inputenc",
  "fontenc",
  "lmodern",
  "microtype",
  "siunitx",
  "bm",
  "physics",
  "cancel",
  "tikz",
  "pgfplots",
  "subcaption",
  "caption",
  "float",
  "array",
  "multirow",
  "tabularx",
  "longtable",
  "natbib",
  "biblatex",
  "csquotes",
  "url",
  "listings",
  "fancyhdr",
  "titlesec",
  "tocloft",
] as const

type latex_package_name = string

// AI : SECURITY — reject shell / filesystem / category-code escapes (single-file sandbox).
const LATEX_BANNED_COMMAND_RE =
  /\\(?:write18|ShellEscape|input|include|includeonly|openout|openin|read|immediate|special|catcode|pdfobj|pdfliteral|directlua|luacode|verbatiminput)\b/gi

const LATEX_PACKAGE_RE = /\\usepackage(?:\s*\[[^\]]*\])?\s*\{([^}]+)\}/g

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length
}

function braceBalanceIssues(source: markup_source_string): MarkupValidationIssue[] {
  const issues: MarkupValidationIssue[] = []
  let depth = 0
  let inLineComment = false
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!
    if (ch === "\n") {
      inLineComment = false
      continue
    }
    if (inLineComment) continue
    if (ch === "%" && (i === 0 || source[i - 1] !== "\\")) {
      inLineComment = true
      continue
    }
    if (ch === "{") depth++
    else if (ch === "}") {
      depth--
      if (depth < 0) {
        issues.push({ severity: "error", message: "unmatched closing brace '}'", line: lineOf(source, i) })
        depth = 0
      }
    }
  }
  if (depth > 0) {
    issues.push({ severity: "error", message: `unclosed brace — ${depth} '{' still open` })
  }
  return issues
}

function latexEnvBalanceIssues(source: markup_source_string): MarkupValidationIssue[] {
  const issues: MarkupValidationIssue[] = []
  const stack: { name: string; line: number }[] = []
  const re = /\\(begin|end)\s*\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const kind = m[1]!
    const name = m[2]!.trim()
    const line = lineOf(source, m.index)
    if (kind === "begin") stack.push({ name, line })
    else {
      const top = stack.pop()
      if (!top) {
        issues.push({ severity: "error", message: `\\end{${name}} with no matching \\begin`, line })
      } else if (top.name !== name) {
        issues.push({
          severity: "error",
          message: `\\end{${name}} does not match \\begin{${top.name}} (line ${top.line})`,
          line,
        })
      }
    }
  }
  for (const open of stack) {
    issues.push({
      severity: "error",
      message: `unclosed \\begin{${open.name}}`,
      line: open.line,
    })
  }
  return issues
}

export function validateLatex(
  source: markup_source_string,
  opts?: { allowedPackages?: readonly string[] },
): MarkupValidationResult {
  const issues: MarkupValidationIssue[] = []
  const allowed = new Set<latex_package_name>(opts?.allowedPackages ?? LATEX_ALLOWED_PACKAGES)

  let banned: RegExpExecArray | null
  LATEX_BANNED_COMMAND_RE.lastIndex = 0
  while ((banned = LATEX_BANNED_COMMAND_RE.exec(source))) {
    issues.push({
      severity: "error",
      message: `forbidden command \\${banned[0]!.slice(1)} (security)`,
      line: lineOf(source, banned.index),
    })
  }

  LATEX_PACKAGE_RE.lastIndex = 0
  let pkgMatch: RegExpExecArray | null
  while ((pkgMatch = LATEX_PACKAGE_RE.exec(source))) {
    const names = pkgMatch[1]!.split(",").map((s) => s.trim()).filter(Boolean)
    for (const name of names) {
      const base = name.replace(/\.sty$/i, "")
      if (!allowed.has(base)) {
        issues.push({
          severity: "error",
          message: `package "${base}" is not on the allowlist`,
          line: lineOf(source, pkgMatch.index),
        })
      }
    }
  }

  issues.push(...braceBalanceIssues(source))
  issues.push(...latexEnvBalanceIssues(source))

  // AI : dollar math should pair when used (common latex / md-math footgun).
  const dollarCount = (source.match(/(?<!\\)\$/g) ?? []).length
  if (dollarCount % 2 !== 0) {
    issues.push({ severity: "error", message: "unpaired '$' math delimiter" })
  }

  return { ok: issues.every((i) => i.severity !== "error"), issues }
}

function markdownFenceIssues(source: markup_source_string): MarkupValidationIssue[] {
  const issues: MarkupValidationIssue[] = []
  const lines = source.split("\n")
  let openFence: { lang: string; line: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const fence = line.match(/^(`{3,}|~{3,})(\w*)\s*$/)
    if (!fence) continue
    if (!openFence) {
      openFence = { lang: fence[2] ?? "", line: i + 1 }
    } else {
      openFence = null
    }
  }
  if (openFence) {
    issues.push({
      severity: "error",
      message: `unclosed fenced code block${openFence.lang ? ` (${openFence.lang})` : ""}`,
      line: openFence.line,
    })
  }
  return issues
}

export function validateMarkdown(source: markup_source_string): MarkupValidationResult {
  const issues: MarkupValidationIssue[] = []
  issues.push(...markdownFenceIssues(source))

  // AI : mermaid fences must be non-empty when present.
  const mermaidRe = /```mermaid\s*\n([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = mermaidRe.exec(source))) {
    if (!m[1]!.trim()) {
      issues.push({
        severity: "error",
        message: "empty mermaid diagram",
        line: lineOf(source, m.index),
      })
    }
  }

  const dollarCount = (source.match(/(?<!\\)\$/g) ?? []).length
  if (dollarCount % 2 !== 0) {
    issues.push({ severity: "warning", message: "unpaired '$' — math may not render" })
  }

  return { ok: issues.every((i) => i.severity !== "error"), issues }
}

export function validateMarkup(kind: MarkupKind, source: markup_source_string): MarkupValidationResult {
  switch (kind) {
    case MarkupKind.Markdown:
      return validateMarkdown(source)
    case MarkupKind.Latex:
      return validateLatex(source)
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function isValidMarkdown(source: string): boolean {
  return validateMarkdown(source).ok
}

export function isValidLatex(source: string): boolean {
  return validateLatex(source).ok
}

export function isValidMarkup(kind: MarkupKind, source: string): boolean {
  return validateMarkup(kind, source).ok
}
