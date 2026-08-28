"use client"

import { useMemo } from "react"
import { AlertTriangle } from "lucide-react"
import { layoutPipelineDag } from "@/lib/pipeline-dag-layout"
import { pipelineToDag } from "@/lib/pipeline-dag"
import { KIND_COLOR, KIND_ICON, KIND_SURFACE } from "@/lib/module-ui"
import { cn } from "@/lib/utils"
import { invalidForModule, type InvalidMap } from "@/lib/validity"
import type { ModuleId, PipelineModule, RunStepStatus } from "@/lib/types"

type PipelineDagGraphProps = {
  modules: PipelineModule[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  invalid?: InvalidMap
  className?: string
}

function edgeStroke(kind: string): string {
  if (kind === "then") return "var(--chart-2)"
  if (kind === "else") return "var(--chart-4)"
  if (kind === "lane") return "var(--chart-3)"
  if (kind === "side-input") return "var(--muted-foreground)"
  return "var(--border)"
}

function pointsToPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ""
  const [first, ...rest] = points
  return `M ${first!.x} ${first!.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(" ")}`
}

export function PipelineDagGraph({
  modules,
  selectedId,
  onSelect,
  stepStatus,
  invalid,
  className,
}: PipelineDagGraphProps) {
  const laid = useMemo(() => layoutPipelineDag(pipelineToDag(modules)), [modules])

  return (
    <div className={cn("relative mx-auto w-full overflow-auto", className)}>
      <div className="relative" style={{ width: laid.width, height: laid.height, minWidth: "100%" }}>
        <svg
          width={laid.width}
          height={laid.height}
          className="pointer-events-none absolute inset-0 overflow-visible"
          aria-hidden
        >
          {laid.edges.map((e, i) => {
            const d = pointsToPath(e.points)
            if (!d) return null
            const dashed = e.kind === "side-input"
            return (
              <g key={`${e.source}-${e.target}-${e.kind}-${i}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={edgeStroke(e.kind)}
                  strokeWidth={1.5}
                  strokeDasharray={dashed ? "4 3" : undefined}
                  markerEnd="url(#dag-arrow)"
                />
                {e.label ? (
                  <text
                    x={(e.points[0]!.x + e.points[e.points.length - 1]!.x) / 2}
                    y={(e.points[0]!.y + e.points[e.points.length - 1]!.y) / 2 - 4}
                    className="fill-muted-foreground font-mono text-[9px]"
                    textAnchor="middle"
                  >
                    {e.label}
                  </text>
                ) : null}
              </g>
            )
          })}
          <defs>
            <marker id="dag-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" className="fill-border" />
            </marker>
          </defs>
        </svg>
        {laid.nodes.map((n) => {
          if (n.kind === "start" || n.kind === "end") {
            return (
              <div
                key={n.id}
                className="absolute flex items-center justify-center"
                style={{ left: n.x, top: n.y, width: n.width, height: n.height }}
              >
                <span className="rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {n.label}
                </span>
              </div>
            )
          }
          const m = n.module
          if (!m) return null
          const issue = invalidForModule(invalid ?? new Map(), m.id)
          const status = stepStatus?.get(m.id)
          const selected = selectedId === m.id
          const Icon = KIND_ICON[m.kind]
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect?.(m.id)}
              className={cn(
                "absolute flex items-center gap-1.5 overflow-hidden rounded-md border px-2 text-left font-mono",
                KIND_SURFACE[m.kind],
                selected && "ring-2 ring-primary",
                issue && "border-destructive",
                status === "error" && "border-destructive",
              )}
              style={{ left: n.x, top: n.y, width: n.width, height: n.height }}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", KIND_COLOR[m.kind])} />
              <span className="min-w-0 flex-1 truncate text-[11px]">{m.label}</span>
              {issue ? <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" /> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
