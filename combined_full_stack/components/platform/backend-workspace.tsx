"use client"

// AI : parity ids — platform.backend-tab.schema platform.backend-tab.ports platform.backend-tab.tables platform.backend-tab.run

import { useMemo, useState } from "react"
import { Database, GitBranch, Link2, Play, Table2 } from "lucide-react"
import { Inference } from "@/components/inference"
import { PipelineSummaryBox } from "@/components/pipeline-summary-box"
import { SupabaseBackendPanel } from "@/components/platform/supabase-backend-panel"
import { TypePortsPanel } from "@/components/platform/type-ports-panel"
import { StructureRowsPanel } from "@/components/platform/structure-rows-panel"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { spineActionProps } from "@/lib/core/parity"
import { useStore } from "@/lib/store"
import { schemaPackForModels, supabaseConnectSummary } from "@/lib/supabase-site-provision"
import { copyTextToClipboard } from "@/lib/clipboard"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { cn } from "@/lib/utils"
import type { HostedSiteAuth } from "@/lib/shared-link-types"

type backend_tab = "schema" | "ports" | "tables" | "run"

const TABS: { id: backend_tab; label: string; icon: typeof Database }[] = [
  { id: "schema", label: "Schema", icon: Database },
  { id: "ports", label: "Connections", icon: GitBranch },
  { id: "tables", label: "Rows", icon: Table2 },
  { id: "run", label: "Run", icon: Play },
]

// AI : tables & rows — schema, typed mix-and-match, stateful records, test run. Internal tab ids stay schema/ports/tables/run.
export function BackendWorkspace({
  siteAuth,
  onSiteAuthChange,
}: {
  siteAuth?: HostedSiteAuth
  onSiteAuthChange?: (auth: HostedSiteAuth) => void
} = {}) {
  const { models, modules, typeAliases } = useStore()
  const [tab, setTab] = useState<backend_tab>("schema")
  const [copied, setCopied] = useState(false)
  const pack = useMemo(() => schemaPackForModels(models, modules), [models, modules])

  async function copySchemaPack() {
    await copyTextToClipboard(pack.sql)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold">Tables & data</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
          The database for this project. GUI users: Structures owns SQL and rows; Pipeline owns functions.
          </p>
        </div>

        <div className="flex gap-1 rounded-md border border-border bg-muted/30 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
                tab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setTab(item.id)}
              {...spineActionProps(`platform.backend-tab.${item.id}`)}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === "schema" ? (
          <div className="space-y-4">
            <SupabaseBackendPanel models={models} modules={modules} typeAliases={typeAliases} />
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">Schema pack</p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[10px]"
                  onClick={() => void copySchemaPack()}
                  {...spineActionProps("platform.copy-schema-pack")}
                >
                  {copied ? "Copied" : "Copy schema.sql"}
                </Button>
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {pack.tables.length ? pack.tables.join(", ") : "No user tables yet"}
              </p>
            </div>
            {siteAuth && onSiteAuthChange ? (
              <SupabaseConnectFields auth={siteAuth} onChange={onSiteAuthChange} />
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Bind your own Supabase from a hosted website&apos;s sign-in settings. Hosted SQL
                rows are scoped per website (`site:…`); builder runs use `project:…`. BYO keys are
                stored, not used for auth or rows yet.
              </p>
            )}
          </div>
        ) : null}

        {tab === "ports" ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <TypePortsPanel />
          </div>
        ) : null}

        {tab === "tables" ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <StructureRowsPanel models={models} />
          </div>
        ) : null}

        {tab === "run" ? (
          <div className="space-y-4">
            <section className="rounded-lg border border-border bg-card p-4">
              <h4 className="text-sm font-semibold">What the pipeline computes</h4>
              <PipelineSummaryBox />
            </section>
            <section className="min-h-[24rem] overflow-hidden rounded-lg border border-border bg-card">
              <Inference simple />
            </section>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SupabaseConnectFields({
  auth,
  onChange,
}: {
  auth: HostedSiteAuth
  onChange: (auth: HostedSiteAuth) => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium">
        <Link2 className="h-3.5 w-3.5" />
        Bring your own Supabase
      </p>
      <p className="text-[10px] text-muted-foreground">
        {supabaseConnectSummary(auth.customSupabaseUrl, auth.customSupabaseAnonKey)}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Project URL</Label>
          <Input
            className="h-8 font-mono text-xs"
            value={auth.customSupabaseUrl}
            placeholder="https://YOUR_PROJECT.supabase.co"
            onChange={(e) => onChange({ ...auth, customSupabaseUrl: e.target.value, provider: "custom_supabase" })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Anon key</Label>
          <Input
            className="h-8 font-mono text-xs"
            value={auth.customSupabaseAnonKey}
            placeholder="eyJ..."
            onChange={(e) => onChange({ ...auth, customSupabaseAnonKey: e.target.value, provider: "custom_supabase" })}
          />
        </div>
      </div>
    </div>
  )
}
