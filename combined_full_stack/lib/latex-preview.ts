// AI : field names that commonly hold LaTeX documents / question bodies in pipeline JSON.
const LATEX_FIELD_KEYS = new Set([
  "latex",
  "latex_body",
  "latex_template",
  "tex",
  "source_tex",
])

export type LatexPreviewPiece = {
  title?: string
  source: string
  style?: string
}

export function looksLikeLatexSource(text: string): boolean {
  const s = text.trim()
  if (!s) return false
  if (/\\documentclass\b/.test(s) || /\\begin\{document\}/.test(s)) return true
  if (/\\begin\{tikzpicture\}/.test(s) || /\\section\*?\b/.test(s) || /\\subsection\*?\b/.test(s)) return true
  // AI : enough backslash commands that this is unlikely to be plain prose.
  const cmds = s.match(/\\[a-zA-Z]+/g)
  return (cmds?.length ?? 0) >= 3 && (/\$[^$]+\$/.test(s) || /\\frac\b|\\mathbf\b|\\textit\b/.test(s))
}

function titleFromNeighbor(obj: Record<string, unknown>): string | undefined {
  for (const k of ["title", "example_id", "name", "topic"]) {
    const v = obj[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return undefined
}

function styleFromNeighbor(obj: Record<string, unknown>): string | undefined {
  const v = obj.style
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

function collectFromValue(value: unknown, out: LatexPreviewPiece[], depth: number): void {
  if (depth > 6 || value == null) return
  if (typeof value === "string") {
    if (looksLikeLatexSource(value)) out.push({ source: value })
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectFromValue(item, out, depth + 1)
    return
  }
  if (typeof value !== "object") return
  const obj = value as Record<string, unknown>
  let foundField = false
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string" && (LATEX_FIELD_KEYS.has(k) || looksLikeLatexSource(v))) {
      out.push({
        title: titleFromNeighbor(obj),
        style: styleFromNeighbor(obj),
        source: v,
      })
      foundField = true
    }
  }
  if (foundField) return
  for (const v of Object.values(obj)) collectFromValue(v, out, depth + 1)
}

// AI : prefer full documents (latex field) over templates / bodies when both appear.
function scorePiece(p: LatexPreviewPiece): number {
  let n = 0
  if (/\\begin\{document\}/.test(p.source)) n += 8
  if (/\\documentclass\b/.test(p.source)) n += 4
  if (p.source.length > 200) n += 2
  return n
}

export function extractLatexPreviewPieces(jsonOrText: string): LatexPreviewPiece[] {
  const trimmed = jsonOrText.trim()
  if (!trimmed) return []
  try {
    const parsed: unknown = JSON.parse(trimmed)
    const out: LatexPreviewPiece[] = []
    collectFromValue(parsed, out, 0)
    if (!out.length) return []
    // AI : if we found a full document, drop weaker fragments (templates) from the same payload.
    const best = Math.max(...out.map(scorePiece))
    const strong = out.filter((p) => scorePiece(p) >= best - 2)
    return strong.length ? strong : out
  } catch {
    return looksLikeLatexSource(trimmed) ? [{ source: trimmed }] : []
  }
}

export function jsonHasLatexPreview(jsonOrText: string): boolean {
  return extractLatexPreviewPieces(jsonOrText).length > 0
}

// AI : strip document chrome; keep math for KaTeX; leave TikZ as fenced blocks for TikzBlock.
export function latexSourceToPreviewMarkdown(source: string): string {
  let body = source
  const doc = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/)
  if (doc?.[1] != null) body = doc[1]

  // AI : hoist tikz out of figures first so diagrams still render.
  body = body.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (block) => {
    return `\n\n\`\`\`tikz\n${block.trim()}\n\`\`\`\n\n`
  })
  body = body.replace(/\\begin\{figure\}[\s\S]*?\\end\{figure\}/g, (fig) => {
    const tikz = fig.match(/```tikz[\s\S]*?```/)
    return tikz ? `\n\n${tikz[0]}\n\n` : "\n\n*[figure]*\n\n"
  })

  body = body
    .replace(/\\section\*\{([^}]*)\}/g, "\n\n## $1\n\n")
    .replace(/\\section\{([^}]*)\}/g, "\n\n## $1\n\n")
    .replace(/\\subsection\*\{([^}]*)\}/g, "\n\n### $1\n\n")
    .replace(/\\subsection\{([^}]*)\}/g, "\n\n### $1\n\n")
    .replace(/\\subsubsection\*\{([^}]*)\}/g, "\n\n#### $1\n\n")
    .replace(/\\subsubsection\{([^}]*)\}/g, "\n\n#### $1\n\n")

  body = body
    .replace(/\\textbf\{([^}]*)\}/g, "**$1**")
    .replace(/\\textit\{([^}]*)\}/g, "*$1*")
    .replace(/\\emph\{([^}]*)\}/g, "*$1*")
    .replace(/\\underline\{([^}]*)\}/g, "$1")
    .replace(/\\textmd\{([^}]*)\}/g, "$1")
    .replace(/\\textrm\{([^}]*)\}/g, "$1")

  body = body
    .replace(/\\begin\{enumerate\}/g, "\n")
    .replace(/\\end\{enumerate\}/g, "\n")
    .replace(/\\begin\{itemize\}/g, "\n")
    .replace(/\\end\{itemize\}/g, "\n")
    .replace(/\\item\s+/g, "\n- ")

  body = body
    .replace(/\\newline\b/g, "\n")
    .replace(/\\\\/g, "\n")
    .replace(/\\par\b/g, "\n\n")
    .replace(/~/g, " ")

  // AI : drop remaining simple one-arg commands we don't map; keep math ($…$, \(…\), \[…\]).
  body = body.replace(/\\(?:vspace|hspace|label|ref|cite)\*?\{[^}]*\}/g, "")
  body = body.replace(/\\(?:centering|raggedright|raggedleft|noindent|bigskip|medskip|smallskip)\b/g, "")

  return body.replace(/\n{3,}/g, "\n\n").trim()
}
