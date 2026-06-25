"use client"

import {
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Zap,
} from "lucide-react"
import {
  blocksInsertBefore,
  insertAfterIndex,
  insertBeforeIndex,
  segmentPipeline,
  type PipelineSegment,
} from "@/lib/pipeline-layout"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import {
  AutoQuoteLock,
  KindIcon,
  PipelineConnector,
  PipelineNode,
} from "@/lib/module-ui"
import type { ModuleId, PipelineModule, RunStepStatus, StructureModel } from "@/lib/types"
import { inputTypeLabel } from "@/lib/inference-input"
import {
  invalidStepMessage,
  warningStepMessage,
  type InvalidStep,
  type PipelineWarning,
} from "@/lib/validity"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { StructureLink } from "@/components/structure-link"

type PipelineCanvasProps = {
  modules: PipelineModule[]
  models: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  invalid?: Map<ModuleId, InvalidStep>
  warnings?: Map<ModuleId, PipelineWarning>
  renderInsertBefore?: (insertAt: number) => React.ReactNode
  renderInsertAfter?: (insertAt: number, opts: { blocked?: boolean; invalid?: boolean }) => React.ReactNode
  renderFooter?: () => React.ReactNode
  className?: string
}

// AI : shared linear pipeline canvas — Logging (read-only) and Pipeline builder (edit + inserts).
export function PipelineCanvas({
  modules,
  models,
  selectedId,
  onSelect,
  stepStatus,
  invalid,
  warnings,
  renderInsertBefore,
  renderInsertAfter,
  renderFooter,
  className,
}: PipelineCanvasProps) {
  const segments = segmentPipeline(modules)
  const editMode = Boolean(renderInsertAfter ?? renderInsertBefore ?? renderFooter)

  return (
    <div className={cn("mx-auto flex w-full max-w-xl flex-col items-stretch gap-0", className)}>
      <div className="mx-auto flex w-full flex-col items-center">
        <PipelineNode label="Start" subtle />
        {segments.length > 0 && renderInsertBefore?.(insertBeforeIndex(segments[0]))}
        {segments.length > 0 && !renderInsertBefore && <PipelineConnector />}
      </div>
      {segments.map((seg) => (
        <SegmentRow
          key={seg.kind === "combine" ? seg.combine.id : seg.module.id}
          seg={seg}
          modules={modules}
          models={models}
          selectedId={selectedId}
          onSelect={onSelect}
          stepStatus={stepStatus}
          invalid={invalid}
          warnings={warnings}
          editMode={editMode}
          renderInsertAfter={renderInsertAfter}
        />
      ))}
      <div className="mx-auto flex w-full flex-col items-center">
        {segments.length === 0 && renderInsertAfter?.(0, {})}
        <PipelineNode label="End" subtle />
        {renderFooter?.()}
      </div>
    </div>
  )
}

function SegmentRow({
  seg,
  modules,
  models,
  selectedId,
  onSelect,
  stepStatus,
  invalid,
  warnings,
  editMode,
  renderInsertAfter,
}: {
  seg: PipelineSegment
  modules: PipelineModule[]
  models: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  invalid?: Map<ModuleId, InvalidStep>
  warnings?: Map<ModuleId, PipelineWarning>
  editMode: boolean
  renderInsertAfter?: (insertAt: number, opts: { blocked?: boolean; invalid?: boolean }) => React.ReactNode
}) {
  const insertAt = insertAfterIndex(seg)
  const blocked = blocksInsertBefore(modules, insertAt)

  if (seg.kind === "combine") {
    const { combine, input, index } = seg
    const combineInvalid = invalid?.has(combine.id)
    const combineStatus = stepStatus?.get(combine.id)
    const inputStatus = stepStatus?.get(input.id)
    const groupSelected = selectedId === combine.id || selectedId === input.id
    return (
      <div className="mx-auto flex w-full flex-col items-center">
        <div
          className={cn(
            "w-full rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors",
            combineInvalid
              ? "border-destructive/70 bg-destructive/5"
              : statusBorder(combineStatus) ?? (
                  groupSelected ? "border-primary bg-primary/5" : "border-chart-3/40 bg-chart-3/5"
                ),
          )}
        >
          <StepButton onClick={() => onSelect?.(combine.id)} className="flex w-full items-start gap-2 text-left">
            <StepIndex index={index} />
            <KindIcon kind="combine" />
            <StepBody
              label={combine.label}
              detail={
                <>
                  <StructureLink models={models} structureId={combine.inStructureId} fallback="pipeline" />
                  <span className="text-muted-foreground/60"> + </span>
                  document
                  <span className="text-muted-foreground/60"> → </span>
                  <StructureLink models={models} structureId={combine.outStructureId} />
                </>
              }
            />
            {combine.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <StepTrailingIcon invalid={combineInvalid} status={combineStatus} editMode={editMode} />
          </StepButton>
          {combine.note && (
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">{combine.note}</p>
          )}
          <StepButton
            onClick={() => onSelect?.(input.id)}
            className={cn(
              "mt-2 flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors",
              selectedId === input.id
                ? "border-primary"
                : statusBorder(inputStatus) ?? "border-border hover:border-muted-foreground/40",
            )}
          >
            <KindIcon kind="input" size="sm" />
            <StepBody
              label={input.label}
              labelClass="text-xs"
              detail={
                <>
                  <StructureLink models={models} structureId={input.outStructureId} />
                  <span className="text-muted-foreground/60"> · </span>
                  {inputTypeLabel(input.inputType)}
                </>
              }
            />
            {!editMode && <RunStatusIcon status={inputStatus} />}
          </StepButton>
        </div>
        <InvalidMessage
          show={combineInvalid}
          message={combineInvalid ? invalidStepMessage(invalid!.get(combine.id)!, models, modules) : undefined}
        />
        {renderInsertAfter?.(insertAt, { blocked, invalid: combineInvalid }) ?? <PipelineConnector />}
      </div>
    )
  }

  const m = seg.module
  const i = seg.index
  const isInvalid = invalid?.has(m.id)
  const stepWarning = warnings?.get(m.id)
  const locked = isAutoQuoteStep(m)
  const status = stepStatus?.get(m.id)

  if (m.kind === "output") {
    return (
      <div className="mx-auto flex w-full flex-col items-center">
        <div className="flex w-full items-center justify-center">
          <div className="relative w-full max-w-xs">
            <StepButton
              onClick={() => onSelect?.(m.id)}
              className={cn(
                "flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-3 text-center transition-colors",
                "border-output/50 bg-output/5 shadow-sm",
                isInvalid && "border-destructive/70 bg-destructive/5",
                statusBorder(status),
                m.id === selectedId && "border-output ring-1 ring-output/40",
                m.id !== selectedId && !isInvalid && !status && "hover:border-output/80 hover:bg-output/10",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <StepIndex index={i} className="text-output/80" />
                <KindIcon kind="output" />
              </div>
              <StepBody
                label={m.label}
                centered
                detail={
                  <>
                    <StructureLink models={models} structureId={m.inStructureId} />
                    <span className="text-output/80"> · snapshot</span>
                  </>
                }
              />
              <div className="flex items-center justify-center gap-1.5">
                {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                {(isInvalid || status) && (
                  <StepTrailingIcon invalid={isInvalid} status={status} editMode={editMode} />
                )}
              </div>
            </StepButton>
            <ArrowRight
              className="pointer-events-none absolute left-full top-1/2 ml-2 h-4 w-4 -translate-y-1/2 text-output"
              aria-hidden
            />
          </div>
        </div>
        <InvalidMessage
          show={isInvalid}
          message={isInvalid ? invalidStepMessage(invalid!.get(m.id)!, models, modules) : undefined}
          className="max-w-xs"
        />
        {renderInsertAfter?.(insertAt, { blocked, invalid: isInvalid }) ?? <PipelineConnector />}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full flex-col items-center">
      <StepButton
        onClick={() => onSelect?.(m.id)}
        className={cn(
          "group relative flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
          locked && "border-dashed border-chart-2/50 bg-chart-2/5",
          isInvalid
            ? "border-destructive/70"
            : statusBorder(status) ?? (
                m.id === selectedId
                  ? "border-primary"
                  : !locked && "border-border hover:border-muted-foreground/40"
              ),
        )}
      >
        <StepIndex index={i} />
        <KindIcon kind={m.kind} />
        <StepBody
          label={m.label}
          detail={
            m.kind === "input" ? (
              <>
                <StructureLink models={models} structureId={m.outStructureId} />
                <span className="text-muted-foreground/60"> · </span>
                {inputTypeLabel(m.inputType)}
              </>
            ) : locked ? (
              <>
                <StructureLink models={models} structureId={m.inStructureId} />
                <span className="text-muted-foreground/60"> · same model in/out</span>
              </>
            ) : (
              <>
                <StructureLink models={models} structureId={m.inStructureId} />
                <span className="text-muted-foreground/60"> → </span>
                <StructureLink models={models} structureId={m.outStructureId} />
              </>
            )
          }
        />
        {locked && <AutoQuoteLock />}
        {m.kind === "llm" && m.model && (
          editMode ? (
            <Badge variant="outline" className="shrink-0 font-mono text-[9px]">
              {m.model}
            </Badge>
          ) : (
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9px]">
              {m.model}
            </span>
          )
        )}
        {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <StepTrailingIcon invalid={isInvalid} status={status} editMode={editMode} />
      </StepButton>
      <InvalidMessage
        show={isInvalid}
        message={isInvalid ? invalidStepMessage(invalid!.get(m.id)!, models, modules) : undefined}
      />
      {!isInvalid && stepWarning && (
        <p className={cn("mt-1 text-center font-mono text-[10px]", WARNING_TEXT_CLASS)}>
          {warningStepMessage(stepWarning, models, modules)}
        </p>
      )}
      {renderInsertAfter?.(insertAt, { blocked, invalid: isInvalid }) ?? <PipelineConnector />}
    </div>
  )
}

function StepButton({
  onClick,
  className,
  children,
}: {
  onClick?: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  )
}

function StepIndex({ index, className }: { index: number; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] text-muted-foreground", className)}>
      {String(index + 1).padStart(2, "0")}
    </span>
  )
}

function StepBody({
  label,
  detail,
  labelClass,
  centered,
}: {
  label: string
  detail: React.ReactNode
  labelClass?: string
  centered?: boolean
}) {
  return (
    <div className={cn("min-w-0 flex-1", centered && "w-full")}>
      <p className={cn("line-clamp-2 text-sm font-medium leading-snug", labelClass, centered && "text-center")}>
        {label}
      </p>
      <p className={cn("line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground", centered && "text-center")}>
        {detail}
      </p>
    </div>
  )
}

function InvalidMessage({
  show,
  message,
  className,
}: {
  show?: boolean
  message?: string
  className?: string
}) {
  if (!show || !message) return null
  return (
    <p className={cn("mt-1 text-center font-mono text-[10px] text-destructive", className)}>
      {message}
    </p>
  )
}

function StepTrailingIcon({
  invalid,
  status,
  editMode,
}: {
  invalid?: boolean
  status?: RunStepStatus
  editMode: boolean
}) {
  if (invalid) return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
  if (!editMode) return <RunStatusIcon status={status} />
  return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

function statusBorder(status?: RunStepStatus): string | undefined {
  if (status === "error") return "border-destructive/70 bg-destructive/5"
  if (status === "cached") return "border-chart-3/50 bg-chart-3/5"
  if (status === "ok") return "border-primary/40"
  return undefined
}

function RunStatusIcon({ status }: { status?: RunStepStatus }) {
  if (status === "cached") return <Zap className="h-3.5 w-3.5 shrink-0 text-chart-3" />
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
  return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}
