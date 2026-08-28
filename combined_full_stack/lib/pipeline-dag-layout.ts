// AI : d3-dag sugiyama layout for the pipeline DAG (fast greedy — no LP solver in the browser).
import { coordGreedy, dagre, decrossTwoLayer, layeringLongestPath, sugiyama } from "d3-dag"
import {
  DAG_END_ID,
  DAG_START_ID,
  type PipelineDag,
  type PipelineDagEdge,
  type PipelineDagNode,
} from "@/lib/pipeline-dag"

export type LaidOutDagNode = PipelineDagNode & {
  x: number
  y: number
  width: number
  height: number
}

export type LaidOutDagEdge = PipelineDagEdge & {
  points: { x: number; y: number }[]
}

export type LaidOutPipelineDag = {
  width: number
  height: number
  nodes: LaidOutDagNode[]
  edges: LaidOutDagEdge[]
}

const STEP_SIZE = { width: 196, height: 52 }
const END_SIZE = { width: 88, height: 28 }

function nodeSizeOf(n: PipelineDagNode): { width: number; height: number } {
  return n.kind === "start" || n.kind === "end" ? END_SIZE : STEP_SIZE
}

export function layoutPipelineDag(dag: PipelineDag): LaidOutPipelineDag {
  const grf = new dagre.graphlib.Graph()
  grf.setGraph({ rankdir: "TB", nodesep: 36, ranksep: 64, quality: "fast" })
  grf.setDefaultEdgeLabel(() => ({}))
  for (const n of dag.nodes) {
    const size = nodeSizeOf(n)
    grf.setNode(n.id, { width: size.width, height: size.height })
  }
  for (const e of dag.edges) {
    grf.setEdge(e.source, e.target, { label: e.label ?? "" })
  }

  const layout = sugiyama()
    .layering(layeringLongestPath())
    .decross(decrossTwoLayer())
    .coord(coordGreedy())
  dagre.layout(grf, layout)

  const nodes: LaidOutDagNode[] = dag.nodes.map((n) => {
    const pos = grf.node(n.id)
    const size = nodeSizeOf(n)
    return {
      ...n,
      width: pos?.width ?? size.width,
      height: pos?.height ?? size.height,
      x: (pos?.x ?? 0) - (pos?.width ?? size.width) / 2,
      y: (pos?.y ?? 0) - (pos?.height ?? size.height) / 2,
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const edges: LaidOutDagEdge[] = dag.edges.map((e) => {
    const raw = grf.edge(e.source, e.target)
    const pts = Array.isArray(raw?.points) ? raw.points : []
    const points =
      pts.length >= 2
        ? pts.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }))
        : fallbackPoints(byId.get(e.source), byId.get(e.target))
    return { ...e, points }
  })

  let width = 0
  let height = 0
  for (const n of nodes) {
    width = Math.max(width, n.x + n.width)
    height = Math.max(height, n.y + n.height)
  }
  for (const e of edges) {
    for (const p of e.points) {
      width = Math.max(width, p.x)
      height = Math.max(height, p.y)
    }
  }
  return { width: Math.max(width + 24, 240), height: Math.max(height + 24, 120), nodes, edges }
}

function fallbackPoints(
  source?: LaidOutDagNode,
  target?: LaidOutDagNode,
): { x: number; y: number }[] {
  if (!source || !target) return []
  return [
    { x: source.x + source.width / 2, y: source.y + source.height },
    { x: target.x + target.width / 2, y: target.y },
  ]
}

export function dagHasStartEnd(dag: PipelineDag): boolean {
  return dag.nodes.some((n) => n.id === DAG_START_ID) && dag.nodes.some((n) => n.id === DAG_END_ID)
}
