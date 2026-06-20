"use client"

import {
  ArrowRight,
  ChevronRight,
  FileInput,
  FileOutput,
  FileText,
  Merge,
  Shuffle,
  Sparkle,
  Code2,
  Link2,
  Zap,
  AlertTriangle,
  Lock,
  type LucideIcon,
} from "lucide-react"
import { segmentPipeline } from "@/lib/pipeline-layout"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { MODULE_META, type ModuleId, type ModuleKind, type PipelineModule, type RunStepStatus, type StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"

// AI : batch llm is a 2×2 sparkle grid so it reads as "many calls" vs single Sparkle.
function BatchSparkleIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-grid grid-cols-2 gap-px leading-none [&_svg]:size-[42%]",
        className,
      )}
    >
      <Sparkle />
      <Sparkle />
      <Sparkle />
      <Sparkle />
    </span>
  )
}

type ModuleIcon = LucideIcon | typeof BatchSparkleIcon

const KIND_ICON: Record<ModuleKind, ModuleIcon> = {
  input: FileInput,
  "doc-to-text": FileText,
  llm: Sparkle,
  "llm-batch": BatchSparkleIcon,
  quote: Link2,
  transform: Shuffle,
  combine: Merge,
  "custom-code": Code2,
  output: FileOutput,
}

const KIND_COLOR: Record<ModuleKind, string> = {
  input: "text-chart-2",
  "doc-to-text": "text-chart-3",
  llm: "text-primary",
  "llm-batch": "text-primary",
  quote: "text-chart-2",
  transform: "text-chart-3",
  combine: "text-chart-3",
  "custom-code": "text-chart-1",
  output: "text-chart-4",
}

function modelName(models: StructureModel[], id?: string) {
  return models.find((m) => m.id === id)?.name
}

type PipelineCanvasProps = {
  modules: PipelineModule[]
  models: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  className?: string
}

// AI : read-only mirror of the Pipeline tab canvas — shared visual for Logging run context.
export function PipelineCanvas({
  modules,
  models,
  selectedId,
  onSelect,
  stepStatus,
  className,
}: PipelineCanvasProps) {
  const segments = segmentPipeline(modules)

  return (
    <div className={cn("mx-auto flex w-full max-w-xl flex-col items-stretch gap-0", className)}>
      <div className="mx-auto flex w-full flex-col items-center">
        <PipelineNode label="Start" subtle />
        {segments.length > 0 && <Connector />}
      </div>
      {segments.map((seg) => {
        if (seg.kind === "combine") {
          const { combine, input, index } = seg
          const combineStatus = stepStatus?.get(combine.id)
          const inputStatus = stepStatus?.get(input.id)
          const groupSelected = selectedId === combine.id || selectedId === input.id
          const pipelineModel = modelName(models, combine.inStructureId)
          const outModel = modelName(models, combine.outStructureId)
          return (
            <div key={combine.id} className="mx-auto flex w-full flex-col items-center">
              <div
                className={cn(
                  "w-full rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors",
                  statusBorder(combineStatus) ?? (
                    groupSelected ? "border-primary bg-primary/5" : "border-chart-3/40 bg-chart-3/5"
                  ),
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect?.(combine.id)}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <KindIcon kind="combine" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium leading-snug">{combine.label}</p>
                    <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                      {pipelineModel ?? "pipeline"}
                      <span className="text-muted-foreground/60"> + </span>
                      document
                      <span className="text-muted-foreground/60"> → </span>
                      {outModel ?? "·"}
                    </p>
                  </div>
                  {combine.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  <RunStatusIcon status={combineStatus} />
                </button>
                {combine.note && (
                  <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    {combine.note}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => onSelect?.(input.id)}
                  className={cn(
                    "mt-2 flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors",
                    selectedId === input.id
                      ? "border-primary"
                      : statusBorder(inputStatus) ?? "border-border hover:border-muted-foreground/40",
                  )}
                >
                  <KindIcon kind="input" size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium leading-snug">{input.label}</p>
                    <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                      {modelName(models, input.outStructureId) ?? "·"} · {input.inputType ?? "file"}
                    </p>
                  </div>
                  <RunStatusIcon status={inputStatus} />
                </button>
              </div>
              <Connector />
            </div>
          )
        }

        const m = seg.module
        const i = seg.index
        const locked = isAutoQuoteStep(m)
        const ioName = modelName(models, m.inStructureId)
        const status = stepStatus?.get(m.id)

        if (m.kind === "output") {
          return (
            <div key={m.id} className="mx-auto flex w-full flex-col items-center">
              <div className="flex w-full items-center justify-center">
                <div className="relative w-full max-w-xs">
                  <button
                    type="button"
                    onClick={() => onSelect?.(m.id)}
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-3 text-center transition-colors",
                      "border-chart-4/50 bg-chart-4/5 shadow-sm",
                      statusBorder(status),
                      m.id === selectedId && "border-chart-4 ring-1 ring-chart-4/40",
                      m.id !== selectedId && !status && "hover:border-chart-4/80 hover:bg-chart-4/10",
                    )}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-[10px] text-chart-4/80">{String(i + 1).padStart(2, "0")}</span>
                      <KindIcon kind="output" />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{m.label}</p>
                      <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                        {modelName(models, m.inStructureId) ?? "·"}
                        <span className="text-chart-4/80"> · snapshot</span>
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-1.5">
                      {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <RunStatusIcon status={status} />
                    </div>
                  </button>
                  <ArrowRight
                    className="pointer-events-none absolute left-full top-1/2 ml-2 h-4 w-4 -translate-y-1/2 text-chart-4"
                    aria-hidden
                  />
                </div>
              </div>
              <Connector />
            </div>
          )
        }

        return (
          <div key={m.id} className="mx-auto flex w-full flex-col items-center">
            <button
              type="button"
              onClick={() => onSelect?.(m.id)}
              className={cn(
                "group relative flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
                locked && "border-dashed border-chart-2/50 bg-chart-2/5",
                statusBorder(status) ?? (
                  m.id === selectedId
                    ? "border-primary"
                    : !locked && "border-border hover:border-muted-foreground/40"
                ),
              )}
            >
              <span className="font-mono text-[10px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <KindIcon kind={m.kind} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug">{m.label}</p>
                <p className="line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground">
                  {m.kind === "input"
                    ? `${modelName(models, m.outStructureId) ?? "·"} · ${m.inputType ?? "file"}`
                    : locked
                      ? <>{ioName ?? "·"}<span className="text-muted-foreground/60"> · same model in/out</span></>
                      : <>
                          {ioName ?? "·"}
                          <span className="text-muted-foreground/60"> → </span>
                          {modelName(models, m.outStructureId) ?? "·"}
                        </>}
                </p>
              </div>
              {locked && <AutoQuoteLock />}
              {m.kind === "llm" && m.model && (
                <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9px]">
                  {m.model}
                </span>
              )}
              {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
              <RunStatusIcon status={status} />
            </button>
            <Connector />
          </div>
        )
      })}
      <div className="mx-auto flex w-full flex-col items-center">
        <PipelineNode label="End" subtle />
      </div>
    </div>
  )
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
  if (status === "ok") return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

function AutoQuoteLock() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 text-chart-2">
      <Lock className="h-3 w-3" />
      <span className="font-mono text-[9px]">auto</span>
    </span>
  )
}

function KindIcon({ kind, size = "md" }: { kind: ModuleKind; size?: "sm" | "md" }) {
  const Icon = KIND_ICON[kind]
  return (
    <div className="flex w-14 shrink-0 flex-col items-center gap-0.5">
      <Icon className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", KIND_COLOR[kind])} />
      <span className="text-center text-[8px] leading-tight text-muted-foreground">
        {MODULE_META[kind].label}
      </span>
    </div>
  )
}

function Connector() {
  return (
    <div className="flex h-8 w-full items-center justify-center">
      <div className="h-full w-px bg-border" />
    </div>
  )
}

function PipelineNode({ label, subtle }: { label: string; subtle?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-wider",
        subtle ? "border-border text-muted-foreground" : "border-primary text-primary",
      )}
    >
      {label}
    </div>
  )
}
