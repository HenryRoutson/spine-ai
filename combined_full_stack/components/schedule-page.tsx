"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertTriangle, Clock, Loader2, Play, Plus, Trash2 } from "lucide-react"
import { ShareDefaultFiles } from "@/components/share/share-default-files"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PipelineObserveEmpty } from "@/components/pipeline-observe-empty"
import { Badge } from "@/components/ui/badge"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import {
  cronFromFriendlySchedule,
  describeCronExpr,
  howOftenMeta,
  isValidCronExpr,
  isValidIanaTimeZone,
  parseClockInput,
  SCHEDULE_HOW_OFTEN,
  schedulePreviewSentence,
  scheduleTimeZoneOptions,
  timezoneCity,
  WEEKDAY_OPTIONS,
  type FriendlySchedule,
  type ScheduleHowOftenId,
  type weekday_sun0,
} from "@/lib/cron-expr"
import { shareDefaultDocsByModule } from "@/lib/share-default-docs"
import type { PipelineScheduleRecord, PipelineScheduleRuntime } from "@/lib/schedule-types"
import { useStore } from "@/lib/store"
import { activeFunction, activeFunctionId, functionNameOnProject } from "@/lib/pipeline-functions"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { spineActionProps } from "@/lib/core/parity"
import { timeAgo, timeUntil } from "@/lib/time-ago"
import { useAppShell } from "@/lib/app-shell"

function browserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    return isValidIanaTimeZone(tz) ? tz : "UTC"
  } catch {
    return "UTC"
  }
}

const DEFAULT_CLOCK = "09:00"
const DEFAULT_HOW_OFTEN: ScheduleHowOftenId = "daily"
const DEFAULT_WEEKDAY: weekday_sun0 = 1

function friendlyCron(howOften: ScheduleHowOftenId, clock: string, weekday: weekday_sun0): string {
  const parsed = parseClockInput(clock) ?? { hour: 9, minute: 0 }
  const spec: FriendlySchedule = { howOften, hour: parsed.hour, minute: parsed.minute, weekday }
  return cronFromFriendlySchedule(spec)
}

export function SchedulePage({ simple }: { simple?: boolean } = {}) {
  const { project, docs, inferenceInputDocIds, modules, models, typeAliases } = useStore()
  const schedulingFn = activeFunction(project)
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
  const [name, setName] = useState("Every day at 9:00 AM")
  const [nameTouched, setNameTouched] = useState(false)
  const [howOften, setHowOften] = useState<ScheduleHowOftenId>(DEFAULT_HOW_OFTEN)
  const [clock, setClock] = useState(DEFAULT_CLOCK)
  const [weekday, setWeekday] = useState<weekday_sun0>(DEFAULT_WEEKDAY)
  const cron = friendlyCron(howOften, clock, weekday)
  const [timezone, setTimezone] = useState(browserTimeZone)
  const [tickUrl, setTickUrl] = useState("")
  const [runningId, setRunningId] = useState<string | null>(null)
  const whenMeta = howOftenMeta(howOften)
  const tzOptions = useMemo(() => scheduleTimeZoneOptions(browserTimeZone()), [])

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

  useEffect(() => {
    if (!nameTouched) setName(describeCronExpr(cron))
  }, [cron, nameTouched])

  if (runTabsBlocked) {
    return (
      <PipelineObserveEmpty
        title="Fix the pipeline first"
        copy="Scheduled runs use the same files as Inference. Repair Structure or Pipeline, then come back here."
      />
    )
  }

  async function createCron() {
    setBusy(true)
    setError(null)
    try {
      if (!isValidIanaTimeZone(timezone)) throw new Error("Pick a time zone from the list")
      if (!isValidCronExpr(cron)) throw new Error("That schedule isn't valid — try another combination")
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
          functionId: activeFunctionId(project),
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
    if (!window.confirm(`Delete “${row.name}”? This stops future automatic runs.`)) return
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
                <h3 className="text-sm font-semibold">{simple ? "Run this on a schedule" : "New schedule"}</h3>
                <p className="text-xs text-muted-foreground">
                  {simple
                    ? `This runs ${schedulingFn.name}. Switch pipelines in the header to schedule a different one.`
                    : `Choose how often ${schedulingFn.name} should run. Each time, we’ll reuse the files you picked in Inference.`}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="schedule-name" className="mb-1 text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="schedule-name"
                  value={name}
                  disabled={project.teamReadOnly}
                  onChange={(e) => {
                    setNameTouched(true)
                    setName(e.target.value)
                  }}
                />
              </div>

              <div>
                <Label htmlFor="schedule-how-often" className="mb-1 text-xs text-muted-foreground">
                  How often
                </Label>
                <Select
                  value={howOften}
                  disabled={project.teamReadOnly}
                  items={SCHEDULE_HOW_OFTEN.map((row) => ({ value: row.id, label: row.label }))}
                  onValueChange={(v) => {
                    if (v) setHowOften(v as ScheduleHowOftenId)
                  }}
                >
                  <SelectTrigger id="schedule-how-often" className="h-8 w-full min-w-0 text-sm">
                    <SelectValue>{whenMeta.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULE_HOW_OFTEN.map((row) => (
                      <SelectItem key={row.id} value={row.id} label={row.label} className="text-sm">
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {whenMeta.needsWeekday ? (
                <div>
                  <Label htmlFor="schedule-weekday" className="mb-1 text-xs text-muted-foreground">
                    Day of the week
                  </Label>
                  <Select
                    value={String(weekday)}
                    disabled={project.teamReadOnly}
                    items={WEEKDAY_OPTIONS.map((row) => ({ value: String(row.value), label: row.label }))}
                    onValueChange={(v) => {
                      if (v != null) setWeekday(Number(v) as weekday_sun0)
                    }}
                  >
                    <SelectTrigger id="schedule-weekday" className="h-8 w-full min-w-0 text-sm">
                      <SelectValue>
                        {WEEKDAY_OPTIONS.find((row) => row.value === weekday)?.label ?? "Monday"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAY_OPTIONS.map((row) => (
                        <SelectItem key={row.value} value={String(row.value)} label={row.label} className="text-sm">
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {whenMeta.needsTime ? (
                <div>
                  <Label htmlFor="schedule-time" className="mb-1 text-xs text-muted-foreground">
                    Time
                  </Label>
                  <Input
                    id="schedule-time"
                    type="time"
                    step={60}
                    value={clock}
                    disabled={project.teamReadOnly}
                    onChange={(e) => {
                      const next = e.target.value
                      if (parseClockInput(next)) setClock(next)
                    }}
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="schedule-tz" className="mb-1 text-xs text-muted-foreground">
                  Time zone
                </Label>
                <Select
                  value={timezone}
                  disabled={project.teamReadOnly}
                  items={tzOptions}
                  onValueChange={(v) => {
                    if (v) setTimezone(v)
                  }}
                >
                  <SelectTrigger id="schedule-tz" className="h-8 w-full min-w-0 text-sm">
                    <SelectValue>
                      {tzOptions.find((row) => row.value === timezone)?.label ?? timezoneCity(timezone)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {tzOptions.map((row) => (
                      <SelectItem key={row.value} value={row.value} label={row.label} className="text-sm">
                        {row.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {schedulePreviewSentence(cron, timezone)}
              </p>

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
                Create schedule
              </Button>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Your schedules</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {runtime?.cronJobReady
                ? "These will run on their own. Turn one off anytime, or use Run now to fire it immediately."
                : "Saved schedules can still be started with Run now. Automatic running isn’t set up on this server yet."}
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading…
              </div>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-muted-foreground">None yet — create one on the left.</p>
            ) : (
              <ul className="space-y-2">
                {schedules.map((row) => (
                  <li key={row.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {functionNameOnProject(project, row.functionId)}
                          {" · "}
                          {describeCronExpr(row.cron)}
                          {row.timezone === "UTC" ? " · UTC" : ` · ${timezoneCity(row.timezone)} time`}
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Next {timeUntil(row.nextRunAt)} · {row.runCount} run{row.runCount === 1 ? "" : "s"}
                          {row.lastRunAt ? ` · last ${timeAgo(row.lastRunAt)}` : ""}
                        </p>
                        {row.lastError ? (
                          <p className="mt-1 text-[11px] text-destructive">{row.lastError}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={row.enabled ? "secondary" : "outline"} className="text-[10px]">
                          {row.enabled ? "On" : "Off"}
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

            <details className="mt-5 border-t border-border pt-4">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                Advanced: server URL for automatic runs
              </summary>
              <div className="mt-3">
                <Label htmlFor="tick-url" className="mb-1 text-xs text-muted-foreground">
                  Only needed for self-hosted setups. Most people can ignore this.
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="tick-url"
                    value={tickUrl}
                    className="text-xs"
                    placeholder="http://localhost:3000"
                    onChange={(e) => setTickUrl(e.target.value)}
                    disabled={project.teamReadOnly}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={busy || project.teamReadOnly} onClick={() => void saveTickUrl()}>
                    Save
                  </Button>
                </div>
              </div>
            </details>
          </section>
        </div>
        {typesInvalid ? null : (
          <p className="mx-auto mt-4 max-w-6xl text-[11px] text-muted-foreground">
            Tip: pick default files in Inference first — each scheduled run uses those.
          </p>
        )}
      </div>
    </div>
  )
}
