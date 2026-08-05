"use client"

import { useEffect, useState } from "react"
import { loader } from "@monaco-editor/react"
import type { Monaco } from "@monaco-editor/react"
import "@/lib/monaco-loader"
import { ensureMonacoTypeScriptEnv } from "@/lib/monaco-loader"
import { CustomCodeLanguage } from "@/lib/types"

export const CODE_LANG_SHORT: Record<CustomCodeLanguage, string> = {
  [CustomCodeLanguage.TypeScript]: "TS",
  [CustomCodeLanguage.Python]: "PY",
}

export const CODE_LANG_NAME: Record<CustomCodeLanguage, string> = {
  [CustomCodeLanguage.TypeScript]: "TypeScript",
  [CustomCodeLanguage.Python]: "Python",
}

// AI : VS Code Dark+ palette for inline previews (no mtk CSS dependency).
const DEFAULT_FG = "#d4d4d4"
const SCOPE_COLORS: { pattern: RegExp; color: string }[] = [
  { pattern: /comment/, color: "#6a9955" },
  { pattern: /string|regexp/, color: "#ce9178" },
  { pattern: /keyword|storage\.type|storage\.modifier/, color: "#569cd6" },
  { pattern: /number|constant\.numeric/, color: "#b5cea8" },
  { pattern: /type\.|entity\.name\.type|support\.type/, color: "#4ec9b0" },
  { pattern: /entity\.name\.function|support\.function|meta\.function-call/, color: "#dcdcaa" },
  { pattern: /entity\.name\.tag/, color: "#569cd6" },
  { pattern: /variable\.language|support\.class|constant\.language/, color: "#569cd6" },
  { pattern: /variable|parameter|identifier/, color: "#9cdcfe" },
  { pattern: /constant/, color: "#4fc1ff" },
]

export type syntax_span = { text: string; color: string }

type monaco_token = { startIndex: number; scopes?: string; type?: string }

function monacoLanguageId(language: CustomCodeLanguage): string {
  return language === CustomCodeLanguage.Python ? "python" : "typescript"
}

function tokenScopes(token: monaco_token): string {
  return token.scopes ?? token.type ?? ""
}

function scopeColor(scopes: string): string {
  if (!scopes) return DEFAULT_FG
  for (const { pattern, color } of SCOPE_COLORS) {
    if (pattern.test(scopes)) return color
  }
  return DEFAULT_FG
}

function lineSpans(line: string, tokens: monaco_token[]): syntax_span[] {
  if (!line) return []
  if (!tokens.length) return [{ text: line, color: DEFAULT_FG }]

  const spans: syntax_span[] = []
  if (tokens[0].startIndex > 0) {
    spans.push({ text: line.slice(0, tokens[0].startIndex), color: DEFAULT_FG })
  }
  for (let i = 0; i < tokens.length; i++) {
    const start = tokens[i].startIndex
    const end = i + 1 < tokens.length ? tokens[i + 1].startIndex : line.length
    const text = line.slice(start, end)
    if (!text) continue
    spans.push({ text, color: scopeColor(tokenScopes(tokens[i])) })
  }
  return spans
}

function highlightWithMonaco(monaco: Monaco, code: string, language: CustomCodeLanguage): syntax_span[][] {
  const sourceLines = code.split("\n")
  const tokenLines = monaco.editor.tokenize(code, monacoLanguageId(language)) as monaco_token[][]
  return sourceLines.map((line, i) => lineSpans(line, tokenLines[i] ?? []))
}

let monacoReady: Promise<Monaco> | null = null

function getMonaco(): Promise<Monaco> {
  if (!monacoReady) {
    monacoReady = loader.init().then((monaco) => {
      ensureMonacoTypeScriptEnv(monaco)
      return monaco
    })
  }
  return monacoReady
}

export function useMonacoSyntaxLines(code: string, language: CustomCodeLanguage): syntax_span[][] | null {
  const [lines, setLines] = useState<syntax_span[][] | null>(null)

  useEffect(() => {
    let cancelled = false
    void getMonaco().then((monaco) => {
      const highlighted = highlightWithMonaco(monaco, code, language)
      if (!cancelled) setLines(highlighted)
    })
    return () => {
      cancelled = true
    }
  }, [code, language])

  return lines
}

export function MonacoSyntaxLine({
  spans,
  fallback,
}: {
  spans: syntax_span[] | undefined
  fallback: string
}) {
  const rendered = spans ?? [{ text: fallback, color: DEFAULT_FG }]
  return (
    <>
      {rendered.map((span, i) => (
        <span key={i} style={{ color: span.color }}>
          {span.text}
        </span>
      ))}
    </>
  )
}
