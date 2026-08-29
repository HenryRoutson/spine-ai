"use client"

import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { layoutPipelineDag } from "@/lib/pipeline-dag-layout"
import { pipelineToDag, type PipelineDagEdgeKind } from "@/lib/pipeline-dag"
import { KindIcon, PipelineNode } from "@/lib/module-ui"
import { isExclusiveKind, isNestedLaneKind } from "@/lib/fork-pipeline"
import { MODULE_META, type ModuleId, type PipelineModule, type RunStepStatus, type StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { invalidForModule, type InvalidMap } from "@/lib/validity"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import { formatModuleSpineOut } from "@/lib/spine-type"

type PipelineDagGraphProps = {
  modules: PipelineModule[]
  models?: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  invalid?: InvalidMap
  className?: string
}

function edgeStroke(kind: PipelineDagEdgeKind): string {
  if (kind === "then" || kind === "else" || kind === "lane" || kind === "case") return "color-mix(in oklab, var(--chart-4) 55%, var(--border))"
  if (kind === "side-input" || kind === "trigger") return "var(--muted-foreground)"
  return "var(--border)"
}

export function PipelineDagGraph({
  modules,
  models = [],
  selectedId,
  onSelect,
  stepStatus,
  invalid,
  className,
}: PipelineDagGraphProps) {
  const laid = useMemo(() => layoutPipelineDag(pipelineToDag(modules)), [modules])

  return (
    <div className={cn("relative mx-auto w-full overflow-auto", className)}>
      <div className="relative mx-auto" style={{ width: laid.width, height: laid.height, minWidth: "100%" }}>
        <svg
          width={laid.width}
          height={laid.height}
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
        >
          <defs>
            <marker id="dag-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M 1 1 L 7 4 L 1 7" fill="none" stroke="var(--border)" strokeWidth="1.25" />
            </marker>
          </defs>
          {laid.edges.map((e, i) => {
            if (!e.path) return null
            return (
              <g key={`${e.source}-${e.target}-${e.kind}-${i}`}>
                <path
                  d={e.path}
                  fill="none"
                  stroke={edgeStroke(e.kind)}
                  strokeWidth={1}
                  strokeDasharray={e.dashed ? "4 3" : undefined}
                  markerEnd="url(#dag-arrow)"
                />
              </g>
            )
          })}
        </svg>
        {laid.edges.map((e, i) => {
          if (!e.label || !e.labelAt) return null
          return (
            <span
              key={`lbl-${e.source}-${e.target}-${e.kind}-${i}`}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
              style={{ left: e.labelAt.x, top: e.labelAt.y }}
            >
              {e.label}
            </span>
          )
        })}
        {laid.nodes.map((n) => {
          if (n.kind === "start" || n.kind === "end" || n.kind === "trigger") {
            return (
              <div
                key={n.id}
                className="absolute flex items-center justify-center"
                style={{ left: n.x, top: n.y, width: n.width, height: n.height }}
              >
                <PipelineNode label={n.label} subtle />
              </div>
            )
          }
          const m = n.module
          if (!m) return null
          const issue = invalidForModule(invalid ?? new Map(), m.id)
          const status = stepStatus?.get(m.id)
          const selected = selectedId === m.id
          const forkish = isNestedLaneKind(m.kind)
          const ctx = uiContextTargetProps({
            kind: "pipeline_step",
            id: `step:${m.id}`,
            label: `${m.label} (${m.kind})`,
            moduleId: String(m.id),
            snippet: m.note,
          })
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect?.(m.id)}
              {...ctx}
              className={cn(
                "absolute flex items-start gap-2 overflow-hidden rounded-lg border bg-card px-2.5 py-2 text-left transition-colors",
                forkish && "border-dashed border-chart-4/40 bg-chart-4/5",
                m.kind === "output" && "border-dashed border-output/50 bg-output/5",
                selected && !forkish && m.kind !== "output" && "border-primary ring-1 ring-primary/30",
                selected && forkish && "border-primary bg-primary/5 ring-1 ring-primary/30",
                selected && m.kind === "output" && "border-output ring-1 ring-output/40",
                !selected && !forkish && m.kind !== "output" && "border-border hover:border-muted-foreground/40",
                issue && "border-destructive/70 bg-destructive/5",
                status === "error" && "border-destructive/70 bg-destructive/5",
                status === "skipped" && "opacity-40",
              )}
              style={{ left: n.x, top: n.y, width: n.width, height: n.height }}
            >
              <KindIcon kind={m.kind} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-snug">{m.label}</span>
                <span className="block truncate font-mono text-[10px] leading-snug text-muted-foreground">
                  {isExclusiveKind(m.kind)
                    ? `${n.label.replace(`${m.label}: `, "")} · ${formatModuleSpineOut(m, models)}`
                    : MODULE_META[m.kind].label}
                </span>
              </span>
              {issue ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
