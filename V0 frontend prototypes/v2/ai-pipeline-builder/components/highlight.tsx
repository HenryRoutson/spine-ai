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
