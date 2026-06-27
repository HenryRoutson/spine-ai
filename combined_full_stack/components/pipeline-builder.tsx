"use client"

import { useState } from "react"
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Copy,
  Check,
  Lock,
  Sparkle,
  Zap,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { computeInvalidForUi } from "@/lib/pipeline-validity-ui"
import { computeWarnings, ioMismatchInspectorFix, invalidForModule, invalidIssuesForModule, prevModuleId, type IoMismatchFixKind } from "@/lib/validity"
import { LOGGING_SETTINGS_CHANGED_EVENT } from "@/lib/logging-settings"
import { useRerenderOnEvent } from "@/lib/use-browser-pref-event"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import { moduleMetrics } from "@/lib/billing"
import { combinePairIds } from "@/lib/pipeline-layout"
import { KIND_COLOR, KIND_ICON } from "@/lib/module-ui"
import { makeModule } from "@/lib/pipeline-module-factory"
import { MODULE_META, type ModuleKind, type PipelineModule, type ModuleId } from "@/lib/types"
import { WindowHeader } from "@/components/window-header"
import { PipelineAssistant } from "@/components/pipeline-assistant"
import { PipelineCanvas } from "@/components/pipeline-canvas"
import { PipelineSummaryBox } from "@/components/pipeline-summary-box"
import { PipelineModuleFields } from "@/components/pipeline-module-fields"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { USER_ADDABLE_MODULE_KINDS } from "@/lib/module-kinds"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"

type AsideTab = "inspector" | "assistant"

export function PipelineBuilder() {
  const { modules, setModules, models, model: globalModel, runs } = useStore()
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.id ?? "")
  const [copied, setCopied] = useState(false)
  const [asideTab, setAsideTab] = useState<AsideTab>("inspector")
  useRerenderOnEvent(LOGGING_SETTINGS_CHANGED_EVENT)

  const selected = modules.find((m) => m.id === selectedId)
  const invalid = computeInvalidForUi(modules, models)
  const warnings = computeWarnings(modules, models)
  const warningCount = [...warnings.values()].reduce((n, ws) => n + ws.length, 0)
  const metrics = moduleMetrics(runs)
  const okRuns = runs.filter((r) => r.status === "ok")
  const totalMs =
    okRuns.length > 0 ? okRuns.reduce((a, r) => a + runTotalMs(r), 0) / okRuns.length : null
  const totalCost =
    okRuns.length > 0 ? okRuns.reduce((a, r) => a + runBilledCents(r), 0) / okRuns.length : null
  const cachedCount = modules.filter((m) => m.cached).length

  function insertModule(kind: ModuleKind, at = modules.length) {
    const fresh: PipelineModule[] =
      kind === "combine"
        ? [
            { ...makeModule("input", models, globalModel), label: "Document Input" },
            makeModule("combine", models, globalModel),
          ]
        : [makeModule(kind, models, globalModel)]
    const next = [...modules.slice(0, at), ...fresh, ...modules.slice(at)]
    setModules(next)
    setSelectedId(fresh[fresh.length - 1].id)
  }

  function update(id: string, patch: Partial<PipelineModule>) {
    setModules(
      modules.map((m) => {
        if (m.id !== id) return m
        const next = { ...m, ...patch }
        if (next.kind === "output" && patch.inStructureId) {
          next.outStructureId = patch.inStructureId
        }
        return next
      }),
    )
  }

  function fixIoMismatch(moduleId: string, kind: IoMismatchFixKind) {
    const issue = invalidForModule(invalid, moduleId as ModuleId)
    if (!issue || (issue.kind !== "io-mismatch" && issue.kind !== "cardinality-mismatch")) return
    if (kind === "adopt-upstream" && issue.upstreamEmits) {
      const m = modules.find((x) => x.id === moduleId)
      const patch: Partial<PipelineModule> = { inStructureId: issue.upstreamEmits }
      if (m?.kind === "output") patch.outStructureId = issue.upstreamEmits
      update(moduleId, patch)
      return
    }
    if (kind === "align-upstream" && issue.expects) {
      const prevId = prevModuleId(modules, moduleId as ModuleId)
      if (prevId) update(prevId, { outStructureId: issue.expects })
    }
  }

  function remove(id: string) {
    const m = modules.find((x) => x.id === id)
    if (m && isAutoQuoteStep(m)) return
    const drop = new Set(combinePairIds(modules, id))
    const next = modules.filter((m) => !drop.has(m.id))
    setModules(next)
    if (drop.has(selectedId)) setSelectedId(next[0]?.id ?? "")
  }

  function move(id: string, dir: -1 | 1) {
    const m = modules.find((x) => x.id === id)
    if (m && isAutoQuoteStep(m)) return
    const ids = combinePairIds(modules, id)
    const block = ids.map((x) => modules.find((m) => m.id === x)!)
    const rest = modules.filter((m) => !ids.includes(m.id))
    const at = modules.findIndex((m) => m.id === ids[0])
    const insertAt = dir === -1 ? at - 1 : at + ids.length
    if (insertAt < 0 || insertAt > rest.length) return
    const next = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]
    setModules(next)
  }

  async function copyPipelineJson() {
    const json = JSON.stringify({ models, modules }, null, 2)
    await navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  const invalidMap = invalid
  const warningMap = warnings

  return (
    <TooltipProvider delay={200}>
      <div className="flex h-full flex-col">
        <WindowHeader
          step="02 / Pipeline"
          title="Linear Pipeline"
          description="Each step declares its input and output model. Mismatched I/O is flagged — there is no explicit validation step."
          actions={
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-[10px]"
                onClick={() => void copyPipelineJson()}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy prompt"}
              </Button>
              <span className="text-muted-foreground">
                {totalMs != null ? `~${formatSecondsShort(totalMs)} avg` : "— avg"}
              </span>
              <span className="text-muted-foreground">
                {totalCost != null ? `${formatCostCents(totalCost)}/run` : "—/run"}
              </span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Zap className="h-3 w-3 text-primary" /> {cachedCount} cached
              </Badge>
              {invalid.size > 0 && (
                <Badge variant="outline" className="gap-1 border-destructive/50 text-[10px] text-destructive">
                  <AlertTriangle className="h-3 w-3" /> {invalid.size} invalid
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="outline" className={cn("gap-1 border-amber-500/50 text-[10px]", WARNING_TEXT_CLASS)}>
                  <AlertTriangle className="h-3 w-3" /> {warningCount} warning{warningCount === 1 ? "" : "s"}
                </Badge>
              )}
            </div>
          }
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,44%)]">
          <div className="min-w-0 overflow-auto">
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-stretch px-6 py-8">
              <PipelineCanvas
                modules={modules}
                models={models}
                selectedId={selectedId as ModuleId}
                onSelect={setSelectedId}
                invalid={invalidMap}
                warnings={warningMap}
                renderInsertBefore={(insertAt) => (
                  <InsertSlot insertAt={insertAt} onInsert={insertModule} />
                )}
                renderInsertAfter={(insertAt, opts) => (
                  <InsertSlot
                    insertAt={insertAt}
                    onInsert={insertModule}
                    connectionInvalid={opts.connectionInvalid}
                    blocked={opts.blocked}
                  />
                )}
                renderFooter={() => (
                  <div className="mt-6 flex w-full flex-col items-center">
                    <AddStepMenu insertAt={modules.length} onInsert={insertModule} variant="button" />
                    <PipelineSummaryBox />
                  </div>
                )}
              />
            </div>
          </div>

          <aside className="flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-l border-border">
            <div className="flex border-b border-border">
              <button
                type="button"
                onClick={() => setAsideTab("inspector")}
                className={cn(
                  "flex-1 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  asideTab === "inspector"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Inspector
              </button>
              <button
                type="button"
                onClick={() => setAsideTab("assistant")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-3 py-2 font-mono text-[10px] uppercase tracking-wider transition-colors",
                  asideTab === "assistant"
                    ? "border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkle className="h-3 w-3" />
                Assistant
              </button>
            </div>

            {asideTab === "assistant" ? (
              <PipelineAssistant />
            ) : selected ? (
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {MODULE_META[selected.kind].label}
                  </span>
                  {isAutoQuoteStep(selected) ? (
                    <AutoQuoteLockTooltip />
                  ) : (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(selected.id, -1)}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => move(selected.id, 1)}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(selected.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <PipelineModuleFields
                  module={selected}
                  models={models}
                  modules={modules}
                  mode="edit"
                  globalModel={globalModel}
                  invalid={invalidForModule(invalid, selected.id)}
                  invalidIssues={invalidIssuesForModule(invalid, selected.id)}
                  warnings={warnings.get(selected.id)}
                  ioMismatchFix={ioMismatchInspectorFix(selected.id as ModuleId, modules, invalid, models)}
                  onUpdate={(patch) => update(selected.id, patch)}
                  onFixIoMismatch={(mismatchModuleId, kind) => fixIoMismatch(mismatchModuleId, kind)}
                />
                {!isAutoQuoteStep(selected) && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Stat
                      label="avg latency"
                      value={
                        metrics.has(selected.id) ? `${metrics.get(selected.id)!.avgMs}ms` : "—"
                      }
                    />
                    <Stat
                      label="avg cost"
                      value={
                        metrics.has(selected.id)
                          ? formatCostCents(metrics.get(selected.id)!.avgCostCents)
                          : "—"
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Add a module and select it to configure, or use the Assistant tab.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </TooltipProvider>
  )
}

function AutoQuoteLockTooltip() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2"
        onClick={(e) => e.stopPropagation()}
      >
        <Lock className="h-3 w-3" />
        <span className="font-mono text-[9px]">auto</span>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-left leading-relaxed">
        {AUTO_QUOTE_EXPLAINER}
      </TooltipContent>
    </Tooltip>
  )
}

function InsertSlot({
  insertAt,
  onInsert,
  connectionInvalid,
  alwaysShow,
  blocked,
}: {
  insertAt: number
  onInsert: (kind: ModuleKind, at: number) => void
  connectionInvalid?: boolean
  alwaysShow?: boolean
  blocked?: boolean
}) {
  if (blocked) {
    return <div className="h-4 w-px bg-border/60" aria-hidden />
  }
  return (
    <div className="group relative flex h-8 w-full items-center justify-center">
      <div
        className={cn(
          "absolute h-full w-px transition-colors",
          connectionInvalid ? "bg-destructive" : "bg-border group-hover:bg-muted-foreground/40",
        )}
      />
      <AddStepMenu insertAt={insertAt} onInsert={onInsert} variant="slot" alwaysShow={alwaysShow} />
    </div>
  )
}

function AddStepMenu({
  insertAt,
  onInsert,
  variant,
  alwaysShow,
}: {
  insertAt: number
  onInsert: (kind: ModuleKind, at: number) => void
  variant: "slot" | "button"
  alwaysShow?: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          variant === "slot"
            ? cn(
                "relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all hover:border-primary hover:bg-primary/10 hover:text-primary",
                alwaysShow
                  ? "opacity-100"
                  : "opacity-30 group-hover:opacity-100 data-popup-open:opacity-100",
              )
            : "inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-border bg-transparent px-3 text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground",
        )}
        aria-label="Add pipeline step"
      >
        <Plus className={variant === "slot" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {variant === "button" && <span>Add step</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            Insert step
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {USER_ADDABLE_MODULE_KINDS.map((k) => {
            const Icon = KIND_ICON[k]
            return (
              <DropdownMenuItem key={k} onClick={() => onInsert(k, insertAt)} className="gap-2">
                <Icon className={cn("h-3.5 w-3.5", KIND_COLOR[k])} />
                <span>{MODULE_META[k].label}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  )
}
