"use client"
// AI : parity ids — share.site-vibe

import { useRef, useState } from "react"
import { Code2, Sparkles } from "lucide-react"
import { AssistantChat } from "@/components/assistant-chat"
import { MonacoCodeEditor } from "@/components/code-viewer"
import { HtmlPreviewFrame } from "@/components/share/html-preview-frame"
import { HostedSiteChrome } from "@/components/share/hosted-site-chrome"
import { HostedSiteSignInCard } from "@/components/share/hosted-site-sign-in"
import { SharedLinkPreview } from "@/components/share/shared-link-preview"
import { PipelineExportDialog } from "@/components/pipeline-export-dialog"
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
  htmlColorInputValue,
  keepConcurrentHostedSiteEdits,
  type hosted_site_surface,
} from "@/lib/hosted-site"
import type { HostedSiteAuth, HostedSiteBrand, HostedSiteOptions } from "@/lib/shared-link-types"
import { DEFAULT_HOSTED_SITE_OPTIONS } from "@/lib/shared-link-types"
import { useStore } from "@/lib/store"
import type { Project } from "@/lib/types"
import { cn } from "@/lib/utils"

type PageStudioTab = "vibe" | "code"

const VIBE_WELCOME =
  "Describe the product — nav, hero, workspace. The page is signed in. I'll only change the HTML around the run form, not your pipeline."

export function HostedSitePageStudio({
  project,
  value,
  onChange,
  viewerMarkdown,
}: {
  project: Project
  value: HostedSiteOptions
  onChange: (next: HostedSiteOptions) => void
  viewerMarkdown: string
}) {
  const { model } = useStore()
  const [tab, setTab] = useState<PageStudioTab>("vibe")
  const [chatWidth, setChatWidth] = useState(320)
  const [brandOpen, setBrandOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [surface, setSurface] = useState<hosted_site_surface>("app")
  const valueRef = useRef(value)
  valueRef.current = value
  const previewSurface: hosted_site_surface = value.auth.enabled ? surface : "app"

  function patchBrand(partial: Partial<HostedSiteBrand>) {
    onChange({ ...value, brand: { ...value.brand, ...partial } })
  }

  function patchAuth(partial: Partial<HostedSiteAuth>) {
    onChange({ ...value, auth: { ...value.auth, ...partial } })
  }

  const preview = (
    <HostedSiteChrome options={value} surface={previewSurface}>
      {previewSurface === "signin" ? (
        <HostedSiteSignInCard
          companyName={value.brand.companyName}
          nextPath="#"
          provider={value.auth.provider}
          preview
        />
      ) : (
        <SharedLinkPreview
          projectName={project.name}
          viewerMarkdown={viewerMarkdown}
          modules={project.modules}
          variant="site"
        />
      )}
    </HostedSiteChrome>
  )

  const previewToolbar = value.auth.enabled ? (
    <button
      type="button"
      className="h-6 rounded px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
      onClick={() => setSurface((s) => (s === "app" ? "signin" : "app"))}
      {...spineActionProps("share.site-signin-preview")}
    >
      {previewSurface === "signin" ? "Sign in" : "App"}
    </button>
  ) : null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
      <div className="flex flex-1 gap-1 rounded-md border border-border bg-muted/30 p-1">
        {(["vibe", "code"] as const).map((id) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(id)}
              {...(id === "vibe" ? spineActionProps("share.site-vibe") : {})}
            >
              {id === "vibe" ? <Sparkles className="h-3.5 w-3.5" /> : <Code2 className="h-3.5 w-3.5" />}
              {id === "vibe" ? "Vibe" : "Code"}
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
              if (!enabled) setSurface("app")
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
        <div className="h-[28rem] overflow-hidden rounded-md border border-border">
          <ResizableSplit
            className="h-full"
            leadingWidth={chatWidth}
            onLeadingWidthChange={setChatWidth}
            minLeading={240}
            maxLeading={480}
            leading={
              <div className="flex h-full min-h-0 flex-col">
                <AssistantChat
                title="Page"
                subtitle="HTML around the run form"
                initialMessage={VIBE_WELCOME}
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
                  const res = await fetch(API_ROUTES.hostedSiteAssistant, {
                    method: "POST",
                    headers: JSON_HEADERS,
                    credentials: "same-origin",
                    body: JSON.stringify({
                      projectId: project.id,
                      message: text,
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
                >
                  {preview}
                </HtmlPreviewFrame>
              </div>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Custom HTML</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <MonacoCodeEditor
                value={value.customHtml || DEFAULT_HOSTED_SITE_HTML}
                onChange={(next) => onChange({ ...value, customHtml: next })}
                language="html"
                compact
                height="200px"
                wordWrap="on"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Place {`{{run}}`} where the pipeline should appear. {`{{company}}`}, {`{{tagline}}`}, {`{{logo}}`}, and{" "}
              {`{{email}}`} fill from brand. Scripts are stripped.
            </p>
          </div>
          {value.auth.enabled ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Sign-in HTML</Label>
              <div className="overflow-hidden rounded-md border border-border">
                <MonacoCodeEditor
                  value={value.authHtml || DEFAULT_HOSTED_SITE_AUTH_HTML}
                  onChange={(next) => onChange({ ...value, authHtml: next })}
                  language="html"
                  compact
                  height="160px"
                  wordWrap="on"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Place {`{{auth}}`} where the sign-in form should appear. Spine handles the form.
              </p>
            </div>
          ) : null}
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
          >
            {preview}
          </HtmlPreviewFrame>
        </div>
      )}
    </div>
  )
}
