"use client"

// AI : parity ids — pipeline.add-step pipeline.move-step pipeline.validate
// AI : TODO refactor — only extract shared pipeline chrome if a third layout consumer appears (Logging already uses PipelineCanvas).
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Copy,
  Check,
  Lock,
  Zap,
} from "lucide-react"
import { useStore } from "@/lib/store"
import { sessionSnapshotFromStore } from "@/lib/core/store-snapshot"
import { toPipelineView, toValidationView } from "@/lib/core/view"
import { computeInvalidForUi, invalidOptsForDocs } from "@/lib/pipeline-validity-ui"
import { structureIssueMessagesForUi } from "@/lib/structure-validity-ui"
import { computeWorkspaceValidity } from "@/lib/workspace-validity-ui"
import { computeWarnings, formatInvalidMapErrors, InvalidKind, ioMismatchInspectorFix, invalidForModule, invalidIssuesForModule, IoMismatchFixKind, prevModuleId } from "@/lib/validity"
import { LOGGING_SETTINGS_CHANGED_EVENT } from "@/lib/logging-settings"
import { useRerenderOnEvent } from "@/lib/use-browser-pref-event"
import { AUTO_QUOTE_EXPLAINER, isAutoQuoteStep } from "@/lib/quote-steps"
import {
  AUTO_DOC_TO_TEXT_EXPLAINER,
  AUTO_STRUCTURE_PARSE_EXPLAINER,
  authoredPipelineModules,
  isAutoDocToTextStep,
  isAutoStructureParseStep,
  isManagedLockedStep,
  patchInputTargetStructure,
} from "@/lib/structure-parse-steps"
import { moduleMetrics } from "@/lib/billing"
import { managedPipelinePairIds } from "@/lib/pipeline-layout"
import { KindMenuItemIcon, AutoQuoteLock, AutoDocToTextLock, AutoStructureParseLock } from "@/lib/module-ui"
import { makeModule } from "@/lib/pipeline-module-factory"
import { MODULE_META, ModuleKind, type PipelineModule, type ModuleId } from "@/lib/types"
import {
  deriveForkStepTypes,
  deriveIfElseStepTypes,
  findPipelineModule,
  flattenPipelineModules,
  pipelineHasFork,
  insertPipelineModules,
  locatePipelineModule,
  removePipelineModules,
  replacePipelineSiblings,
  updatePipelineModule,
} from "@/lib/fork-pipeline"
import type { PipelineInsertLoc } from "@/lib/pipeline-layout"
import { WindowHeader } from "@/components/window-header"
import { PipelineCanvas } from "@/components/pipeline-canvas"
import { PipelineSummaryBox } from "@/components/pipeline-summary-box"
import { PipelineModuleFields } from "@/components/pipeline-module-fields"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatCostCents, formatSecondsShort } from "@/lib/format"
import { runBilledCents, runTotalMs } from "@/lib/run-metrics"
import { WARNING_TEXT_CLASS, INSPECTOR_SECTION_BORDER_CLASS, INSPECTOR_SECTION_TITLE_CLASS } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import { spineActionProps } from "@/lib/core/parity"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { asModuleKind, builderInsertModuleKinds } from "@/lib/module-kinds"
import { syncListOpsStepModule } from "@/lib/list-ops-steps"
import { deriveAssembleStepTypes, deriveParallelStepTypes } from "@/lib/assemble-type-expr"
import { COPY_FEEDBACK_MS } from "@/lib/ui-timing"
import { copyTextToClipboard } from "@/lib/clipboard"
import { API_ROUTES } from "@/lib/api-routes"
import { FETCH_CREDENTIALS } from "@/lib/api-client"
import { PipelineExportDialog } from "@/components/pipeline-export-dialog"
import { ResizableSplit } from "@/components/resizable-split"
import { InspectorCollapsibleSection } from "@/components/inspector-collapsible-section"
import {
  PIPELINE_INSPECTOR_MAX,
  PIPELINE_INSPECTOR_MIN,
  readPipelineInspectorWidth,
  usePipelineInspectorWidth,
  writePipelineInspectorWidth,
} from "@/lib/editor-split-settings"

export function PipelineBuilder() {
  const {
    modules,
    setModules,
    models,
    setModels,
    model: globalModel,
    runs,
    typeAliases,
    project,
    projects,
    docs,
    inferenceInputDocIds,
  } = useStore()
  const [selectedId, setSelectedId] = useState<string>(modules[0]?.id ?? "")
  const [copied, setCopied] = useState(false)
  useRerenderOnEvent(LOGGING_SETTINGS_CHANGED_EVENT)
  const savedInspectorWidth = usePipelineInspectorWidth()
  const [inspectorWidth, setInspectorWidth] = useState(readPipelineInspectorWidth)
  useEffect(() => setInspectorWidth(savedInspectorWidth), [savedInspectorWidth])

  // AI : same ViewModels as CLI/TUI — invalid badges must not drift from toPipelineView / toValidationView.
  const snap = useMemo(
    () =>
      sessionSnapshotFromStore({
        projects,
        activeProjectId: project.id,
        modules,
        models,
        typeAliases,
        docs,
        inferenceInputDocIds,
      }),
    [projects, project.id, modules, models, typeAliases, docs, inferenceInputDocIds],
  )
  const pipelineView = useMemo(() => toPipelineView(snap), [snap])
  const validationView = useMemo(() => toValidationView(snap), [snap])
  const selectedViewInvalid = pipelineView?.steps.find((s) => s.id === selectedId)?.invalid ?? []

  const selected = findPipelineModule(modules, selectedId)
  const { pipelineEditingBlocked: editingBlocked } = computeWorkspaceValidity(
    modules,
    models,
    typeAliases,
    !!project?.teamReadOnly,
  )
  const typeIssueMessages = structureIssueMessagesForUi(models, typeAliases)
  const invalid = computeInvalidForUi(modules, models, typeAliases, invalidOptsForDocs(docs, inferenceInputDocIds))
  const warnings = computeWarnings(modules, models)
  const warningCount = [...warnings.values()].reduce((n, ws) => n + ws.length, 0)
  const metrics = moduleMetrics(runs)
  const okRuns = runs.filter((r) => r.status === "ok")
  const totalMs =
    okRuns.length > 0 ? okRuns.reduce((a, r) => a + runTotalMs(r), 0) / okRuns.length : null
  const totalCost =
    okRuns.length > 0 ? okRuns.reduce((a, r) => a + runBilledCents(r), 0) / okRuns.length : null
  const cachedCount = flattenPipelineModules(modules).filter((m) => m.cached).length
  const invalidStepCount = pipelineView?.steps.filter((s) => s.invalid.length > 0).length ?? 0
  const validationIssueCount = validationView.issues.length

  function insertModule(kind: ModuleKind, at = modules.length, loc?: PipelineInsertLoc) {
    const fresh: PipelineModule[] =
      kind === ModuleKind.Combine
        ? [
            { ...makeModule(ModuleKind.Input, models, globalModel), label: "Document Input" },
            makeModule(ModuleKind.Combine, models, globalModel),
          ]
        : [makeModule(kind, models, globalModel)]
    const next = insertPipelineModules(modules, at, fresh, loc)
    setModules(next)
    setSelectedId(fresh[fresh.length - 1]!.id)
  }

  function update(id: string, patch: Partial<PipelineModule>) {
    let derivedModels = models
    const loc = locatePipelineModule(modules, id)
    const next = updatePipelineModule(modules, id, (m) => {
      const updated = { ...m, ...patch }
      if (updated.kind === ModuleKind.Output && patch.inStructureId) {
        updated.outStructureId = patch.inStructureId
      }
      const prev = loc?.predecessor
      const span = loc?.siblings ?? modules
      const idx = loc?.index ?? span.findIndex((x) => x.id === id)
      if (updated.kind === ModuleKind.Chunk || updated.kind === ModuleKind.Merge) {
        const synced = syncListOpsStepModule(updated, derivedModels, prev, span)
        derivedModels = synced.models
        return synced.module
      }
      if (updated.kind === ModuleKind.Assemble) {
        const synced = deriveAssembleStepTypes(updated, prev, span, idx, derivedModels)
        derivedModels = synced.models
        return synced.module
      }
      if (updated.kind === ModuleKind.Parallel) {
        const synced = deriveParallelStepTypes(updated, prev, derivedModels)
        derivedModels = synced.models
        return synced.module
      }
      if (updated.kind === ModuleKind.IfElse) {
        const synced = deriveIfElseStepTypes(updated, prev, derivedModels)
        derivedModels = synced.models
        return synced.module
      }
      if (updated.kind === ModuleKind.Fork) {
        const synced = deriveForkStepTypes(updated, prev, derivedModels, typeAliases)
        derivedModels = synced.models
        return synced.module
      }
      return updated
    })
    if (derivedModels !== models) setModels(derivedModels)
    if (patch.outStructureId !== undefined) {
      const step = findPipelineModule(modules, id)
      if (step?.kind === ModuleKind.Input) {
        setModules(patchInputTargetStructure(next, id as ModuleId, patch.outStructureId))
        return
      }
    }
    setModules(next)
  }

  function fixIoMismatch(moduleId: string, kind: IoMismatchFixKind) {
    const issue = invalidForModule(invalid, moduleId as ModuleId)
    if (!issue || (issue.kind !== InvalidKind.IoMismatch && issue.kind !== InvalidKind.CardinalityMismatch)) return
    if (kind === IoMismatchFixKind.AdoptUpstream && issue.upstreamEmits) {
      const m = findPipelineModule(modules, moduleId)
      const patch: Partial<PipelineModule> = { inStructureId: issue.upstreamEmits }
      if (m?.kind === ModuleKind.Output) patch.outStructureId = issue.upstreamEmits
      update(moduleId, patch)
      return
    }
    if (kind === IoMismatchFixKind.AlignUpstream && issue.expects) {
      const prevId = prevModuleId(modules, moduleId as ModuleId)
      if (prevId) update(prevId, { outStructureId: issue.expects })
    }
  }

  function remove(id: string) {
    const m = findPipelineModule(modules, id)
    if (m && isManagedLockedStep(m)) return
    const drop = new Set(managedPipelinePairIds(modules, id))
    const next = removePipelineModules(modules, drop)
    setModules(next)
    if (drop.has(selectedId)) setSelectedId(next[0]?.id ?? "")
  }

  function move(id: string, dir: -1 | 1) {
    const loc = locatePipelineModule(modules, id)
    if (!loc) return
    if (isManagedLockedStep(loc.module)) return
    const ids = managedPipelinePairIds(modules, id)
    const block = ids.map((x) => loc.siblings.find((m) => m.id === x)!).filter(Boolean)
    const rest = loc.siblings.filter((m) => !ids.includes(m.id))
    const at = loc.siblings.findIndex((m) => m.id === ids[0])
    const insertAt = dir === -1 ? at - 1 : at + ids.length
    if (insertAt < 0 || insertAt > rest.length) return
    const nextSiblings = [...rest.slice(0, insertAt), ...block, ...rest.slice(insertAt)]
    setModules(replacePipelineSiblings(modules, loc, nextSiblings))
  }

  async function copyPipelineJson() {
    const json = JSON.stringify({ models, modules: authoredPipelineModules(modules), typeAliases }, null, 2)
    let extra = ""
    try {
      const res = await fetch(API_ROUTES.pipelineLint, {
        method: "POST",
        credentials: FETCH_CREDENTIALS,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...project, modules, models, typeAliases }),
      })
      if (res.ok) {
        const data = (await res.json()) as { copyText?: string }
        if (data.copyText?.trim()) extra = `\n\n${data.copyText}\n`
      }
    } catch {
      extra = ""
    }
    if (!extra) {
      const validationErrors = formatInvalidMapErrors(invalid, modules, models)
      extra = validationErrors.trim()
        ? `\n\nCurrent pipeline validation errors:\n${validationErrors}\n`
        : "\n\nCurrent pipeline: valid (no I/O errors).\n"
    }
    await copyTextToClipboard(`${json}${extra}`)
    setCopied(true)
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS)
  }

  const invalidMap = invalid
  const warningMap = warnings


  return (
    <TooltipProvider delay={200}>
      <div className="flex h-full flex-col">
        <WindowHeader
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
              <PipelineExportDialog project={project} modules={modules} models={models} typeAliases={typeAliases} />
              <span className="text-muted-foreground">
                {totalMs != null ? `~${formatSecondsShort(totalMs)} avg` : "— avg"}
              </span>
              <span className="text-muted-foreground">
                {totalCost != null ? `${formatCostCents(totalCost)}/run` : "—/run"}
              </span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Zap className="h-3 w-3 text-primary" /> {cachedCount} cached
              </Badge>
              {invalidStepCount > 0 && (
                <Badge variant="outline" className="gap-1 border-destructive/50 text-[10px] text-destructive" {...spineActionProps("pipeline.validate")}>
                  <AlertTriangle className="h-3 w-3" /> {invalidStepCount} invalid
                  {validationIssueCount > invalidStepCount ? ` · ${validationIssueCount} issues` : ""}
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

        {project.teamReadOnly && (
          <div className="border-b border-border bg-muted/40 px-4 py-2.5">
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              Read-only team project — you can view and run, but not edit.
            </p>
          </div>
        )}

        {editingBlocked && !project.teamReadOnly && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2.5">
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-destructive">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Fix type errors in Structure before editing the pipeline.
            </p>
            <ul className="mt-1.5 space-y-0.5 pl-5 font-mono text-[10px] text-destructive/90">
              {typeIssueMessages.slice(0, 5).map((msg) => (
                <li key={msg} className="list-disc">
                  {msg}
                </li>
              ))}
              {typeIssueMessages.length > 5 && (
                <li className="list-none text-destructive/70">
                  +{typeIssueMessages.length - 5} more…
                </li>
              )}
            </ul>
          </div>
        )}

        <ResizableSplit
          className="min-h-0 flex-1"
          fixedSide="trailing"
          leadingWidth={inspectorWidth}
          onLeadingWidthChange={setInspectorWidth}
          onLeadingWidthCommit={writePipelineInspectorWidth}
          minLeading={PIPELINE_INSPECTOR_MIN}
          maxLeading={PIPELINE_INSPECTOR_MAX}
          leading={
            <div className="min-h-0 min-w-0 flex-1 overflow-auto">
              <div className={cn("mx-auto flex min-h-full w-full flex-col items-stretch px-6 py-8", pipelineHasFork(modules) ? "max-w-none" : "max-w-4xl")}>
                <PipelineCanvas
                  modules={modules}
                  models={models}
                  selectedId={selectedId as ModuleId}
                  onSelect={setSelectedId}
                  invalid={invalidMap}
                  warnings={warningMap}
                  onPatchFork={(id, patch) => update(id, patch)}
                  renderInsertBefore={(insertAt) => (
                    <InsertSlot insertAt={insertAt} onInsert={insertModule} blocked={editingBlocked} />
                  )}
                  renderInsertAfter={(insertAt, opts) => (
                    <InsertSlot
                      insertAt={insertAt}
                      onInsert={insertModule}
                      connectionInvalid={opts.connectionInvalid}
                      blocked={editingBlocked || opts.blocked}
                      loc={opts.forkId && opts.branchId ? { forkId: opts.forkId, branchId: opts.branchId } : undefined}
                    />
                  )}
                  renderFooter={() => (
                    <div className="mt-6 flex w-full flex-col items-center">
                      {!editingBlocked && (
                        <AddStepMenu insertAt={modules.length} onInsert={insertModule} variant="button" />
                      )}
                      <PipelineSummaryBox />
                    </div>
                  )}
                />
              </div>
            </div>
          }
          trailing={
            // AI : fill fixed right pane height so InspectorCollapsibleSection overflow-y-auto can scroll
            <aside className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-l border-border/80 bg-muted/20">
              <div className="shrink-0 border-b border-border/60 px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Step inspector</p>
              </div>
              <InspectorCollapsibleSection title="Inspector" variant="panel" fill>
                {selected ? (
                  <div className="space-y-3">
                    <div
                      className={cn(
                        "flex items-center justify-between rounded-lg border bg-card/50 px-3 py-2",
                        INSPECTOR_SECTION_BORDER_CLASS,
                      )}
                      {...uiContextTargetProps({
                        kind: "pipeline_step",
                        id: `step:${selected.id}`,
                        label: selected.label?.trim() || MODULE_META[selected.kind].label,
                        moduleId: selected.id,
                        snippet: `${MODULE_META[selected.kind].label} · ${selected.kind}`,
                      })}
                    >
                      <span className={INSPECTOR_SECTION_TITLE_CLASS}>
                        {MODULE_META[selected.kind].label}
                      </span>
                      {selectedViewInvalid.length > 0 ? (
                        <ul className="mb-2 list-disc space-y-0.5 pl-4 font-mono text-[10px] text-destructive">
                          {selectedViewInvalid.map((msg) => (
                            <li key={msg}>{msg}</li>
                          ))}
                        </ul>
                      ) : null}
                      {isAutoQuoteStep(selected) ? (
                        <AutoLockTooltip explainer={AUTO_QUOTE_EXPLAINER}>
                          <AutoQuoteLock />
                        </AutoLockTooltip>
                      ) : isAutoDocToTextStep(selected) ? (
                        <AutoLockTooltip explainer={AUTO_DOC_TO_TEXT_EXPLAINER}>
                          <AutoDocToTextLock />
                        </AutoLockTooltip>
                      ) : isAutoStructureParseStep(selected) ? (
                        <AutoLockTooltip explainer={AUTO_STRUCTURE_PARSE_EXPLAINER}>
                          <AutoStructureParseLock />
                        </AutoLockTooltip>
                      ) : editingBlocked ? null : (
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" spineId="pipeline.move-step" onClick={() => move(selected.id, -1)}>
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
                      typeAliases={typeAliases}
                      modules={modules}
                      mode={editingBlocked ? "view" : "edit"}
                      globalModel={globalModel}
                      invalid={invalidForModule(invalid, selected.id)}
                      invalidIssues={invalidIssuesForModule(invalid, selected.id)}
                      warnings={warnings.get(selected.id)}
                      ioMismatchFix={ioMismatchInspectorFix(selected.id as ModuleId, modules, invalid, models)}
                      onUpdate={editingBlocked ? undefined : (patch) => update(selected.id, patch)}
                      onFixIoMismatch={
                        editingBlocked ? undefined : (mismatchModuleId, kind) => fixIoMismatch(mismatchModuleId, kind)
                      }
                    />
                    {!isManagedLockedStep(selected) && (
                      <InspectorCollapsibleSection title="Performance">
                        <div className="grid grid-cols-2 gap-2">
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
                      </InspectorCollapsibleSection>
                    )}
                  </div>
                ) : (
                  <div className="flex min-h-48 items-center justify-center text-center">
                    <p className="text-xs text-muted-foreground">
                      Add a module and select it to configure.
                    </p>
                  </div>
                )}
              </InspectorCollapsibleSection>
            </aside>
          }
        />
      </div>
    </TooltipProvider>
  )
}

function AutoLockTooltip({ children, explainer }: { children: ReactNode; explainer: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="inline-flex shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs text-left leading-relaxed">
        {explainer}
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
  loc,
}: {
  insertAt: number
  onInsert: (kind: ModuleKind, at: number, loc?: PipelineInsertLoc) => void
  connectionInvalid?: boolean
  alwaysShow?: boolean
  blocked?: boolean
  loc?: PipelineInsertLoc
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
      <AddStepMenu insertAt={insertAt} onInsert={onInsert} variant="slot" alwaysShow={alwaysShow} loc={loc} />
    </div>
  )
}

function AddStepMenu({
  insertAt,
  onInsert,
  variant,
  alwaysShow,
  loc,
}: {
  insertAt: number
  onInsert: (kind: ModuleKind, at: number, loc?: PipelineInsertLoc) => void
  variant: "slot" | "button"
  alwaysShow?: boolean
  loc?: PipelineInsertLoc
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
        {...spineActionProps("pipeline.add-step")}
      >
        <Plus className={variant === "slot" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {variant === "button" && <span>Add step</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="min-w-56 p-1.5">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-1 font-mono text-[10px] text-muted-foreground">
            Insert step
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup className="space-y-0.5">
          {builderInsertModuleKinds({ inForkLane: !!loc, rootInsertAt: insertAt }).map((k) => (
            <DropdownMenuItem
              key={k}
              onClick={() => onInsert(asModuleKind(k), insertAt, loc)}
              className="gap-3 px-2 py-2"
            >
              <KindMenuItemIcon kind={asModuleKind(k)} />
              <span className="min-w-0 flex-1 truncate">{MODULE_META[asModuleKind(k)].label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cn("rounded-md border px-3 py-2", INSPECTOR_SECTION_BORDER_CLASS)}>
      <p className="font-mono text-[10px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  )
}
