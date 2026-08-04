"use client"

import { useEffect, useState } from "react"
import { Check, LogOut } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { useWorkspaceModel } from "@/lib/use-workspace-model"
import { ModelSelector } from "@/components/model-selector"
import { Button } from "@/components/ui/button"
import { WindowHeader } from "@/components/window-header"
import { windowPanelHeader } from "@/lib/window-panel-meta"
import { JsonHighlight } from "@/components/highlight"
import { ResizableSplit } from "@/components/resizable-split"
import { settingsNavSplit } from "@/lib/layout-split-settings"
import { usePersistedLeadingWidth } from "@/lib/use-persisted-leading-width"
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
import {
  DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY,
  readInferenceOutputStepsOnly,
  writeInferenceOutputStepsOnly,
  DEFAULT_ALLOW_DUPLICATE_RUNS,
  readAllowDuplicateRuns,
  writeAllowDuplicateRuns,
} from "@/lib/inference-settings"
import {
  COLOR_SCHEME_IDS,
  COLOR_SCHEMES,
  DEFAULT_COLOR_SCHEME,
  readColorScheme,
  writeColorScheme,
  type ColorSchemeId,
} from "@/lib/color-scheme"
import { Switch } from "@/components/ui/switch"
import { PrivacySettings } from "@/components/privacy-settings"
import { TeamSettings } from "@/components/team-settings"
import { LlmProvidersSettingsPage, LlmProvidersSettingsSummary } from "@/components/llm-providers-settings"
import { useOptionalAppShell } from "@/lib/app-shell"
import { OPEN_LLM_PROVIDERS_EVENT, SCROLL_SETTINGS_SECTION_EVENT } from "@/lib/settings-nav"
import { isDemoMode } from "@/lib/demo-mode"
import { DEMO_ACCOUNT_EMAIL } from "@/lib/demo-constants"
import { clearWorkspaceClientSession } from "@/lib/clear-workspace-client-session"
import { SettingsAccountRowSkeleton } from "@/components/account-panel-skeletons"
import { readSettingsAccountSnapshot } from "@/lib/settings-account-snapshot-cache"
import { fetchSettingsAccount } from "@/lib/warm-settings-data"
import { SettingsDataCache } from "@/components/settings-data-cache"
import { useMarkPrimarySectionReady } from "@/lib/primary-section-opening"
import { AppPrimarySection } from "@/lib/app-primary-section-labels"

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

const SETTINGS_SECTIONS = [
  { id: "settings-team", label: "Team" },
  { id: "settings-account", label: "Account" },
  { id: "settings-model", label: "Default model" },
  { id: "settings-llm-providers", label: "LLM providers" },
  { id: "settings-json-reader", label: "JSON reader" },
  { id: "settings-json-syntax", label: "JSON syntax" },
  { id: "settings-logging", label: "Run logging" },
  { id: "settings-pipeline", label: "Pipeline" },
  { id: "settings-inference", label: "Inference" },
  { id: "settings-colors", label: "Status colours" },
  { id: "settings-data-cache", label: "Data cache" },
  { id: "settings-privacy", label: "Privacy" },
] as const

export function Settings() {
  useMarkPrimarySectionReady(AppPrimarySection.Settings)
  const shell = useOptionalAppShell()
  const { model, setModel } = useWorkspaceModel()
  const [email, setEmail] = useState<string | null>(() => readSettingsAccountSnapshot()?.email ?? null)
  const [emailLoading, setEmailLoading] = useState(
    () => readSettingsAccountSnapshot() == null && !isDemoMode(),
  )
  const [defaultView, setDefaultView] = useState<JsonViewerHumanViewId>(DEFAULT_JSON_VIEWER_HUMAN_VIEW)
  const [syntaxTheme, setSyntaxTheme] = useState<JsonViewerSyntaxThemeId>(DEFAULT_JSON_VIEWER_SYNTAX_THEME)
  const [hideServerLogs, setHideServerLogs] = useState(DEFAULT_HIDE_SERVER_LOGS)
  const [hideInputDescriptions, setHideInputDescriptions] = useState(DEFAULT_HIDE_INPUT_DESCRIPTIONS)
  const [requireInputDescriptions, setRequireInputDescriptions] = useState(DEFAULT_REQUIRE_INPUT_DESCRIPTIONS)
  const [inferenceOutputStepsOnly, setInferenceOutputStepsOnly] = useState(DEFAULT_INFERENCE_OUTPUT_STEPS_ONLY)
  const [allowDuplicateRuns, setAllowDuplicateRuns] = useState(DEFAULT_ALLOW_DUPLICATE_RUNS)
  const [colorScheme, setColorScheme] = useState<ColorSchemeId>(DEFAULT_COLOR_SCHEME)
  const [llmProvidersOpen, setLlmProvidersOpen] = useState(false)
  const { width: navWidth, setWidth: setNavWidth, commitWidth: commitNavWidth } =
    usePersistedLeadingWidth(settingsNavSplit)

  useEffect(() => {
    if (isDemoMode()) {
      setEmail(DEMO_ACCOUNT_EMAIL)
      setEmailLoading(false)
      return
    }
    void fetchSettingsAccount()
      .then((account) => setEmail(account.email))
      .finally(() => setEmailLoading(false))
  }, [])

  useEffect(() => {
    setDefaultView(readJsonViewerDefaultView())
    setSyntaxTheme(readJsonViewerSyntaxTheme())
    setHideServerLogs(readHideServerLogsDefault())
    setHideInputDescriptions(readHideInputDescriptionsDefault())
    setRequireInputDescriptions(readRequireInputDescriptions())
    setInferenceOutputStepsOnly(readInferenceOutputStepsOnly())
    setAllowDuplicateRuns(readAllowDuplicateRuns())
    setColorScheme(readColorScheme())
  }, [])

  useEffect(() => {
    if (shell?.pendingLlmProvidersOpen) {
      setLlmProvidersOpen(true)
      shell.clearPendingLlmProvidersOpen()
    }
  }, [shell?.pendingLlmProvidersOpen, shell])

  useEffect(() => {
    const onScrollSection = (e: Event) => {
      const sectionId = (e as CustomEvent<{ sectionId?: string }>).detail?.sectionId
      if (!sectionId) return
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
    const onOpenLlmProviders = () => setLlmProvidersOpen(true)
    window.addEventListener(SCROLL_SETTINGS_SECTION_EVENT, onScrollSection)
    window.addEventListener(OPEN_LLM_PROVIDERS_EVENT, onOpenLlmProviders)
    return () => {
      window.removeEventListener(SCROLL_SETTINGS_SECTION_EVENT, onScrollSection)
      window.removeEventListener(OPEN_LLM_PROVIDERS_EVENT, onOpenLlmProviders)
    }
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

  function pickInferenceOutputStepsOnly(onlyOutputSteps: boolean) {
    writeInferenceOutputStepsOnly(onlyOutputSteps)
    setInferenceOutputStepsOnly(onlyOutputSteps)
  }

  function pickAllowDuplicateRuns(allowed: boolean) {
    writeAllowDuplicateRuns(allowed)
    setAllowDuplicateRuns(allowed)
  }

  function pickColorScheme(scheme: ColorSchemeId) {
    writeColorScheme(scheme)
    setColorScheme(scheme)
  }

  const settingsPanel = windowPanelHeader("settings")

  return (
    <div className="flex h-full flex-col">
      <WindowHeader
        step={settingsPanel.step}
        title={settingsPanel.title}
        description={settingsPanel.description}
      />
      <ResizableSplit
        className="min-h-0 flex-1"
        leadingWidth={navWidth}
        onLeadingWidthChange={setNavWidth}
        onLeadingWidthCommit={commitNavWidth}
        minLeading={settingsNavSplit.min}
        maxLeading={settingsNavSplit.max}
        leading={
          <nav className="flex h-full flex-col gap-0.5 overflow-y-auto p-2">
            <p className="px-2 py-1.5 font-mono text-[10px] uppercase text-muted-foreground">sections</p>
            {SETTINGS_SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  s.id === "settings-llm-providers"
                    ? setLlmProvidersOpen(true)
                    : document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="rounded-md px-2.5 py-2 text-left font-mono text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {s.label}
              </button>
            ))}
          </nav>
        }
        trailing={
          <div className="min-h-0 flex-1 overflow-auto p-5">
            <div className="mx-auto flex max-w-lg flex-col gap-4">
          <TeamSettings />

          <section id="settings-account" className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Account</h3>
            </div>
            {emailLoading ? (
              <SettingsAccountRowSkeleton />
            ) : (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="font-mono text-xs text-muted-foreground">{email ?? "—"}</span>
              {isDemoMode() ? (
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Preview account
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void createClient()
                      .then((supabase) => supabase.auth.signOut())
                      .then(() => {
                        clearWorkspaceClientSession()
                        window.location.href = "/login"
                      })
                  }}
                  className="gap-1.5 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              )}
            </div>
            )}
          </section>

          <section id="settings-model" className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Default model</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                LLM used for pipeline steps by default — format <code className="text-foreground">provider:model</code>.
              </p>
            </div>
            <div className="px-4 py-3">
              <ModelSelector value={model} onChange={setModel} />
            </div>
          </section>

          <LlmProvidersSettingsSummary onOpen={() => setLlmProvidersOpen(true)} />

          <section id="settings-json-reader" className="rounded-lg border border-border bg-card">
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

          <section id="settings-json-syntax" className="rounded-lg border border-border bg-card">
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

          <section id="settings-logging" className="rounded-lg border border-border bg-card">
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

          <section id="settings-pipeline" className="rounded-lg border border-border bg-card">
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

          <section id="settings-inference" className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Inference</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Output panels shown after a pipeline run finishes.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <Switch
                checked={inferenceOutputStepsOnly}
                onCheckedChange={(checked) => pickInferenceOutputStepsOnly(!!checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Only show output-step tables</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  When on, the inference tab shows spreadsheet views only for pipeline output steps — not intermediate step results.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 border-t border-border px-4 py-3">
              <Switch
                checked={allowDuplicateRuns}
                onCheckedChange={(checked) => pickAllowDuplicateRuns(!!checked)}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Allow duplicate runs</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  When off, an identical pipeline + input setup reuses the last successful run instead of billing again.
                </span>
              </span>
            </label>
          </section>

          <section id="settings-colors" className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold">Status colours</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Colour scheme used for ok / error / retry indicators in charts and traces.
              </p>
            </div>
            <div className="flex flex-col gap-1 p-2">
              {COLOR_SCHEME_IDS.map((id) => {
                const scheme = COLOR_SCHEMES[id]
                const active = colorScheme === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pickColorScheme(id)}
                    className={cn(
                      "flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
                      active ? "bg-secondary" : "hover:bg-secondary/50",
                    )}
                  >
                    {/* AI : three colour swatches showing ok / err / retry for each scheme */}
                    <span className="mt-0.5 flex shrink-0 gap-1">
                      <span className="h-3.5 w-3.5 rounded-full border border-border/60" style={{ background: scheme.palette.ok }} />
                      <span className="h-3.5 w-3.5 rounded-full border border-border/60" style={{ background: scheme.palette.err }} />
                      <span className="h-3.5 w-3.5 rounded-full border border-border/60" style={{ background: scheme.palette.retry }} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{scheme.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{scheme.description}</span>
                    </span>
                    {active && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  </button>
                )
              })}
            </div>
          </section>

          <SettingsDataCache />

          <div id="settings-privacy">
            <PrivacySettings />
          </div>
            </div>
          </div>
        }
      />
      {llmProvidersOpen && <LlmProvidersSettingsPage onClose={() => setLlmProvidersOpen(false)} />}
    </div>
  )
}
