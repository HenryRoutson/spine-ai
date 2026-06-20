"use client"

import { Fragment } from "react"

// Lightweight JSON syntax highlighter for log/output views.
export function JsonHighlight({ json }: { json: string }) {
  const tokens = json.split(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
  )
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        {tokens.map((t, i) => {
          if (!t) return null
          let cls = "text-foreground"
          if (/^"/.test(t)) {
            cls = /:\s*$/.test(t) ? "text-chart-2" : "text-primary"
          } else if (/^(true|false|null)$/.test(t)) {
            cls = "text-chart-4"
          } else if (/^-?\d/.test(t)) {
            cls = "text-chart-3"
          }
          return (
            <span key={i} className={cls}>
              {t}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

// Minimal markdown renderer with code/heading/bullet support + highlighting.
export function MarkdownView({ md }: { md: string }) {
  const lines = md.split("\n")
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-foreground">
      {lines.map((line, i) => {
        if (line.startsWith("# ")) {
          return (
            <h3 key={i} className="text-sm font-semibold">
              {line.slice(2)}
            </h3>
          )
        }
        if (line.startsWith("## ")) {
          return (
            <h4 key={i} className="font-medium text-foreground">
              {line.slice(3)}
            </h4>
          )
        }
        if (line.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 pl-1 text-muted-foreground">
              <span className="text-primary">·</span>
              <span>{inlineCode(line.slice(2))}</span>
            </div>
          )
        }
        if (line.trim() === "") return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-muted-foreground">
            {inlineCode(line)}
          </p>
        )
      })}
    </div>
  )
}

// Render prompt text with embedded JSON blobs syntax-highlighted inline.
export function PromptText({ text }: { text: string }) {
  const parts = splitJsonSegments(text)
  return (
    <>
      {parts.map((p, i) =>
        p.isJson ? (
          <span key={i} className="my-1 block rounded border border-border bg-[oklch(0.14_0.004_264)] p-2">
            <JsonHighlight json={p.text} />
          </span>
        ) : (
          <PlainPromptSegment key={i} text={p.text} />
        ),
      )}
    </>
  )
}

// AI : highlight SOURCE DOCUMENT blocks in LLM prompts and Link Quotes step input.
function PlainPromptSegment({ text }: { text: string }) {
  const startMatch = text.match(/SOURCE DOCUMENT(?: \([^)]+\))?:\n/)
  if (!startMatch || startMatch.index === undefined) return <span>{text}</span>

  const start = startMatch.index
  const headerEnd = start + startMatch[0].length
  const header = startMatch[0].trimEnd()
  const tailMarkers = ["\n\n── RAW EXTRACTS ──\n", "\n\nINPUT DATA:", "\n\nRespond with ONLY"]
  let bodyEnd = text.length
  for (const m of tailMarkers) {
    const idx = text.indexOf(m, headerEnd)
    if (idx !== -1) bodyEnd = Math.min(bodyEnd, idx)
  }

  const before = text.slice(0, start)
  const body = text.slice(headerEnd, bodyEnd)
  const after = text.slice(bodyEnd)

  return (
    <span>
      {before}
      <span className="my-1 block rounded border border-chart-2/40 bg-chart-2/10 p-2">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-chart-2">
          {header}
        </span>
        <span className="mt-1 block whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
          {body.trimEnd()}
        </span>
      </span>
      {after}
    </span>
  )
}

type TextSegment = { text: string; isJson: boolean }

// Walk text finding balanced { } / [ ] that are valid JSON; split on them.
function splitJsonSegments(text: string): TextSegment[] {
  const result: TextSegment[] = []
  let i = 0
  let buf = ""
  while (i < text.length) {
    const c = text[i]
    if (c === "{" || c === "[") {
      const end = findJsonEnd(text, i)
      if (end !== -1) {
        const candidate = text.slice(i, end + 1)
        try {
          JSON.parse(candidate)
          if (buf) { result.push({ text: buf, isJson: false }); buf = "" }
          result.push({ text: candidate, isJson: true })
          i = end + 1
          continue
        } catch { /* not valid JSON, fall through */ }
      }
    }
    buf += c
    i++
  }
  if (buf) result.push({ text: buf, isJson: false })
  return result
}

// Return the index of the closing bracket matching text[start], or -1.
function findJsonEnd(text: string, start: number): number {
  const open = text[start]
  const close = open === "{" ? "}" : "]"
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (esc) { esc = false; continue }
    if (c === "\\" && inStr) { esc = true; continue }
    if (c === '"') { inStr = !inStr; continue }
    if (inStr) continue
    if (c === open) depth++
    else if (c === close) { if (--depth === 0) return i }
  }
  return -1
}

function inlineCode(s: string) {
  const parts = s.split(/(`[^`]+`)/g)
  return parts.map((p, i) =>
    p.startsWith("`") && p.endsWith("`") ? (
      <code key={i} className="rounded bg-secondary px-1 font-mono text-[11px] text-primary">
        {p.slice(1, -1)}
      </code>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  )
}
