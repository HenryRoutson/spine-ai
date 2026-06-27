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
import {
  DEFAULT_HIDE_SERVER_LOGS,
  DEFAULT_HIDE_INPUT_DESCRIPTIONS,
  DEFAULT_REQUIRE_INPUT_DESCRIPTIONS,
  readHideServerLogsDefault,
  readHideInputDescriptionsDefault,
  readRequireInputDescriptions,
  writeHideServerLogsDefault,
  writeHideInputDescriptionsDefault,
  writeRequireInputDescriptions,
} from "@/lib/logging-settings"
import { Switch } from "@/components/ui/switch"

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
  const [hideServerLogs, setHideServerLogs] = useState(DEFAULT_HIDE_SERVER_LOGS)
  const [hideInputDescriptions, setHideInputDescriptions] = useState(DEFAULT_HIDE_INPUT_DESCRIPTIONS)
  const [requireInputDescriptions, setRequireInputDescriptions] = useState(DEFAULT_REQUIRE_INPUT_DESCRIPTIONS)

  useEffect(() => {
    setDefaultView(readJsonViewerDefaultView())
    setSyntaxTheme(readJsonViewerSyntaxTheme())
    setHideServerLogs(readHideServerLogsDefault())
    setHideInputDescriptions(readHideInputDescriptionsDefault())
    setRequireInputDescriptions(readRequireInputDescriptions())
  }, [])

  function pickView(view: JsonViewerHumanViewId) {
    writeJsonViewerDefaultView(view)
    setDefaultView(view)
  }

  function pickSyntax(theme: JsonViewerSyntaxThemeId) {
    writeJsonViewerSyntaxTheme(theme)
    setSyntaxTheme(theme)
  }

  function pickHideServerLogs(hide: boolean) {
    writeHideServerLogsDefault(hide)
    setHideServerLogs(hide)
  }

  function pickHideInputDescriptions(hide: boolean) {
    writeHideInputDescriptionsDefault(hide)
    setHideInputDescriptions(hide)
  }

  function pickRequireInputDescriptions(required: boolean) {
    writeRequireInputDescriptions(required)
    setRequireInputDescriptions(required)
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

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Run logging</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Server log sections in the step trace and live inference panel.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <Switch
                checked={hideServerLogs}
                onCheckedChange={(checked) => pickHideServerLogs(!!checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Hide server logs by default</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  When on, per-step server logs start collapsed — expand any step to read them.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 border-t border-border px-4 py-3">
              <Switch
                checked={hideInputDescriptions}
                onCheckedChange={(checked) => pickHideInputDescriptions(!!checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Hide input descriptions by default</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  When on, expected-input notes on inference and logging steps start collapsed — always shown when a step errors.
                </span>
              </span>
            </label>
          </section>

          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Pipeline</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Builder and inference validation — stored locally in your browser.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <Switch
                checked={requireInputDescriptions}
                onCheckedChange={(checked) => pickRequireInputDescriptions(!!checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Require input descriptions on every step</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  When on, the pipeline is invalid until each step has an expected-input note. Validation checks are still optional per step.
                </span>
              </span>
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
