"use client"

import "@/lib/monaco-loader"
import dynamic from "next/dynamic"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import type { editor } from "monaco-editor"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type CodeViewerLanguage = "python" | "typescript" | "rust"

export const CODE_VIEWER_LANGUAGES: CodeViewerLanguage[] = ["python", "typescript", "rust"]

export const CODE_LANG_LABEL: Record<CodeViewerLanguage, string> = {
  python: "Python",
  typescript: "TypeScript",
  rust: "Rust",
}

export const CODE_LANG_LINT_HINT: Record<CodeViewerLanguage, string> = {
  python: "pyright",
  typescript: "tsc",
  rust: "cargo check",
}

export const MONACO_CODE_THEME = "vs-dark" as const

const CODE_VIEWER_BG = "bg-[oklch(0.14_0.004_264)]"

export function monacoLanguageId(language: CodeViewerLanguage | string): string {
  return language
}

export function buildMonacoCodeOptions({
  readOnly = false,
  compact = false,
  wordWrap = compact ? "on" : "off",
}: {
  readOnly?: boolean
  compact?: boolean
  wordWrap?: "on" | "off"
} = {}): editor.IStandaloneEditorConstructionOptions {
  return {
    readOnly,
    fontSize: compact ? 11 : 12,
    fontFamily: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace",
    lineNumbers: "on",
    minimap: { enabled: !compact },
    scrollBeyondLastLine: false,
    wordWrap,
    automaticLayout: true,
    padding: compact ? { top: 8, bottom: 8 } : { top: 12, bottom: 12 },
    overviewRulerLanes: compact ? 0 : 3,
    hideCursorInOverviewRuler: compact,
    scrollbar: {
      verticalScrollbarSize: compact ? 8 : 10,
      horizontalScrollbarSize: compact ? 8 : 10,
    },
    tabSize: 2,
    renderLineHighlight: compact ? "none" : "line",
    folding: true,
    bracketPairColorization: { enabled: true },
  }
}

function MonacoLoading({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center font-mono text-muted-foreground",
        compact ? "min-h-24 text-[10px]" : "flex-1 text-xs",
      )}
    >
      Loading editor…
    </div>
  )
}

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <MonacoLoading />,
})

export type MonacoCodeEditorProps = {
  value: string
  language: CodeViewerLanguage | string
  readOnly?: boolean
  compact?: boolean
  height?: string
  wordWrap?: "on" | "off"
  onChange?: (value: string) => void
  className?: string
}

export function MonacoCodeEditor({
  value,
  language,
  readOnly = false,
  compact = false,
  height = compact ? "96px" : "100%",
  wordWrap,
  onChange,
  className,
}: MonacoCodeEditorProps) {
  return (
    <div className={cn(compact ? undefined : "min-h-0 flex-1", className)}>
      <MonacoEditor
        height={height}
        language={monacoLanguageId(language)}
        value={value}
        theme={MONACO_CODE_THEME}
        onChange={readOnly ? undefined : (next) => onChange?.(next ?? "")}
        options={buildMonacoCodeOptions({ readOnly, compact, wordWrap })}
      />
    </div>
  )
}

type SwitchVariant = "segment" | "pill"

export function CodeLanguageSwitch<T extends string>({
  value,
  onChange,
  options,
  variant = "segment",
  label = "Language",
}: {
  value: T
  onChange: (next: T) => void
  options: { id: T; label: string; title?: string }[]
  variant?: SwitchVariant
  label?: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {variant === "segment" ? (
        <div className="flex rounded-md border border-border p-0.5">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.title ?? opt.label}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded px-2.5 py-1 font-mono text-[10px] transition-colors",
                value === opt.id
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.title ?? opt.label}
              onClick={() => onChange(opt.id)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
                value === opt.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CodeFileTabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T
  onChange: (next: T) => void
  tabs: { id: T; label: string; sublabel?: string }[]
}) {
  return (
    <div className="flex border-b border-border px-4">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "border-b-2 px-3 py-2 font-mono text-[10px] transition-colors",
            value === tab.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.sublabel && <span className="ml-1.5 text-muted-foreground">{tab.sublabel}</span>}
        </button>
      ))}
    </div>
  )
}

export function ReadonlyCodeViewer({
  value,
  language,
  filename,
  badge = "generated",
  header,
  className,
}: {
  value: string
  language: CodeViewerLanguage | string
  filename?: string
  badge?: string
  header?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", CODE_VIEWER_BG, className)}>
      {(header || filename || badge) && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          {header ?? <span />}
          <div className="flex items-center gap-2">
            {filename && (
              <span className="font-mono text-[11px] text-muted-foreground">{filename}</span>
            )}
            {badge && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {badge}
              </Badge>
            )}
          </div>
        </div>
      )}
      <MonacoCodeEditor value={value} language={language} readOnly />
    </div>
  )
}

export type MultiLangCodeSource = {
  language: CodeViewerLanguage
  label: string
  filename: string
  content: string
}

export function MultiLangReadonlyCodeViewer({
  sources,
  defaultLanguage = "python",
  badge = "generated",
  switchVariant = "segment",
  className,
}: {
  sources: MultiLangCodeSource[]
  defaultLanguage?: CodeViewerLanguage
  badge?: string
  switchVariant?: SwitchVariant
  className?: string
}) {
  const langIds = useMemo(() => new Set(sources.map((s) => s.language)), [sources])
  const [lang, setLang] = useState<CodeViewerLanguage>(() =>
    langIds.has(defaultLanguage) ? defaultLanguage : (sources[0]?.language ?? "python"),
  )

  useEffect(() => {
    if (!langIds.has(lang) && sources[0]) setLang(sources[0].language)
  }, [lang, langIds, sources])

  const active = sources.find((s) => s.language === lang) ?? sources[0]!
  const langOptions = sources.map((s) => ({ id: s.language, label: s.label }))

  return (
    <ReadonlyCodeViewer
      value={active.content}
      language={active.language}
      filename={active.filename}
      badge={badge}
      className={className}
      header={
        <CodeLanguageSwitch
          value={lang}
          onChange={setLang}
          options={langOptions}
          variant={switchVariant}
        />
      }
    />
  )
}
