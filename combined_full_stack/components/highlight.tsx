"use client"

// AI : TODO (spec) — store prompts as JSON components; flatten only when sending to OpenRouter; profile context-length per component.
import { useMemo, Children, isValidElement, type ReactNode } from "react"
import { Link2 } from "lucide-react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeSanitize, { defaultSchema } from "rehype-sanitize"
import type { Schema } from "hast-util-sanitize"
import "katex/dist/katex.min.css"
import { MermaidBlock } from "@/components/mermaid-block"
import { TikzBlock } from "@/components/tikz-block"
import { OpenInDocumentsLink } from "@/components/open-in-documents"
import { useDocViewer } from "@/lib/doc-viewer"
import { normalizeTestJson, stablePrettyJson } from "@/lib/deep_equal"
import { tryParseJson } from "@/lib/json-utils"
import { latexSourceToPreviewMarkdown } from "@/lib/latex-preview"
import { MarkupKind } from "@/lib/markup-kinds"
import { validateMarkup } from "@/lib/markup-validate"
import {
  assignPathsToPrettyLines,
  prettyJsonLineCompareComment,
  valueAtJsonPath,
} from "@/lib/json-pretty-lines"
import { isProbabilisticFieldPath, isProbabilisticReferenceValue, toleranceForFieldPath } from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import type { DocId, JobLogLevel, TolerantFieldPath } from "@/lib/types"

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
  const tokens = (text ?? "").split(JSON_TOKEN_RE)
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
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-sm bg-output/20 px-1.5 py-0.5 text-output ring-1 ring-output/35">±</span>
        tolerant — numeric ± compare
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded-sm border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-muted-foreground">
          −
        </span>
        not checked — reference omitted
      </span>
    </div>
  )
}

function JsonLeafValue({
  value,
  path,
  probabilisticPaths,
  probabilisticCheckedPaths,
  tolerantPaths = [],
}: {
  value: unknown
  path: field_path_string
  probabilisticPaths: field_path_string[]
  probabilisticCheckedPaths?: field_path_string[]
  tolerantPaths?: TolerantFieldPath[]
}) {
  const isProb = isProbabilisticFieldPath(path, probabilisticPaths)
  const tolerance = toleranceForFieldPath(path, tolerantPaths)
  const isTolerant = tolerance !== undefined
  const text = jsonLeafDisplayText(value)
  const llmChecked = isProb
    ? probabilisticCheckedPaths !== undefined
      ? isProbabilisticFieldPath(path, probabilisticCheckedPaths)
      : isProbabilisticReferenceValue(value)
    : false
  return (
    <span
      className={cn(
        "rounded-sm px-0.5",
        !isProb && !isTolerant && "bg-chart-2/10",
        llmChecked && "bg-chart-3/15",
        isProb && !llmChecked && "border border-dashed border-muted-foreground/40",
        isTolerant && "bg-output/15 ring-1 ring-output/35",
      )}
      title={
        isTolerant
          ? `tolerant — ${text}±${tolerance} (±${tolerance} on int/float compare)`
          : !isProb
            ? "deterministic — exact compare"
            : llmChecked
              ? "probabilistic — excluded from exact compare, LLM-checked"
              : "probabilistic — not checked (no expected reference)"
      }
    >
      <InlineJsonTokens text={text} />
      {isTolerant && (
        <span className="font-mono text-[9px] font-semibold text-output">±{tolerance}</span>
      )}
    </span>
  )
}

function JsonFieldKindNode({
  value,
  path,
  probabilisticPaths,
  probabilisticCheckedPaths,
  tolerantPaths = [],
  depth,
}: {
  value: unknown
  path: field_path_string
  probabilisticPaths: field_path_string[]
  probabilisticCheckedPaths?: field_path_string[]
  tolerantPaths?: TolerantFieldPath[]
  depth: number
}) {
  const pad = JSON_INDENT.repeat(depth)
  const inner = JSON_INDENT.repeat(depth + 1)

  if (value === null || typeof value !== "object") {
    return (
      <JsonLeafValue
        value={value}
        path={path}
        probabilisticPaths={probabilisticPaths}
        probabilisticCheckedPaths={probabilisticCheckedPaths}
        tolerantPaths={tolerantPaths}
      />
    )
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
                probabilisticCheckedPaths={probabilisticCheckedPaths}
                tolerantPaths={tolerantPaths}
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
        const tol = toleranceForFieldPath(childPath, tolerantPaths)
        return (
          <span key={k}>
            {inner}
            <span className={cn(tol !== undefined ? "text-output" : "text-chart-2")}>&quot;{k}&quot;</span>
            {": "}
            <JsonFieldKindNode
              value={v}
              path={childPath}
              probabilisticPaths={probabilisticPaths}
              probabilisticCheckedPaths={probabilisticCheckedPaths}
              tolerantPaths={tolerantPaths}
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

const PRETTY_KEY_VALUE_LINE_RE = /^(\s*)"((?:\\.|[^"\\])*)"\s*:\s*(.*?)(,?)$/

function jsonLeafDisplayText(value: unknown): string {
  const text = JSON.stringify(value)
  return text ?? "undefined"
}

function leafValueAtPath(root: unknown, path: field_path_string, lineFragment: string): unknown {
  const atPath = valueAtJsonPath(root, path)
  if (atPath !== undefined) return atPath
  const parsed = tryParseJson(lineFragment.trim().replace(/,$/, ""))
  return parsed.ok ? parsed.value : atPath
}

function PrettyJsonLineContent({
  line,
  path,
  root,
  probabilisticPaths,
  probabilisticCheckedPaths,
  tolerantPaths = [],
}: {
  line: string
  path: field_path_string | undefined
  root: unknown
  probabilisticPaths: field_path_string[]
  probabilisticCheckedPaths?: field_path_string[]
  tolerantPaths?: TolerantFieldPath[]
}) {
  const keyVal = line.match(PRETTY_KEY_VALUE_LINE_RE)
  if (keyVal && path) {
    const [, indent, keyEsc, valuePart, comma] = keyVal
    const key = JSON.parse(`"${keyEsc}"`) as string
    const rest = valuePart.trim()
    const tol = toleranceForFieldPath(path, tolerantPaths)
    if (rest === "{" || rest === "[" || rest === "{," || rest === "[,") {
      return <InlineJsonTokens text={line} />
    }
    return (
      <>
        {indent}
        <span className={cn(tol !== undefined ? "text-output" : "text-chart-2")}>&quot;{key}&quot;</span>
        {": "}
        <JsonLeafValue
          value={leafValueAtPath(root, path, rest)}
          path={path}
          probabilisticPaths={probabilisticPaths}
          probabilisticCheckedPaths={probabilisticCheckedPaths}
          tolerantPaths={tolerantPaths}
        />
        {comma ?? ""}
      </>
    )
  }

  if (path) {
    const indent = line.slice(0, line.length - line.trimStart().length)
    const body = line.trim().replace(/,$/, "")
    if (body !== "{" && body !== "[" && body !== "}" && body !== "]") {
      return (
        <>
          {indent}
          <JsonLeafValue
            value={leafValueAtPath(root, path, body)}
            path={path}
            probabilisticPaths={probabilisticPaths}
            probabilisticCheckedPaths={probabilisticCheckedPaths}
            tolerantPaths={tolerantPaths}
          />
          {line.endsWith(",") ? "," : ""}
        </>
      )
    }
  }

  return <InlineJsonTokens text={line} />
}

function JsonFieldKindLineView({
  root,
  lines,
  differingLineIndexes,
  pairedLines,
  probabilisticPaths,
  probabilisticCheckedPaths,
  tolerantPaths = [],
  diffExplanations,
}: {
  root: unknown
  lines: string[]
  differingLineIndexes: ReadonlySet<number>
  // AI : same-index lines from the other compare pane — used for // not "…" copy hints.
  pairedLines?: string[]
  probabilisticPaths: field_path_string[]
  probabilisticCheckedPaths?: field_path_string[]
  tolerantPaths?: TolerantFieldPath[]
  diffExplanations?: ReadonlyMap<field_path_string, string>
}) {
  const paths = useMemo(() => assignPathsToPrettyLines(lines), [lines])
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        {lines.map((line, i) => {
          const paired = pairedLines?.[i]
          const path = paths[i]
          const isProb = path ? isProbabilisticFieldPath(path, probabilisticPaths) : false
          const showMismatch = differingLineIndexes.has(i) && !isProb
          const notComment =
            showMismatch && paired !== undefined ? prettyJsonLineCompareComment(paired) : undefined
          const explanation = showMismatch && path ? diffExplanations?.get(path) : undefined
          return (
            <span
              key={i}
              className={cn("block whitespace-pre", showMismatch && "bg-destructive/15")}
            >
              <PrettyJsonLineContent
                line={line}
                path={path}
                root={root}
                probabilisticPaths={probabilisticPaths}
                probabilisticCheckedPaths={probabilisticCheckedPaths}
                tolerantPaths={tolerantPaths}
              />
              {notComment !== undefined && (
                <span className="text-muted-foreground/75">{` // not "${notComment}"`}</span>
              )}
              {explanation && (
                <span className="text-destructive/80">{` // because: ${explanation}`}</span>
              )}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

// AI : structure-aware JSON view — leaf values tinted by ModelField.deterministic on the step output type.
export function JsonFieldKindHighlight({
  json,
  probabilisticPaths,
  probabilisticCheckedPaths,
  tolerantPaths = [],
  differingLineIndexes,
  pairedLines,
  diffExplanations,
}: {
  json: string
  probabilisticPaths: field_path_string[]
  probabilisticCheckedPaths?: field_path_string[]
  tolerantPaths?: TolerantFieldPath[]
  // AI : when set, render line-by-line with red row bg on indexes that differ from the paired side.
  differingLineIndexes?: ReadonlySet<number>
  pairedLines?: string[]
  diffExplanations?: ReadonlyMap<field_path_string, string>
}) {
  const parsed = tryParseJson(json, { trim: true })
  if (!parsed.ok) return <JsonHighlight json={json} />
  const normalized = normalizeTestJson(parsed.value)
  if (differingLineIndexes) {
    const lines = stablePrettyJson(normalized).split("\n")
    return (
      <JsonFieldKindLineView
        root={normalized}
        lines={lines}
        differingLineIndexes={differingLineIndexes}
        pairedLines={pairedLines}
        probabilisticPaths={probabilisticPaths}
        probabilisticCheckedPaths={probabilisticCheckedPaths}
        tolerantPaths={tolerantPaths}
        diffExplanations={diffExplanations}
      />
    )
  }
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        <JsonFieldKindNode
          value={normalized}
          path=""
          probabilisticPaths={probabilisticPaths}
          probabilisticCheckedPaths={probabilisticCheckedPaths}
          tolerantPaths={tolerantPaths}
          depth={0}
        />
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

function isSafeMarkdownHref(href: string | undefined): href is string {
  if (!href) return false
  const trimmed = href.trim()
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true
  return /^(https?:|mailto:)/i.test(trimmed)
}

function isSafeImageSrc(src: string | undefined): src is string {
  if (!src) return false
  const trimmed = src.trim()
  if (trimmed.startsWith("data:image/")) return /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed)
  return /^https?:/i.test(trimmed)
}

// AI : allow KaTeX output through sanitize (runs after rehype-katex).
const katexSanitizeSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), ["className"], ["class"], ["style"]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className"], ["class"], ["style"], ["ariaHidden"], ["aria-hidden"]],
    math: [["xmlns"], ["display"]],
    annotation: [["encoding"]],
    semantics: [],
    mrow: [],
    mi: [],
    mo: [],
    mn: [],
    msup: [],
    msub: [],
    msubsup: [],
    mfrac: [],
    msqrt: [],
    mroot: [],
    mtext: [],
    mspace: [["width"]],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "msubsup",
    "mfrac",
    "msqrt",
    "mroot",
    "mtext",
    "mspace",
  ],
}

function mermaidChartFromCodeChildren(children: ReactNode): string {
  return String(children ?? "")
    .replace(/\n$/, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function isMermaidCode(className: string | undefined): boolean {
  return /(?:^|\s)language-mermaid(?:\s|$)/.test(className ?? "")
}

function isTikzCode(className: string | undefined): boolean {
  return /(?:^|\s)language-tikz(?:\s|$)/.test(className ?? "")
  // AI : TODO (media-view-A-registry) — TikZ string sniff is latex-in-JSON only. Do not add audio/video/glb regex here.
}

function isDiagramCodeElement(el: ReactNode): boolean {
  return isValidElement(el) && (el.type === MermaidBlock || el.type === TikzBlock)
}

function makeMarkdownComponents(inverted: boolean): Components {
  const base = inverted ? invertedMarkdownComponentsBase : markdownComponentsBase
  return {
    ...base,
    code: (props) => {
      const { className, children } = props
      if (isMermaidCode(className)) {
        return <MermaidBlock chart={mermaidChartFromCodeChildren(children)} inverted={inverted} />
      }
      if (isTikzCode(className)) {
        return <TikzBlock source={mermaidChartFromCodeChildren(children)} inverted={inverted} />
      }
      if (inverted) {
        return className ? (
          <code className="font-mono text-[11px] text-white">{children}</code>
        ) : (
          <code className="rounded bg-neutral-900 px-1 font-mono text-[11px] text-white">{children}</code>
        )
      }
      return className ? (
        <code className="font-mono text-[11px] text-primary">{children}</code>
      ) : (
        <code className="rounded bg-secondary px-1 font-mono text-[11px] text-primary">{children}</code>
      )
    },
    pre: (props) => {
      const { children } = props
      const only = Children.count(children) === 1 ? Children.only(children) : null
      if (isDiagramCodeElement(only)) return only
      if (inverted) {
        return (
          <pre className="mb-2 overflow-x-auto rounded border border-neutral-700 bg-neutral-900 p-2 font-mono text-[11px] text-white">
            {children}
          </pre>
        )
      }
      return (
        <pre className="mb-2 overflow-x-auto rounded border border-border bg-secondary/50 p-2 font-mono text-[11px] text-primary">
          {children}
        </pre>
      )
    },
  }
}

const markdownComponentsBase: Components = {
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
  a: ({ href, children }) =>
    isSafeMarkdownHref(href) ? (
      <a href={href} className="text-primary underline-offset-2 hover:underline" target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ) : (
      <span className="text-muted-foreground">{children}</span>
    ),
  img: ({ src, alt }) => {
    const srcStr = typeof src === "string" ? src : undefined
    return isSafeImageSrc(srcStr) ? (
      // eslint-disable-next-line @next/next/no-img-element -- markdown user content; src allowlisted above
      <img src={srcStr} alt={alt ?? ""} className="my-2 max-w-full rounded border border-border" loading="lazy" />
    ) : null
  },
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

const invertedMarkdownComponentsBase: Components = {
  h1: ({ children }) => <h1 className="mb-2 text-base font-semibold text-white">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1.5 mt-4 text-sm font-semibold text-white">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-3 text-sm font-medium text-white">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-2 text-xs font-medium text-white">{children}</h4>,
  p: ({ children }) => <p className="mb-2 text-neutral-300">{children}</p>,
  strong: ({ children }) => <strong className="font-medium text-white">{children}</strong>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 text-neutral-300">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 text-neutral-300">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-neutral-500 pl-3 text-neutral-400">{children}</blockquote>
  ),
  hr: () => <hr className="my-4 border-neutral-700" />,
  a: ({ href, children }) =>
    isSafeMarkdownHref(href) ? (
      <a href={href} className="text-white underline-offset-2 hover:underline" target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    ) : (
      <span className="text-neutral-400">{children}</span>
    ),
  img: ({ src, alt }) => {
    const srcStr = typeof src === "string" ? src : undefined
    return isSafeImageSrc(srcStr) ? (
      // eslint-disable-next-line @next/next/no-img-element -- markdown user content; src allowlisted above
      <img src={srcStr} alt={alt ?? ""} className="my-2 max-w-full rounded border border-neutral-700" loading="lazy" />
    ) : null
  },
  code: ({ className, children }) =>
    className ? (
      <code className="font-mono text-[11px] text-white">{children}</code>
    ) : (
      <code className="rounded bg-neutral-900 px-1 font-mono text-[11px] text-white">{children}</code>
    ),
  pre: ({ children }) => (
    <pre className="mb-2 overflow-x-auto rounded border border-neutral-700 bg-neutral-900 p-2 font-mono text-[11px] text-white">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-3 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-neutral-900">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-neutral-700 px-2 py-1 text-left font-medium text-white">{children}</th>
  ),
  td: ({ children }) => <td className="border border-neutral-700 px-2 py-1 text-neutral-300">{children}</td>,
}

export function MarkdownView({ md, inverted = false }: { md: string; inverted?: boolean }) {
  const components = useMemo(() => makeMarkdownComponents(inverted), [inverted])
  return (
    <div className={cn("text-xs leading-relaxed", inverted ? "text-white" : "text-foreground")}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeSanitize, katexSanitizeSchema]]}
        components={components}
      >
        {md}
      </ReactMarkdown>
    </div>
  )
}

function MarkupIssuesBanner({ issues }: { issues: ReturnType<typeof validateMarkup>["issues"] }) {
  if (!issues.length) return null
  return (
    <ul className="mb-3 space-y-1 rounded border border-border bg-secondary/40 px-2 py-1.5 font-mono text-[10px]">
      {issues.map((issue, i) => (
        <li
          key={`${issue.message}-${i}`}
          className={issue.severity === "error" ? "text-destructive" : "text-chart-3"}
        >
          {issue.severity}
          {issue.line != null ? ` L${issue.line}` : ""}: {issue.message}
        </li>
      ))}
    </ul>
  )
}

// AI : generic formatted view — markdown (GFM+math+mermaid) or latex (validate + KaTeX preview).
export function MarkupView({
  kind,
  source,
  inverted = false,
}: {
  kind: MarkupKind
  source: string
  inverted?: boolean
}) {
  const checked = useMemo(() => validateMarkup(kind, source), [kind, source])
  const md = useMemo(
    () => (kind === MarkupKind.Latex ? latexSourceToPreviewMarkdown(source) : source),
    [kind, source],
  )
  return (
    <div>
      <MarkupIssuesBanner issues={checked.issues} />
      <MarkdownView md={md} inverted={inverted} />
    </div>
  )
}

export function markupViewKindOrMarkdown(kind: MarkupKind | null | undefined): MarkupKind {
  return kind ?? MarkupKind.Markdown
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
