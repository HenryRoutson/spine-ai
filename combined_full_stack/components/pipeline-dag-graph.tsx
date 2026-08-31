"use client"

// AI : React Flow visualises pipelineToDag; authoring stays insert-slot Lanes (no drag-wires).

import { useEffect, useMemo, useState } from "react"
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react"
import { AlertTriangle } from "lucide-react"
import {
  PIPELINE_RF_CHROME_TYPE,
  PIPELINE_RF_EDGE_TYPE,
  PIPELINE_RF_STEP_TYPE,
  pipelineModulesToReactFlow,
  pipelineRfEdgeStroke,
  type PipelineRfEdgeData,
  type PipelineRfNodeData,
} from "@/lib/pipeline-dag-reactflow"
import { KindIcon, PipelineNode } from "@/lib/module-ui"
import type { ModuleId, PipelineModule, RunStepStatus, StructureModel } from "@/lib/types"
import { cn } from "@/lib/utils"
import { type InvalidMap } from "@/lib/validity"
import { uiContextTargetProps } from "@/lib/ui-context-dom"

type PipelineRfStepNode = Node<PipelineRfNodeData, typeof PIPELINE_RF_STEP_TYPE>
type PipelineRfChromeNode = Node<PipelineRfNodeData, typeof PIPELINE_RF_CHROME_TYPE>
type PipelineRfNode = PipelineRfStepNode | PipelineRfChromeNode
type PipelineRfLaidEdge = Edge<PipelineRfEdgeData, typeof PIPELINE_RF_EDGE_TYPE>

type PipelineDagGraphProps = {
  modules: PipelineModule[]
  models?: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  invalid?: InvalidMap
  className?: string
}

function PipelineRfStepNodeView({ data, selected }: NodeProps<PipelineRfStepNode>) {
  const m = data.module
  if (!m) return null
  const ctx = uiContextTargetProps({
    kind: "pipeline_step",
    id: `step:${m.id}`,
    label: `${m.label} (${m.kind})`,
    moduleId: String(m.id),
    snippet: m.note,
  })
  return (
    <div
      {...ctx}
      className={cn(
        "flex h-full w-full items-start gap-2 overflow-hidden rounded-lg border bg-card px-2.5 py-2 text-left",
        data.forkish && "border-dashed border-chart-4/40 bg-chart-4/5",
        data.isOutput && "border-dashed border-output/50 bg-output/5",
        selected && !data.forkish && !data.isOutput && "border-primary ring-1 ring-primary/30",
        selected && data.forkish && "border-primary bg-primary/5 ring-1 ring-primary/30",
        selected && data.isOutput && "border-output ring-1 ring-output/40",
        !selected && !data.forkish && !data.isOutput && "border-border",
        data.invalid && "border-destructive/70 bg-destructive/5",
        data.status === "error" && "border-destructive/70 bg-destructive/5",
        data.status === "skipped" && "opacity-40",
      )}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <KindIcon kind={m.kind} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-snug">{data.label}</span>
        <span className="block truncate font-mono text-[10px] leading-snug text-muted-foreground">
          {data.subtitle}
        </span>
      </span>
      {data.invalid ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> : null}
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  )
}

function PipelineRfChromeNodeView({ data }: NodeProps<PipelineRfChromeNode>) {
  const showTarget = data.variant !== "trigger"
  const showSource = data.variant !== "end"
  return (
    <div className="flex h-full w-full items-center justify-center">
      {showTarget ? <Handle type="target" position={Position.Top} isConnectable={false} /> : null}
      <PipelineNode label={data.label} subtle />
      {showSource ? <Handle type="source" position={Position.Bottom} isConnectable={false} /> : null}
    </div>
  )
}

function PipelineLaidEdge({ id, data, label, markerEnd }: EdgeProps<PipelineRfLaidEdge>) {
  if (!data?.path) return null
  const stroke = pipelineRfEdgeStroke(data.kind)
  return (
    <>
      <BaseEdge
        id={id}
        path={data.path}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: 1, strokeDasharray: data.dashed ? "4 3" : undefined }}
      />
      {label && data.labelAt ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${data.labelAt.x}px, ${data.labelAt.y}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const pipelineRfNodeTypes = {
  [PIPELINE_RF_STEP_TYPE]: PipelineRfStepNodeView,
  [PIPELINE_RF_CHROME_TYPE]: PipelineRfChromeNodeView,
} satisfies NodeTypes

const pipelineRfEdgeTypes = {
  [PIPELINE_RF_EDGE_TYPE]: PipelineLaidEdge,
} satisfies EdgeTypes

function FitToPipeline({ token }: { token: string }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fitView({ padding: 0.18, duration: 180 })
    })
    return () => cancelAnimationFrame(frame)
  }, [token, fitView])
  return null
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { nodes, edges } = useMemo(
    () => pipelineModulesToReactFlow(modules, { selectedId, invalid, stepStatus, models }),
    [modules, selectedId, invalid, stepStatus, models],
  )
  const rfEdges = useMemo(
    () =>
      edges.map((e) => ({
        ...e,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: pipelineRfEdgeStroke(e.data.kind),
        },
      })),
    [edges],
  )
  const structureToken = useMemo(() => nodes.map((n) => n.id).join("|"), [nodes])

  return (
    <div
      data-pipeline-dag="reactflow"
      className={cn(
        "pipeline-rf relative h-[min(36rem,70vh)] min-h-[24rem] w-full overflow-hidden rounded-lg border border-border bg-background",
        className,
      )}
    >
      {mounted ? (
        // AI : colorMode=dark — RF adds .light/.dark on the wrapper; our .light tokens invert the canvas to white.
        <ReactFlow<PipelineRfNode, PipelineRfLaidEdge>
          nodes={nodes}
          edges={rfEdges}
          nodeTypes={pipelineRfNodeTypes}
          edgeTypes={pipelineRfEdgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable
          edgesReconnectable={false}
          edgesFocusable={false}
          elementsSelectable
          selectNodesOnDrag={false}
          elevateNodesOnSelect={false}
          panOnDrag
          zoomOnScroll
          preventScrolling
          minZoom={0.25}
          maxZoom={1.75}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          colorMode="dark"
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
          autoPanOnNodeDrag={false}
          proOptions={{ hideAttribution: false }}
          className="bg-background"
          onNodeClick={(_, node) => {
            const moduleId = node.data.module?.id
            if (moduleId) onSelect?.(moduleId)
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={18}
            size={1}
            bgColor="var(--background)"
            color="color-mix(in oklab, var(--muted-foreground) 35%, transparent)"
          />
          <Controls showInteractive={false} />
          <FitToPipeline token={structureToken} />
        </ReactFlow>
      ) : null}
    </div>
  )
}
