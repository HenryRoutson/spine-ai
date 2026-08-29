// AI : map laid-out pipeline DAG IR to React Flow nodes/edges (visualization only — no drag-wires).
import { isExclusiveKind, isNestedLaneKind } from "@/lib/fork-pipeline"
import { layoutPipelineDag, type LaidOutPipelineDag } from "@/lib/pipeline-dag-layout"
import { pipelineToDag, type PipelineDagEdgeKind } from "@/lib/pipeline-dag"
import { formatModuleSpineOut } from "@/lib/spine-type"
import { MODULE_META, type ModuleId, type PipelineModule, type RunStepStatus, type StructureModel } from "@/lib/types"
import { invalidForModule, type InvalidMap } from "@/lib/validity"

export const PIPELINE_RF_STEP_TYPE = "step" as const
export const PIPELINE_RF_CHROME_TYPE = "chrome" as const
export const PIPELINE_RF_EDGE_TYPE = "laid" as const

export type PipelineRfChromeKind = "start" | "end" | "trigger"

export type PipelineRfNodeData = {
  variant: "step" | PipelineRfChromeKind
  label: string
  subtitle: string
  module?: PipelineModule
  invalid: boolean
  status?: RunStepStatus
  forkish: boolean
  isOutput: boolean
}

export type PipelineRfEdgeData = {
  kind: PipelineDagEdgeKind
  path: string
  dashed: boolean
  labelAt?: { x: number; y: number }
}

export type PipelineRfNodeJson = {
  id: string
  type: typeof PIPELINE_RF_STEP_TYPE | typeof PIPELINE_RF_CHROME_TYPE
  position: { x: number; y: number }
  width: number
  height: number
  style: { width: number; height: number }
  selected: boolean
  selectable: boolean
  draggable: false
  connectable: false
  deletable: false
  data: PipelineRfNodeData
}

export type PipelineRfEdgeJson = {
  id: string
  type: typeof PIPELINE_RF_EDGE_TYPE
  source: string
  target: string
  label?: string
  deletable: false
  selectable: false
  data: PipelineRfEdgeData
}

export type PipelineRfElements = {
  nodes: PipelineRfNodeJson[]
  edges: PipelineRfEdgeJson[]
}

export function pipelineRfEdgeStroke(kind: PipelineDagEdgeKind): string {
  if (kind === "then" || kind === "else" || kind === "lane" || kind === "case") {
    return "color-mix(in oklab, var(--chart-4) 55%, var(--border))"
  }
  if (kind === "side-input" || kind === "trigger") return "var(--muted-foreground)"
  return "var(--border)"
}

function stepSubtitle(m: PipelineModule, nLabel: string, models: StructureModel[]): string {
  if (isExclusiveKind(m.kind)) {
    return `${nLabel.replace(`${m.label}: `, "")} · ${formatModuleSpineOut(m, models)}`
  }
  return MODULE_META[m.kind].label
}

export function laidPipelineToReactFlow(
  laid: LaidOutPipelineDag,
  opts?: {
    selectedId?: ModuleId
    invalid?: InvalidMap
    stepStatus?: Map<ModuleId, RunStepStatus>
    models?: StructureModel[]
  },
): PipelineRfElements {
  const models = opts?.models ?? []
  const invalid = opts?.invalid ?? new Map()
  const nodes: PipelineRfNodeJson[] = laid.nodes.map((n) => {
    if (n.kind === "start" || n.kind === "end" || n.kind === "trigger") {
      return {
        id: n.id,
        type: PIPELINE_RF_CHROME_TYPE,
        position: { x: n.x, y: n.y },
        width: n.width,
        height: n.height,
        style: { width: n.width, height: n.height },
        selected: false,
        selectable: false,
        draggable: false,
        connectable: false,
        deletable: false,
        data: {
          variant: n.kind,
          label: n.label,
          subtitle: "",
          invalid: false,
          forkish: false,
          isOutput: false,
        },
      }
    }
    const m = n.module
    return {
      id: n.id,
      type: PIPELINE_RF_STEP_TYPE,
      position: { x: n.x, y: n.y },
      width: n.width,
      height: n.height,
      style: { width: n.width, height: n.height },
      selected: m ? opts?.selectedId === m.id : false,
      selectable: Boolean(m),
      draggable: false,
      connectable: false,
      deletable: false,
      data: {
        variant: "step",
        label: m?.label ?? n.label,
        subtitle: m ? stepSubtitle(m, n.label, models) : n.label,
        module: m,
        invalid: m ? Boolean(invalidForModule(invalid, m.id)) : false,
        status: m ? opts?.stepStatus?.get(m.id) : undefined,
        forkish: m ? isNestedLaneKind(m.kind) : false,
        isOutput: m?.kind === "output",
      },
    }
  })
  const edges: PipelineRfEdgeJson[] = laid.edges.map((e, i) => ({
    id: `${e.source}-${e.target}-${e.kind}-${i}`,
    type: PIPELINE_RF_EDGE_TYPE,
    source: e.source,
    target: e.target,
    label: e.label,
    deletable: false,
    selectable: false,
    data: {
      kind: e.kind,
      path: e.path,
      dashed: e.dashed,
      labelAt: e.labelAt,
    },
  }))
  return { nodes, edges }
}

export function pipelineModulesToReactFlow(
  modules: PipelineModule[],
  opts?: {
    selectedId?: ModuleId
    invalid?: InvalidMap
    stepStatus?: Map<ModuleId, RunStepStatus>
    models?: StructureModel[]
  },
): PipelineRfElements {
  return laidPipelineToReactFlow(layoutPipelineDag(pipelineToDag(modules)), opts)
}
