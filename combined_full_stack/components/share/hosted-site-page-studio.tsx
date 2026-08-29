"use client"
// AI : parity ids — share.site-vibe

import { useCallback, useRef, useState } from "react"
import { FileCode2, Plus, X } from "lucide-react"
import { AssistantChat } from "@/components/assistant-chat"
import { MonacoCodeEditor } from "@/components/code-viewer"
import { HtmlPreviewFrame } from "@/components/share/html-preview-frame"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { HostedSiteReactPreview } from "@/components/share/hosted-site-react-preview"
import { HostedSiteSignInCard } from "@/components/share/hosted-site-sign-in"
import { HostedSiteActionPreview } from "@/components/share/hosted-site-action-button"
import { HostedSiteSlotWidgets } from "@/components/share/hosted-site-slot-widgets"
import { SharedLinkPreview } from "@/components/share/shared-link-preview"
import { WebsitePipelineBindings } from "@/components/share/website-pipeline-bindings"
import { SimpleViewToggle } from "@/components/simple-view-toggle"
import { hostedTableSlotsForProject } from "@/components/platform/hosted-table-slot"
import { PipelineExportDialog } from "@/components/pipeline-export-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ResizableSplit } from "@/components/resizable-split"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { assistantRequestFailed } from "@/lib/assistant-chat-types"
import { spineActionProps } from "@/lib/core/parity"
import {
  DEFAULT_HOSTED_SITE_AUTH_HTML,
  DEFAULT_HOSTED_SITE_HTML,
  DEFAULT_HOSTED_SITE_WORKSPACE_HTML,
  htmlColorInputValue,
  keepConcurrentHostedSiteEdits,
  nextHostedSitePagePath,
  sanitizeHostedSiteHtml,
  unwrapVibeCodedHtml,
} from "@/lib/hosted-site"
import { HOSTED_SITE_DOCS_SLOT } from "@/lib/hosted-site-slots"
import { htmlSiteToReactFiles } from "@/lib/hosted-site-react"
import { listedWebsitePipelineBindings } from "@/lib/website-pipelines"
import { patchHostedSiteHtmlText, type HsPreviewInlinePayload, type HsPreviewSelectPayload } from "@/lib/hosted-site-select"
import type { HostedSiteAuth, HostedSiteBrand, HostedSiteOptions } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { useStore } from "@/lib/store"
import type { Project } from "@/lib/types"
import { cn } from "@/lib/utils"

type PageStudioTab = "vibe" | "code"
type studio_preview_target = { kind: "app" } | { kind: "signin" } | { kind: "page"; index: number }

const VIBE_WELCOME =
  "Describe the product — nav, hero, workspace. I'll change the HTML. Attach a pipeline when you need a run form."
const VIBE_WELCOME_PAGE =
  "Describe the product — nav, hero, copy. No pipeline is attached yet. I'll only change the page."
const VIBE_WELCOME_REACT =
  "Describe the product. I'll edit the React project (App.tsx, CSS, components). Keep <RunPipeline alias=\"…\" /> where pipelines belong."

export function HostedSitePageStudio({
  project,
  value,
  onChange,
  viewerMarkdown,
  forcedTab,
  hideSurfaceTabs = false,
  fillHeight = false,
}: {
  project: Project
  value: HostedSiteOptions
  onChange: (next: HostedSiteOptions) => void
  viewerMarkdown: string
  forcedTab?: PageStudioTab
  hideSurfaceTabs?: boolean
  fillHeight?: boolean
}) {
  const { model, projects } = useStore()
  const [localTab, setLocalTab] = useState<PageStudioTab>("vibe")
  const tab = forcedTab ?? localTab
  const [chatWidth, setChatWidth] = useState(320)
  const [brandOpen, setBrandOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [target, setTarget] = useState<studio_preview_target>({ kind: "app" })
  const [selection, setSelection] = useState<{ cssPath: string; snippet: string } | null>(null)
  const [runtimeConfirm, setRuntimeConfirm] = useState<"html" | "react" | null>(null)
  const [reactPath, setReactPath] = useState("src/App.tsx")
  const valueRef = useRef(value)
  valueRef.current = value
  const resolvedTarget: studio_preview_target =
    target.kind === "signin" && !value.auth.enabled
      ? { kind: "app" }
      : target.kind === "page" && !value.pages[target.index]
        ? { kind: "app" }
        : target

  function patchBrand(partial: Partial<HostedSiteBrand>) {
    onChange({ ...value, brand: { ...value.brand, ...partial } })
  }

  function patchAuth(partial: Partial<HostedSiteAuth>) {
    onChange({ ...value, auth: { ...value.auth, ...partial } })
  }

  function activeSourceHtml(): string {
    if (resolvedTarget.kind === "signin") return value.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML
    if (resolvedTarget.kind === "page") {
      return value.pages[resolvedTarget.index]?.html.trim() || DEFAULT_HOSTED_SITE_WORKSPACE_HTML
    }
    return value.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML
  }

  function setActiveSourceHtml(html: string) {
    if (resolvedTarget.kind === "signin") {
      onChange({ ...value, authHtml: html })
      return
    }
    if (resolvedTarget.kind === "page") {
      onChange({
        ...value,
        pages: value.pages.map((page, i) => (i === resolvedTarget.index ? { ...page, html } : page)),
      })
      return
    }
    onChange({ ...value, customHtml: html })
  }

  function switchRuntime(next: "html" | "react") {
    if (next === value.runtime) {
      setRuntimeConfirm(null)
      return
    }
    if (next === "react") {
      const reactFiles = value.reactFiles.length > 0 ? value.reactFiles : htmlSiteToReactFiles(value)
      onChange({ ...value, runtime: "react", reactFiles })
      setReactPath(reactFiles.find((f) => f.path === "src/App.tsx")?.path ?? reactFiles[0]?.path ?? "src/App.tsx")
    } else {
      onChange({ ...value, runtime: "html" })
    }
    setRuntimeConfirm(null)
  }

  const hideDocsInRun = activeSourceHtml().includes(HOSTED_SITE_DOCS_SLOT)
  const slotWidgets = HostedSiteSlotWidgets({
    projectName: project.name,
    viewerMarkdown,
    modules: project.modules,
    hideDocsInRun,
  })
  const listedBindings = listedWebsitePipelineBindings(value.pipelineBindings)
  const hasPipelines = listedBindings.length > 0
  const runByAlias = Object.fromEntries(
    listedBindings.map((binding) => {
      if (binding.alias === "run" || binding.projectId === project.id) {
        return [binding.alias, slotWidgets.run]
      }
      const bound = projects.find((p) => p.id === binding.projectId)
      return [
        binding.alias,
        <SharedLinkPreview
          key={binding.alias}
          projectName={bound?.name ?? binding.alias}
          viewerMarkdown=""
          modules={bound?.modules ?? []}
          variant="site"
        />,
      ]
    }),
  )

  const tableByAlias = hostedTableSlotsForProject(project)
  const preview =
    value.runtime === "react" && resolvedTarget.kind !== "signin" ? (
      <HostedSiteReactPreview
        options={value}
        runByAlias={runByAlias}
        tableByAlias={tableByAlias}
        slots={slotWidgets}
      />
    ) : (
    <HostedSiteChrome
      options={value}
      surface={resolvedTarget.kind === "signin" ? "signin" : "app"}
      pageHtml={resolvedTarget.kind === "page" ? value.pages[resolvedTarget.index]?.html : undefined}
      slots={{
        ...slotWidgets,
        auth: (
          <HostedSiteSignInCard
            companyName={value.brand.companyName}
            nextPath="#"
            provider={value.auth.provider}
            preview
          />
        ),
      }}
      runByAlias={runByAlias}
      actionByAlias={{
        run: <HostedSiteActionPreview />,
        collatz: <HostedSiteActionPreview alias="collatz" />,
      }}
      tableByAlias={tableByAlias}
      editable={value.runtime !== "react"}
    />
    )

  const onPreviewSelect = useCallback((payload: HsPreviewSelectPayload) => {
    setSelection({ cssPath: payload.cssPath, snippet: payload.snippet })
  }, [])

  const onPreviewInline = useCallback(
    (payload: HsPreviewInlinePayload) => {
      const latest = valueRef.current
      const raw =
        resolvedTarget.kind === "signin"
          ? latest.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML
          : resolvedTarget.kind === "page"
            ? latest.pages[resolvedTarget.index]?.html.trim() || DEFAULT_HOSTED_SITE_WORKSPACE_HTML
            : latest.customHtml.trim() || DEFAULT_HOSTED_SITE_HTML
      const inner = unwrapVibeCodedHtml(raw).html
      const sanitized = sanitizeHostedSiteHtml(inner)
      const next = patchHostedSiteHtmlText(sanitized, payload.hsId, payload.text)
      if (next === sanitized) return
      if (resolvedTarget.kind === "signin") onChange({ ...latest, authHtml: next })
      else if (resolvedTarget.kind === "page") {
        onChange({
          ...latest,
          pages: latest.pages.map((page, i) => (i === resolvedTarget.index ? { ...page, html: next } : page)),
        })
      } else onChange({ ...latest, customHtml: next })
    },
    [onChange, resolvedTarget],
  )

  const previewToolbar = (
    <div className="flex max-w-[18rem] flex-wrap items-center gap-0.5">
      <button
        type="button"
        className={cn(
          "h-6 rounded px-1.5 text-[10px]",
          resolvedTarget.kind === "app" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
        onClick={() => setTarget({ kind: "app" })}
        {...spineActionProps("share.site-signin-preview")}
      >
        App
      </button>
      {value.auth.enabled ? (
        <button
          type="button"
          className={cn(
            "h-6 rounded px-1.5 text-[10px]",
            resolvedTarget.kind === "signin" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => setTarget({ kind: "signin" })}
          {...spineActionProps("share.site-signin-preview")}
        >
          Sign in
        </button>
      ) : null}
      {value.pages.map((page, index) => (
        <span key={page.path} className="flex items-center">
          <button
            type="button"
            className={cn(
              "h-6 rounded px-1.5 text-[10px]",
              resolvedTarget.kind === "page" && resolvedTarget.index === index
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setTarget({ kind: "page", index })}
            {...spineActionProps("share.site-page-switch")}
          >
            /{page.path}
          </button>
          <button
            type="button"
            className="h-6 w-5 text-muted-foreground hover:text-foreground"
            aria-label={`Remove /${page.path}`}
            onClick={() => {
              onChange({ ...value, pages: value.pages.filter((_, i) => i !== index) })
              setTarget({ kind: "app" })
            }}
          >
            <X className="mx-auto h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        className="flex h-6 items-center gap-0.5 rounded px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        onClick={() => {
          const path = nextHostedSitePagePath(value.pages)
          onChange({
            ...value,
            pages: [...value.pages, { path, html: DEFAULT_HOSTED_SITE_WORKSPACE_HTML }],
          })
          setTarget({ kind: "page", index: value.pages.length })
        }}
        {...spineActionProps("share.site-add-page")}
      >
        <Plus className="h-3 w-3" />
        Page
      </button>
    </div>
  )

  return (
    <div className={cn(fillHeight ? "flex min-h-0 flex-1 flex-col gap-3 p-4" : "space-y-3")}>
      {hideSurfaceTabs ? null : (
      <div className="flex items-center gap-2">
      <SimpleViewToggle
        checked={tab === "vibe"}
        onCheckedChange={(on) => setLocalTab(on ? "vibe" : "code")}
        spineId="share.site-vibe"
        className="max-w-xs flex-1"
      />
      <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1" data-spine-id="website.runtime">
        {(["html", "react"] as const).map((id) => {
          const active = value.runtime === id
          return (
            <button
              key={id}
              type="button"
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1.5 text-[10px] font-medium transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                if (id === value.runtime) return
                setRuntimeConfirm(id)
              }}
            >
              {id === "html" ? "HTML" : "React"}
            </button>
          )
        })}
      </div>
      <PipelineExportDialog
        project={project}
        modules={project.modules}
        models={project.models}
        typeAliases={project.typeAliases ?? []}
        siteOptions={value}
      />
      </div>
      )}

      <WebsitePipelineBindings
        primaryProjectId={project.id}
        projects={projects}
        options={value}
        onChange={onChange}
      />

      {runtimeConfirm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2 text-[11px]">
          <span className="text-muted-foreground">
            {runtimeConfirm === "react"
              ? "Switch to a React project? HTML is kept as a snapshot you can switch back to."
              : "Switch back to simple HTML? React files stay saved."}
          </span>
          <Button type="button" size="sm" className="h-7" onClick={() => switchRuntime(runtimeConfirm)}>
            Switch
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-7" onClick={() => setRuntimeConfirm(null)}>
            Cancel
          </Button>
        </div>
      ) : null}

      <div>
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setBrandOpen((v) => !v)}
        >
          {brandOpen ? "Hide brand" : "Brand colors & copy"}
        </button>
        {brandOpen ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Company name</Label>
              <Input
                value={value.brand.companyName}
                onChange={(e) => patchBrand({ companyName: e.target.value })}
                className="h-8 text-xs"
                placeholder="Acme"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tagline</Label>
              <Input
                value={value.brand.tagline}
                onChange={(e) => patchBrand({ tagline: e.target.value })}
                className="h-8 text-xs"
                placeholder="Invoice review in one click"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Logo URL (optional)</Label>
              <Input
                value={value.brand.logoUrl}
                onChange={(e) => patchBrand({ logoUrl: e.target.value })}
                className="h-8 font-mono text-xs"
                placeholder="https://…"
              />
            </div>
            {(
              [
                ["Primary", "primaryColor"],
                ["Accent", "accentColor"],
                ["Background", "backgroundColor"],
                ["Text", "textColor"],
              ] as const
            ).map(([label, key]) => (
              <div key={label} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={htmlColorInputValue(value.brand[key], DEFAULT_HOSTED_SITE_OPTIONS.brand[key])}
                    onChange={(e) => patchBrand({ [key]: e.target.value })}
                    className="h-8 w-8 cursor-pointer rounded border border-border bg-background p-0.5"
                  />
                  <Input
                    value={value.brand[key]}
                    onChange={(e) => patchBrand({ [key]: e.target.value })}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              </div>
            ))}
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={value.hideSpineFooter}
                onChange={(e) => onChange({ ...value, hideSpineFooter: e.target.checked })}
              />
              Hide Spine footer
            </label>
          </div>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setAuthOpen((v) => !v)}
        >
          {authOpen ? "Hide sign-in (later)" : "Sign-in (keep for later)"}
        </button>
        {authOpen ? (
      <div className="mt-2 space-y-2 rounded-md border border-border bg-muted/20 p-3">
        <label className="flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={value.auth.enabled}
            onChange={(e) => {
              const enabled = e.target.checked
              onChange({
                ...value,
                auth: { ...value.auth, enabled },
                authHtml: enabled ? value.authHtml.trim() || DEFAULT_HOSTED_SITE_AUTH_HTML : value.authHtml,
              })
              if (!enabled) setTarget({ kind: "app" })
            }}
            {...spineActionProps("share.site-signin")}
          />
          Require sign-in before the workspace
        </label>
        <p className="text-[10px] text-muted-foreground">
          Off by default — visitors land in the signed-in app. Turn this on later if you want a gate.
        </p>
        {value.auth.enabled ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="hs-auth-provider"
                  checked={value.auth.provider === "spine"}
                  onChange={() => patchAuth({ provider: "spine" })}
                />
                Spine (handled)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="hs-auth-provider"
                  checked={value.auth.provider === "custom_supabase"}
                  onChange={() => patchAuth({ provider: "custom_supabase" })}
                />
                Custom Supabase
              </label>
            </div>
            {value.auth.provider === "custom_supabase" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Project URL (placeholder)</Label>
                  <Input
                    value={value.auth.customSupabaseUrl}
                    onChange={(e) => patchAuth({ customSupabaseUrl: e.target.value })}
                    className="h-8 font-mono text-xs"
                    placeholder="https://YOUR_PROJECT.supabase.co"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Anon key (placeholder)</Label>
                  <Input
                    value={value.auth.customSupabaseAnonKey}
                    onChange={(e) => patchAuth({ customSupabaseAnonKey: e.target.value })}
                    className="h-8 font-mono text-xs"
                    placeholder="stored, not allocated yet"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground sm:col-span-2">
                  Custom sign-in and data on a separate Supabase instance are not allocated yet. Keys are stored only.
                  Live auth still uses Spine until a project instance is provisioned.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
        ) : null}
      </div>

      {tab === "vibe" ? (
        <div className={cn("overflow-hidden rounded-md border border-border", fillHeight ? "min-h-0 flex-1" : "h-[28rem]")}>
          <ResizableSplit
            className="h-full"
            leadingWidth={chatWidth}
            onLeadingWidthChange={setChatWidth}
            minLeading={240}
            maxLeading={480}
            leading={
              <div className="flex h-full min-h-0 flex-col">
                {selection ? (
                  <div className="flex items-start gap-1 border-b border-border bg-muted/30 px-2 py-1">
                    <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground" title={selection.cssPath}>
                      {selection.cssPath}
                    </p>
                    <button
                      type="button"
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setSelection(null)}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
                <AssistantChat
                title="Page"
                subtitle={
                  hasPipelines
                    ? value.runtime === "react"
                      ? "React around the run widgets"
                      : "HTML around the run form"
                    : "Page first — attach a pipeline when you need a run"
                }
                initialMessage={
                  value.runtime === "react"
                    ? VIBE_WELCOME_REACT
                    : hasPipelines
                      ? VIBE_WELCOME
                      : VIBE_WELCOME_PAGE
                }
                placeholder="Make a clean hero, then the workspace…"
                loadingLabel="Designing page…"
                simple
                showAvatars={false}
                showHeaderMeta={false}
                chatId={`site-vibe:${project.id}`}
                renderProposal={() => null}
                onApprove={() => undefined}
                onReject={() => undefined}
                requestAssistant={async (text, history) => {
                  const sent = valueRef.current
                  const message = selection
                    ? `Selected page element (${selection.cssPath}):\n${selection.snippet}\n\n${text}`
                    : text
                  const res = await fetch(API_ROUTES.hostedSiteAssistant, {
                    method: "POST",
                    headers: JSON_HEADERS,
                    credentials: "same-origin",
                    body: JSON.stringify({
                      projectId: project.id,
                      message,
                      history,
                      model,
                      siteOptions: sent,
                    }),
                  })
                  const body = (await res.json().catch(() => null)) as
                    | { message?: string; siteOptions?: HostedSiteOptions; error?: string }
                    | null
                  if (!res.ok) throw new Error(body?.error ?? assistantRequestFailed(res.status))
                  if (!body?.message || !body.siteOptions) throw new Error(assistantRequestFailed(res.status))
                  onChange(keepConcurrentHostedSiteEdits(sent, body.siteOptions, valueRef.current))
                  return { message: body.message }
                }}
              />
              </div>
            }
            trailing={
              <div className="h-full overflow-auto bg-background">
                <HtmlPreviewFrame
                  label="Page preview"
                  bodyClassName="max-h-none"
                  extraToolbar={previewToolbar}
                  onSelect={onPreviewSelect}
                  onInlineText={onPreviewInline}
                >
                  {preview}
                </HtmlPreviewFrame>
              </div>
            }
          />
        </div>
      ) : value.runtime === "react" ? (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground">
            Vite + React project. Preview compiles App.tsx and mounts live RunPipeline widgets.
          </p>
          <div className="flex flex-wrap gap-1">
            {value.reactFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[10px]",
                  reactPath === file.path
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setReactPath(file.path)}
              >
                <FileCode2 className="h-3 w-3" />
                {file.path}
              </button>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={() => {
                const used = new Set(value.reactFiles.map((f) => f.path))
                let n = 1
                let path = "src/Component.tsx"
                while (used.has(path)) {
                  n += 1
                  path = `src/Component${n}.tsx`
                }
                onChange({
                  ...value,
                  reactFiles: [...value.reactFiles, { path, contents: `export function Component() {\n  return <div />\n}\n` }],
                })
                setReactPath(path)
              }}
            >
              <Plus className="h-3 w-3" />
              File
            </button>
          </div>
          <div className="overflow-hidden rounded-md border border-border">
            <MonacoCodeEditor
              value={value.reactFiles.find((f) => f.path === reactPath)?.contents ?? ""}
              onChange={(next) =>
                onChange({
                  ...value,
                  reactFiles: value.reactFiles.map((f) => (f.path === reactPath ? { ...f, contents: next } : f)),
                })
              }
              language={reactPath.endsWith(".css") ? "css" : "typescript"}
              compact
              height="280px"
              wordWrap="on"
            />
          </div>
          <HtmlPreviewFrame
            label="Page preview"
            extraToolbar={previewToolbar}
            onSelect={onPreviewSelect}
            onInlineText={onPreviewInline}
          >
            {preview}
          </HtmlPreviewFrame>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              {resolvedTarget.kind === "signin"
                ? "Sign-in HTML"
                : resolvedTarget.kind === "page"
                  ? `/${value.pages[resolvedTarget.index]?.path ?? "page"} HTML`
                  : "Custom HTML"}
            </Label>
            <div className="overflow-hidden rounded-md border border-border">
              <MonacoCodeEditor
                value={activeSourceHtml()}
                onChange={setActiveSourceHtml}
                language="html"
                compact
                height="200px"
                wordWrap="on"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Place {`{{run}}`} {`{{auth}}`} {`{{output}}`} {`{{chatbot}}`} {`{{docs}}`} where widgets belong.{" "}
              {`{{company}}`}, {`{{tagline}}`}, {`{{logo}}`}, and {`{{email}}`} fill from brand. Scripts are stripped.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Extra CSS</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <MonacoCodeEditor
                value={value.customCss}
                onChange={(next) => onChange({ ...value, customCss: next })}
                language="css"
                compact
                height="96px"
                wordWrap="on"
              />
            </div>
          </div>
          <HtmlPreviewFrame
            label="Page preview"
            extraToolbar={previewToolbar}
            onSelect={onPreviewSelect}
            onInlineText={onPreviewInline}
          >
            {preview}
          </HtmlPreviewFrame>
        </div>
      )}
    </div>
  )
}
