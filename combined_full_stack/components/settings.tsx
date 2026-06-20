"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { WindowHeader } from "@/components/window-header"
import { JsonHighlight } from "@/components/highlight"
import { cn } from "@/lib/utils"
import {
  DEFAULT_JSON_VIEWER_HUMAN_VIEW,
  DEFAULT_JSON_VIEWER_SYNTAX_THEME,
  JSON_VIEWER_HUMAN_VIEWS,
  JSON_VIEWER_SYNTAX_PREVIEW,
  JSON_VIEWER_SYNTAX_THEMES,
  readJsonViewerDefaultView,
  readJsonViewerSyntaxTheme,
  writeJsonViewerDefaultView,
  writeJsonViewerSyntaxTheme,
  type JsonViewerHumanViewId,
  type JsonViewerSyntaxThemeId,
} from "@/lib/json-viewer"

// AI : vscode-style preview colors — mirror public/json-viewer.html theme "vscode"
function VscodeSyntaxPreview({ json }: { json: string }) {
  const tokens = json.split(
    /("(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\]:,]|\s+)/g,
  )
  return (
    <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed">
      <code>
        {tokens.map((t, i) => {
          if (!t) return null
          let cls = "text-foreground/80"
          if (/^"/.test(t)) cls = /:\s*$/.test(t) ? "text-[#9cdcfe]" : "text-[#ce9178]"
          else if (/^(true|false)$/.test(t)) cls = "text-[#569cd6]"
          else if (/^null$/.test(t)) cls = "text-[#7a7f8a] italic"
          else if (/^-?\d/.test(t)) cls = "text-[#b5cea8]"
          else if (/^[{}\[\]:,]$/.test(t)) cls = "text-[#808890]"
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

function SyntaxThemePreview({ theme }: { theme: JsonViewerSyntaxThemeId }) {
  return (
    <div className="mt-2 rounded-md border border-border bg-[#1e1f23] p-2.5">
      {theme === "app" ? (
        <JsonHighlight json={JSON_VIEWER_SYNTAX_PREVIEW} />
      ) : (
        <VscodeSyntaxPreview json={JSON_VIEWER_SYNTAX_PREVIEW} />
      )}
    </div>
  )
}

export function Settings() {
  const [defaultView, setDefaultView] = useState<JsonViewerHumanViewId>(DEFAULT_JSON_VIEWER_HUMAN_VIEW)
  const [syntaxTheme, setSyntaxTheme] = useState<JsonViewerSyntaxThemeId>(DEFAULT_JSON_VIEWER_SYNTAX_THEME)

  useEffect(() => {
    setDefaultView(readJsonViewerDefaultView())
    setSyntaxTheme(readJsonViewerSyntaxTheme())
  }, [])

  function pickView(view: JsonViewerHumanViewId) {
    writeJsonViewerDefaultView(view)
    setDefaultView(view)
  }

  function pickSyntax(theme: JsonViewerSyntaxThemeId) {
    writeJsonViewerSyntaxTheme(theme)
    setSyntaxTheme(theme)
  }

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step="07 / Settings"
        title="Settings"
        description="App preferences — stored locally in your browser."
      />
      <div className="flex-1 overflow-auto p-5">
        <div className="flex max-w-lg flex-col gap-4">
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">JSON reader</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Default human view when opening JSON in the document viewer.
              </p>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {JSON_VIEWER_HUMAN_VIEWS.map((view) => {
                const active = defaultView === view.id
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => pickView(view.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                      active ? "bg-secondary" : "hover:bg-secondary/50",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{view.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{view.description}</span>
                    </span>
                    {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">JSON side panel syntax</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Colours for the Structure / JSON slide-over in the interactive viewer.
              </p>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {JSON_VIEWER_SYNTAX_THEMES.map((theme) => {
                const active = syntaxTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => pickSyntax(theme.id)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-left transition-colors",
                      active ? "bg-secondary" : "hover:bg-secondary/50",
                    )}
                  >
                    <span className="flex items-start gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{theme.label}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{theme.description}</span>
                      </span>
                      {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                    </span>
                    {active && <SyntaxThemePreview theme={theme.id} />}
                  </button>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
