"use client"

import { Link2 } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { useDocViewer } from "@/lib/doc-viewer"
import { tryParseJson } from "@/lib/json-utils"
import { isProbabilisticFieldPath } from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import type { DocId, JobLogLevel } from "@/lib/types"

const JSON_TOKEN_RE =
  /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function jsonTokenClass(token: string): string {
  if (/^"/.test(token)) return /:\s*$/.test(token) ? "text-chart-2" : "text-primary"
  if (/^(true|false|null)$/.test(token)) return "text-chart-4"
  if (/^-?\d/.test(token)) return "text-chart-3"
  return "text-foreground"
}

// AI : inline JSON token coloring — shared by JsonHighlight and server log lines.
export function InlineJsonTokens({ text }: { text: string }) {
  const tokens = text.split(JSON_TOKEN_RE)
  return (
    <>
      {tokens.map((t, i) =>
        t ? (
          <span key={i} className={jsonTokenClass(t)}>
            {t}
          </span>
        ) : null,
      )}
    </>
  )
}

// Lightweight JSON syntax highlighter for log/output views.
export function JsonHighlight({ json }: { json: string }) {
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        <InlineJsonTokens text={json} />
      </code>
    </pre>
  )
}

type field_path_string = string

const JSON_INDENT = "  "

// AI : legend for testing views — matches structure tab "=" / "≈" badges.
export function JsonFieldKindLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-sm bg-chart-2/15 px-1.5 py-0.5 text-chart-2">=</span>
        deterministic — exact match
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-sm bg-chart-3/15 px-1.5 py-0.5 text-chart-3">≈</span>
        probabilistic — LLM-checked
      </span>
    </div>
  )
}

function JsonLeafValue({
  value,
  path,
  probabilisticPaths,
}: {
  value: unknown
  path: field_path_string
  probabilisticPaths: field_path_string[]
}) {
  const isProb = isProbabilisticFieldPath(path, probabilisticPaths)
  const text = JSON.stringify(value)
  return (
    <span
      className={cn(
        "rounded-sm px-0.5",
        isProb ? "bg-chart-3/15" : "bg-chart-2/10",
      )}
      title={isProb ? "probabilistic — excluded from exact compare, LLM-checked" : "deterministic — exact compare"}
    >
      <InlineJsonTokens text={text} />
    </span>
  )
}

function JsonFieldKindNode({
  value,
  path,
  probabilisticPaths,
  depth,
}: {
  value: unknown
  path: field_path_string
  probabilisticPaths: field_path_string[]
  depth: number
}) {
  const pad = JSON_INDENT.repeat(depth)
  const inner = JSON_INDENT.repeat(depth + 1)

  if (value === null || typeof value !== "object") {
    return <JsonLeafValue value={value} path={path} probabilisticPaths={probabilisticPaths} />
  }

  if (Array.isArray(value)) {
    if (!value.length) return <InlineJsonTokens text="[]" />
    return (
      <>
        {"[\n"}
        {value.map((item, i) => {
          const childPath = path ? `${path}[${i}]` : `[${i}]`
          return (
            <span key={i}>
              {inner}
              <JsonFieldKindNode
                value={item}
                path={childPath}
                probabilisticPaths={probabilisticPaths}
                depth={depth + 1}
              />
              {i < value.length - 1 ? "," : ""}
              {"\n"}
            </span>
          )
        })}
        {pad}
        {"]"}
      </>
    )
  }

  const entries = Object.entries(value as Record<string, unknown>)
  if (!entries.length) return <InlineJsonTokens text="{}" />
  return (
    <>
      {"{\n"}
      {entries.map(([k, v], i) => {
        const childPath = path ? `${path}.${k}` : k
        return (
          <span key={k}>
            {inner}
            <span className="text-chart-2">&quot;{k}&quot;</span>
            {": "}
            <JsonFieldKindNode
              value={v}
              path={childPath}
              probabilisticPaths={probabilisticPaths}
              depth={depth + 1}
            />
            {i < entries.length - 1 ? "," : ""}
            {"\n"}
          </span>
        )
      })}
      {pad}
      {"}"}
    </>
  )
}

// AI : structure-aware JSON view — leaf values tinted by ModelField.deterministic on the step output type.
export function JsonFieldKindHighlight({
  json,
  probabilisticPaths,
}: {
  json: string
  probabilisticPaths: field_path_string[]
}) {
  const parsed = tryParseJson(json, { trim: true })
  if (!parsed.ok) return <JsonHighlight json={json} />
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        <JsonFieldKindNode value={parsed.value} path="" probabilisticPaths={probabilisticPaths} depth={0} />
      </code>
    </pre>
  )
}

const LOG_PREFIX_RE =
  /^(\[\d{2}:\d{2}:\d{2}\.\d{3}\]) (\[(?:DEBUG|INFO|WARN|ERROR)\]) (\[[^\]]+\]) (.*)$/

const LOG_LEVEL_CLASS: Record<JobLogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground/80",
  warn: "text-yellow-500",
  error: "text-destructive",
}

function logMessageBody(line: string, tag: string): string {
  const needle = `] [${tag}] `
  const idx = line.indexOf(needle)
  return idx >= 0 ? line.slice(idx + needle.length) : line
}

// AI : [time] [LEVEL] [tag] message — structural colors only; body stays plain readable text.
export function ServerLogLineHighlight({ line, level, tag }: { line: string; level: JobLogLevel; tag: string }) {
  const m = line.match(LOG_PREFIX_RE)
  if (!m) {
    return <span className={LOG_LEVEL_CLASS[level]}>{line}</span>
  }
  const [, ts, levelBracket, tagBracket, bodyFromLine] = m
  const body = bodyFromLine || logMessageBody(line, tag)
  const parsedLevel = levelBracket.slice(1, -1).toLowerCase() as JobLogLevel
  return (
    <span>
      <span className="text-muted-foreground/60">{ts} </span>
      <span className={LOG_LEVEL_CLASS[parsedLevel] ?? LOG_LEVEL_CLASS[level]}>{levelBracket} </span>
      <span className="text-muted-foreground/80">{tagBracket} </span>
      {body && <span className="text-foreground/90">{body}</span>}
    </span>
  )
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 className="mb-2 text-base font-semibold text-foreground">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 mt-4 text-sm font-semibold text-foreground">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-medium text-foreground">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-2 text-xs font-medium text-foreground">{children}</h4>,
  p: ({ children }) => <p className="mb-2 text-muted-foreground">{children}</p>,
  strong: ({ children }) => <strong className="font-medium text-foreground">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className="font-mono text-[11px] text-primary">{children}</code>
    ) : (
      <code className="rounded bg-secondary px-1 font-mono text-[11px] text-primary">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded border border-border bg-secondary/50 p-2 font-mono text-[11px] text-primary">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-2 py-1 text-left font-medium text-foreground">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 text-muted-foreground">{children}</td>,
}

export function MarkdownView({ md }: { md: string }) {
  return (
    <div className="text-xs leading-relaxed text-foreground">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {md}
      </ReactMarkdown>
    </div>
  )
}

// Render prompt text with embedded JSON blobs syntax-highlighted inline.
export function PromptText({ text, sourceDocId }: { text: string; sourceDocId?: DocId }) {
  const parts = splitJsonSegments(text)
  return (
    <>
      {parts.map((p, i) =>
        p.isJson ? (
          <span key={i} className="my-1 block rounded border border-border bg-[oklch(0.14_0.004_264)] p-2">
            <JsonHighlight json={p.text} />
          </span>
        ) : (
          <PlainPromptSegment key={i} text={p.text} sourceDocId={sourceDocId} />
        ),
      )}
    </>
  )
}

type SourceDocHeader = { docId?: DocId; charCount?: number; label: string }

// AI : parse doc id from SOURCE DOCUMENT (sha_…, N chars): headers stored in run logs.
function parseSourceDocHeader(header: string): SourceDocHeader {
  const withMeta = header.match(/^SOURCE DOCUMENT \(([^,)]+)(?:, (\d+) chars)?\):$/)
  if (withMeta) {
    return {
      docId: withMeta[1] as DocId,
      charCount: withMeta[2] ? +withMeta[2] : undefined,
      label: header,
    }
  }
  return { label: header }
}

// AI : highlight SOURCE DOCUMENT blocks in LLM prompts and Link Quotes step input.
function PlainPromptSegment({ text, sourceDocId }: { text: string; sourceDocId?: DocId }) {
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
      <SourceDocumentBlock header={header} body={body} sourceDocId={sourceDocId} />
      {after}
    </span>
  )
}

function SourceDocumentBlock({
  header,
  body,
  sourceDocId,
}: {
  header: string
  body: string
  sourceDocId?: DocId
}) {
  const { open } = useDocViewer()
  const parsed = parseSourceDocHeader(header)
  const docId = parsed.docId ?? sourceDocId

  function openDoc() {
    if (!docId) return
    open({ docId, start: 0, end: 0 })
  }

  return (
    <span className="my-1 block rounded border border-chart-2/40 bg-chart-2/10 p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {docId ? (
          <button
            type="button"
            onClick={openDoc}
            className="font-mono text-[10px] font-semibold uppercase tracking-wide text-chart-2 hover:underline"
            title={`Open source document ${docId}`}
          >
            SOURCE DOCUMENT ({docId}
            {parsed.charCount != null ? `, ${parsed.charCount} chars` : ""}):
          </button>
        ) : (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-chart-2">
            {parsed.label}
          </span>
        )}
        {docId && (
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={openDoc}
              className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline"
            >
              <Link2 className="h-3 w-3" />
              view original
            </button>
            <OpenInDocumentsLink docId={docId} label="documents" />
          </span>
        )}
      </div>
      <span className="mt-1 block whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
        {body.trimEnd()}
      </span>
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
