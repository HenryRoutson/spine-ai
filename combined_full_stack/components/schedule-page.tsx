"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Clock, Loader2, Play, Plus, Trash2 } from "lucide-react"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { PipelineObserveEmpty } from "@/components/pipeline-observe-empty"
import { Badge } from "@/components/ui/badge"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { CRON_PRESETS, cronPresetIdFor, describeCronExpr, INVALID_CRON_MESSAGE, isValidCronExpr } from "@/lib/cron-expr"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import type { PipelineScheduleRecord, PipelineScheduleRuntime } from "@/lib/schedule-types"
import { useStore } from "@/lib/store"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { spineActionProps } from "@/lib/core/parity"
import { timeAgo, timeUntil } from "@/lib/time-ago"
import { cn } from "@/lib/utils"
import { useAppShell } from "@/lib/app-shell"

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function SchedulePage() {
  const { project, docs, inferenceInputDocIds, modules, models, typeAliases } = useStore()
  const { setActiveWindow } = useAppShell()
  const { runTabsBlocked, typesInvalid } = computeWorkspaceValidity(
    modules,
    models,
    typeAliases,
    !!project.teamReadOnly,
  )
  const [schedules, setSchedules] = useState<PipelineScheduleRecord[]>([])
  const [runtime, setRuntime] = useState<PipelineScheduleRuntime | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("Hourly run")
  const [cron, setCron] = useState("0 * * * *")
  const preset = cronPresetIdFor(cron)
  const [timezone, setTimezone] = useState(browserTimeZone)
  const [tickUrl, setTickUrl] = useState("")
  const [runningId, setRunningId] = useState<string | null>(null)

  const defaultDocsByModule = useMemo(
    () => shareDefaultDocsByModule(project, docs, inferenceInputDocIds),
    [project, docs, inferenceInputDocIds],
  )

  const refresh = useCallback(async () => {
    const body = await apiJson<{ schedules: PipelineScheduleRecord[]; runtime: PipelineScheduleRuntime }>(
      `${API_ROUTES.schedules}?projectId=${encodeURIComponent(project.id)}`,
    )
    setSchedules(body.schedules)
    setRuntime(body.runtime)
  }, [project.id])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void refresh()
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [refresh])

  useEffect(() => {
    if (!runtime?.tickUrl || tickUrl) return
    const suffix = API_ROUTES.schedulesTick
    setTickUrl(runtime.tickUrl.endsWith(suffix) ? runtime.tickUrl.slice(0, -suffix.length) : runtime.tickUrl)
  }, [runtime, tickUrl])

  if (runTabsBlocked) {
    return (
      <PipelineObserveEmpty
        title="Fix the pipeline first"
        copy="Cron jobs run the same Inference inputs. Repair Structure or Pipeline, then come back to Schedule."
      />
    )
  }

  async function createCron() {
    setBusy(true)
    setError(null)
    try {
      if (!isValidCronExpr(cron)) throw new Error(INVALID_CRON_MESSAGE)
      await apiJson(API_ROUTES.schedules, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          projectId: project.id,
          name,
          cron,
          timezone,
          defaultDocsByModule,
          tickUrl: tickUrl.trim() || undefined,
        }),
      })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(row: PipelineScheduleRecord, enabled: boolean) {
    setError(null)
    try {
      await apiJson(API_ROUTES.schedule(row.id), {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ enabled }),
      })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function runNow(row: PipelineScheduleRecord) {
    setRunningId(row.id)
    setError(null)
    try {
      await apiJson(API_ROUTES.scheduleRun(row.id), { method: "POST" })
      setActiveWindow("logging")
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRunningId(null)
    }
  }

  async function remove(row: PipelineScheduleRecord) {
    if (!window.confirm(`Delete cron “${row.name}”?`)) return
    setError(null)
    try {
      await apiJson(API_ROUTES.schedule(row.id), { method: "DELETE" })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function saveTickUrl() {
    if (!tickUrl.trim()) return
    setBusy(true)
    setError(null)
    try {
      await apiJson(API_ROUTES.schedules, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ tickUrl: tickUrl.trim() }),
      })
      await refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold">Automatic cron</h3>
                <p className="text-xs text-muted-foreground">
                  n8n-style schedule — Supabase pg_cron ticks this app every minute, including confidential self-host.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="cron-name" className="mb-1 text-xs text-muted-foreground">
                  Name
                </Label>
                <Input id="cron-name" value={name} onChange={(e) => setName(e.target.value)} disabled={project.teamReadOnly} />
              </div>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">When</p>
                <div className="flex flex-wrap gap-1">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={project.teamReadOnly}
                      onClick={() => {
                        setCron(p.cron)
                      }}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                        preset === p.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={project.teamReadOnly}
                    onClick={() => document.getElementById("cron-expr")?.focus()}
                    className={cn(
                      "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                      preset === "custom"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="cron-expr" className="mb-1 text-xs text-muted-foreground">
                  Cron
                </Label>
                <Input
                  id="cron-expr"
                  value={cron}
                  disabled={project.teamReadOnly}
                  className="font-mono text-xs"
                  onChange={(e) => {
                    setCron(e.target.value)
                  }}
                />
              </div>

              <div>
                <Label htmlFor="cron-tz" className="mb-1 text-xs text-muted-foreground">
                  Timezone
                </Label>
                <Input
                  id="cron-tz"
                  value={timezone}
                  disabled={project.teamReadOnly}
                  className="font-mono text-xs"
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>

              <ShareDefaultFiles project={project} docs={docs} defaultDocsByModule={defaultDocsByModule} />

              {error ? (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              ) : null}

              <Button
                type="button"
                disabled={busy || project.teamReadOnly}
                onClick={() => void createCron()}
                {...spineActionProps("schedule.create")}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create cron job
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Schedules</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {runtime?.cronJobReady
                ? "Supabase pg_cron is registered — due jobs fire automatically."
                : "Enable pg_cron + pg_net on this Supabase, or use Run now. Confidential deploys use the same tables."}
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cron jobs yet for this project.</p>
            ) : (
              <ul className="space-y-2">
                {schedules.map((row) => (
                  <li key={row.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">
                          {describeCronExpr(row.cron)} · {row.timezone}
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          Next {timeUntil(row.nextRunAt)} · {row.runCount} run{row.runCount === 1 ? "" : "s"}
                          {row.lastRunAt ? ` · last ${timeAgo(row.lastRunAt)}` : ""}
                        </p>
                        {row.lastError ? (
                          <p className="mt-1 text-[11px] text-destructive">{row.lastError}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={row.enabled ? "secondary" : "outline"} className="font-mono text-[9px]">
                          {row.enabled ? "on" : "off"}
                        </Badge>
                        <Switch
                          checked={row.enabled}
                          disabled={project.teamReadOnly}
                          onCheckedChange={(v) => void toggleEnabled(row, !!v)}
                          {...spineActionProps("schedule.toggle")}
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={runningId === row.id || project.teamReadOnly}
                        onClick={() => void runNow(row)}
                        {...spineActionProps("schedule.run-now")}
                      >
                        {runningId === row.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Run now
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={project.teamReadOnly}
                        onClick={() => void remove(row)}
                        {...spineActionProps("schedule.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 border-t border-border pt-4">
              <Label htmlFor="tick-url" className="mb-1 text-xs text-muted-foreground">
                App URL for pg_cron (confidential / docker: http://host.docker.internal:3000)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tick-url"
                  value={tickUrl}
                  className="font-mono text-xs"
                  placeholder="http://localhost:3000"
                  onChange={(e) => setTickUrl(e.target.value)}
                  disabled={project.teamReadOnly}
                />
                <Button type="button" variant="outline" size="sm" disabled={busy || project.teamReadOnly} onClick={() => void saveTickUrl()}>
                  Save
                </Button>
              </div>
              {runtime?.tickUrl ? (
                <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">Ticks {runtime.tickUrl}</p>
              ) : null}
            </div>
          </section>
        </div>
        {typesInvalid ? null : (
          <p className="mx-auto mt-4 max-w-6xl font-mono text-[10px] text-muted-foreground">
            Tip: assign default files in Inference first — cron reuses those documents on every fire.
          </p>
        )}
      </div>
    </div>
  )
}
