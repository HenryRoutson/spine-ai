"use client"

// AI : one scroll — each pipeline segment row stays horizontally aligned with its test config.
// AI : TODO (allow-pipeline-non-linear-fork) — fork row with N test columns (still one vertical scroll).

import { useCallback, useMemo, useRef, type ReactNode } from "react"
import {
  PipelineCanvasConnector,
  PipelineCanvasEnd,
  PipelineCanvasSegment,
  PipelineCanvasStart,
} from "@/components/pipeline-canvas"
import { segmentPipeline, modulesInSegment } from "@/lib/pipeline-layout"
import {
  TESTING_PIPELINE_MAX,
  TESTING_PIPELINE_MIN,
} from "@/lib/testing-settings"
import type { TestPipelineAlignment, TestStepTrackStatus } from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import type { ModuleId, PipelineModule, Project } from "@/lib/types"

type pixel_width = number

type TestingPipelineAlignViewProps = {
  project: Project
  alignment: TestPipelineAlignment
  testCoverage: Map<ModuleId, TestStepTrackStatus>
  selectedModuleId: ModuleId | null
  onSelectModule: (id: ModuleId) => void
  pipelineWidth: pixel_width
  onPipelineWidthChange: (width: pixel_width) => void
  onPipelineWidthCommit: (width: pixel_width) => void
  renderTestStep: (module: PipelineModule, trackStatus: TestStepTrackStatus) => ReactNode
  orphansFooter?: ReactNode
  legend?: ReactNode
}

type align_row_key = string

function trackStatusForModule(
  alignment: TestPipelineAlignment,
  moduleId: ModuleId,
): TestStepTrackStatus {
  return alignment.stepRows.find((r) => r.module.id === moduleId)?.trackStatus ?? "untracked"
}

export function TestingPipelineAlignView({
  project,
  alignment,
  testCoverage,
  selectedModuleId,
  onSelectModule,
  pipelineWidth,
  onPipelineWidthChange,
  onPipelineWidthCommit,
  renderTestStep,
  orphansFooter,
  legend,
}: TestingPipelineAlignViewProps) {
  const segments = useMemo(() => segmentPipeline(project.modules), [project.modules])
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const latestWidth = useRef(pipelineWidth)

  const clampWidth = useCallback(
    (raw: pixel_width): pixel_width =>
      Math.min(TESTING_PIPELINE_MAX, Math.max(TESTING_PIPELINE_MIN, raw)),
    [],
  )

  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || !scrollRef.current) return
      const rect = scrollRef.current.getBoundingClientRect()
      const next = clampWidth(e.clientX - rect.left)
      latestWidth.current = next
      onPipelineWidthChange(next)
    },
    [clampWidth, onPipelineWidthChange],
  )

  const endResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return
      dragging.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      onPipelineWidthCommit(latestWidth.current)
    },
    [onPipelineWidthCommit],
  )

  const segmentProps = {
    modules: project.modules,
    models: project.models,
    selectedId: selectedModuleId ?? undefined,
    onSelect: onSelectModule,
    testCoverage,
    showConnector: false as const,
  }

  return (
    <div className="rounded-lg border border-border">
      <div className="flex border-b border-border bg-muted/20">
        <p
          className="shrink-0 border-r border-border px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground"
          style={{ width: pipelineWidth }}
        >
          live pipeline
        </p>
        <p className="min-w-0 flex-1 px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">
          test coverage
        </p>
      </div>

      <div ref={scrollRef} className="relative">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={pipelineWidth}
            aria-valuemin={TESTING_PIPELINE_MIN}
            aria-valuemax={TESTING_PIPELINE_MAX}
            tabIndex={0}
            title="Drag to resize columns"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            className="absolute bottom-0 top-0 z-10 w-1.5 -translate-x-1/2 cursor-col-resize touch-none border-x border-border/60 bg-border/20 hover:bg-primary/25 active:bg-primary/40"
            style={{ left: pipelineWidth }}
          />

          <AlignRow rowKey="start" pipelineWidth={pipelineWidth} pipeline={<PipelineCanvasStart />} test={null} />
          <AlignRow
            rowKey="start-connector"
            pipelineWidth={pipelineWidth}
            pipeline={<PipelineCanvasConnector />}
            test={null}
          />

          {segments.flatMap((seg) => {
            const rowKey: align_row_key = seg.kind === "combine" ? seg.combine.id : seg.module.id
            const moduleIds = modulesInSegment(seg).map((m) => m.id)
            const testCell = (
              <div className="space-y-3">
                {modulesInSegment(seg).map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "rounded-lg transition-shadow",
                      selectedModuleId === m.id && "ring-1 ring-primary/40",
                    )}
                    onClick={() => onSelectModule(m.id)}
                  >
                    {renderTestStep(m, trackStatusForModule(alignment, m.id))}
                  </div>
                ))}
              </div>
            )
            return [
              <AlignRow
                key={rowKey}
                rowKey={rowKey}
                pipelineWidth={pipelineWidth}
                moduleIds={moduleIds}
                selectedModuleId={selectedModuleId}
                pipeline={<PipelineCanvasSegment seg={seg} {...segmentProps} />}
                test={testCell}
              />,
              <AlignRow
                key={`${rowKey}-connector`}
                rowKey={`${rowKey}-connector`}
                pipelineWidth={pipelineWidth}
                pipeline={<PipelineCanvasConnector />}
                test={null}
              />,
            ]
          })}

          <AlignRow rowKey="end" pipelineWidth={pipelineWidth} pipeline={<PipelineCanvasEnd />} test={null} />

          {orphansFooter ? (
            <div className="flex border-t border-border">
              <div className="shrink-0 border-r border-border bg-muted/5" style={{ width: pipelineWidth }} />
              <div className="min-w-0 flex-1 space-y-4 p-3">{orphansFooter}</div>
            </div>
          ) : null}
      </div>

      {legend}
    </div>
  )
}

function AlignRow({
  rowKey,
  pipelineWidth,
  pipeline,
  test,
  moduleIds,
  selectedModuleId,
}: {
  rowKey: align_row_key
  pipelineWidth: pixel_width
  pipeline: ReactNode
  test: ReactNode | null
  moduleIds?: ModuleId[]
  selectedModuleId?: ModuleId | null
}) {
  const rowSelected = moduleIds?.some((id) => id === selectedModuleId) ?? false
  return (
    <div
      data-align-row={rowKey}
      className={cn(
        "flex items-start border-b border-border/40",
        rowSelected && "bg-primary/[0.03]",
      )}
    >
      <div
        className="flex shrink-0 items-center justify-center border-r border-border bg-muted/10 px-3 py-2"
        style={{ width: pipelineWidth }}
      >
        <div className="w-full max-w-none">{pipeline}</div>
      </div>
      <div className={cn("min-w-0 flex-1 py-2 pl-3 pr-3", !test && "min-h-[2.5rem]")}>{test}</div>
    </div>
  )
}
