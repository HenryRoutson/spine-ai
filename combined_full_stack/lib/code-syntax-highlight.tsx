"use client"

import { useEffect, useState } from "react"
import { loader } from "@monaco-editor/react"
import type { Monaco } from "@monaco-editor/react"
import "@/lib/monaco-loader"
import { ensureMonacoTypeScriptEnv } from "@/lib/monaco-loader"
import { MONACO_VS_DARK_THEME } from "@/lib/monaco-theme"
import { CustomCodeLanguage } from "@/lib/types"

export const CODE_LANG_SHORT: Record<CustomCodeLanguage, string> = {
  [CustomCodeLanguage.TypeScript]: "TS",
  [CustomCodeLanguage.Python]: "PY",
}

export const CODE_LANG_NAME: Record<CustomCodeLanguage, string> = {
  [CustomCodeLanguage.TypeScript]: "TypeScript",
  [CustomCodeLanguage.Python]: "Python",
}

const DEFAULT_FG = "#d4d4d4"
// AI : matches StepCodeExecPreview background — colorize resolves mtk classes against this theme.

export type syntax_span = { text: string; color: string }

let mtkClassColors: Map<string, string> | null = null

// AI : colorize emits mtk* class names — sample once under vs-dark to map class → rgb() without mtk CSS.
async function getMtkClassColors(monaco: Monaco): Promise<Map<string, string>> {
  if (mtkClassColors) return mtkClassColors
  monaco.editor.setTheme(MONACO_VS_DARK_THEME)
  const sample = await monaco.editor.colorize(
    'const fn: string = "y"; if (true) return null; throw new Error("x"); // c',
    "typescript",
    { theme: MONACO_VS_DARK_THEME },
  )
  const host = document.createElement("div")
  host.className = `monaco-editor ${MONACO_VS_DARK_THEME}`
  host.style.cssText = "position:fixed;left:-9999px;top:0;visibility:hidden"
  host.innerHTML = sample.replace(/<br\s*\/?>$/i, "")
  document.body.appendChild(host)
  const colors = new Map<string, string>()
  host.querySelectorAll("span[class*='mtk']").forEach((el) => {
    const mtk = [...el.classList].find((c) => c.startsWith("mtk"))
    if (!mtk || colors.has(mtk)) return
    colors.set(mtk, getComputedStyle(el).color)
  })
  host.remove()
  mtkClassColors = colors
  return colors
}

function parseColorizedLine(html: string, mtkColors: Map<string, string>, fallback: string): syntax_span[] {
  if (!html.trim()) {
    return fallback ? [{ text: fallback, color: DEFAULT_FG }] : []
  }
  const host = document.createElement("div")
  host.innerHTML = html.trim()
  const spans: syntax_span[] = []
  host.querySelectorAll("span[class*='mtk']").forEach((el) => {
    const mtk = [...el.classList].find((c) => c.startsWith("mtk"))
    const text = el.textContent ?? ""
    if (!text) return
    spans.push({ text, color: (mtk && mtkColors.get(mtk)) || DEFAULT_FG })
  })
  return spans.length ? spans : [{ text: fallback, color: DEFAULT_FG }]
}

async function highlightWithMonaco(
  monaco: Monaco,
  code: string,
  language: CustomCodeLanguage,
): Promise<syntax_span[][]> {
  monaco.editor.setTheme(MONACO_VS_DARK_THEME)
  const mtkColors = await getMtkClassColors(monaco)
  const html = await monaco.editor.colorize(code, language, { theme: MONACO_VS_DARK_THEME })
  const sourceLines = code.split("\n")
  const htmlLines = html.replace(/<br\s*\/?>$/i, "").split(/<br\s*\/?>/i)
  return sourceLines.map((line, i) => parseColorizedLine(htmlLines[i] ?? "", mtkColors, line))
}

let monacoReady: Promise<Monaco> | null = null

function getMonaco(): Promise<Monaco> {
  if (!monacoReady) {
    monacoReady = loader.init().then((monaco) => {
      ensureMonacoTypeScriptEnv(monaco)
      monaco.editor.setTheme(MONACO_VS_DARK_THEME)
      return monaco
    })
  }
  return monacoReady
}

export function useMonacoSyntaxLines(code: string, language: CustomCodeLanguage): syntax_span[][] | null {
  const [lines, setLines] = useState<syntax_span[][] | null>(null)

  useEffect(() => {
    let cancelled = false
    void getMonaco()
      .then((monaco) => highlightWithMonaco(monaco, code, language))
      .then((highlighted) => {
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
  const rendered = spans?.length ? spans : [{ text: fallback, color: DEFAULT_FG }]
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
