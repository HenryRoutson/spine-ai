// AI : core DAG layout — d3-dag places nodes; this module routes Spine-style orthogonal edges.
// AI : UI only paints the geometry returned here (no routing / sizing in components).
import {
  coordGreedy,
  decrossTwoLayer,
  graph,
  layeringLongestPath,
  sugiyama,
} from "d3-dag"
import {
  DAG_END_ID,
  DAG_START_ID,
  type PipelineDag,
  type PipelineDagEdge,
  type PipelineDagEdgeKind,
  type PipelineDagNode,
} from "@/lib/pipeline-dag"

export type DagPoint = { x: number; y: number }

export type LaidOutDagNode = PipelineDagNode & {
  x: number
  y: number
  width: number
  height: number
}

export type LaidOutDagEdge = PipelineDagEdge & {
  points: DagPoint[]
  path: string
  dashed: boolean
  labelAt?: DagPoint
}

export type LaidOutPipelineDag = {
  width: number
  height: number
  nodes: LaidOutDagNode[]
  edges: LaidOutDagEdge[]
}

export const DAG_STEP_SIZE = { width: 240, height: 72 } as const
export const DAG_END_SIZE = { width: 88, height: 28 } as const
export const DAG_TRIGGER_SIZE = { width: 120, height: 28 } as const
export const DAG_GAP = { x: 48, y: 56 } as const
export const DAG_PAD = 24
export const DAG_CORNER_RADIUS = 10

export function dagNodeSizeOf(n: Pick<PipelineDagNode, "kind">): { width: number; height: number } {
  if (n.kind === "start" || n.kind === "end") return DAG_END_SIZE
  if (n.kind === "trigger") return DAG_TRIGGER_SIZE
  return DAG_STEP_SIZE
}

export function dagEdgeIsDashed(kind: PipelineDagEdgeKind): boolean {
  return kind === "side-input" || kind === "trigger"
}

function dist(a: DagPoint, b: DagPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function pointToward(from: DagPoint, to: DagPoint, d: number): DagPoint {
  const len = dist(from, to)
  if (len < 1e-6) return { ...from }
  const t = Math.min(1, d / len)
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
}

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1)
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.5
}

function simplifyColinear(points: DagPoint[]): DagPoint[] {
  if (points.length < 3) return points.slice()
  const out: DagPoint[] = [points[0]!]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!
    const curr = points[i]!
    const next = points[i + 1]!
    const colinear =
      (nearlyEqual(prev.x, curr.x) && nearlyEqual(curr.x, next.x)) ||
      (nearlyEqual(prev.y, curr.y) && nearlyEqual(curr.y, next.y))
    if (!colinear) out.push(curr)
  }
  out.push(points[points.length - 1]!)
  return out
}

export function roundedOrthogonalPath(points: DagPoint[], radius: number = DAG_CORNER_RADIUS): string {
  const pts = simplifyColinear(points).filter((p, i, arr) => i === 0 || dist(p, arr[i - 1]!) > 0.5)
  if (pts.length < 2) return ""
  if (pts.length === 2) {
    return `M ${fmt(pts[0]!.x)} ${fmt(pts[0]!.y)} L ${fmt(pts[1]!.x)} ${fmt(pts[1]!.y)}`
  }
  let d = `M ${fmt(pts[0]!.x)} ${fmt(pts[0]!.y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]!
    const curr = pts[i]!
    const next = pts[i + 1]!
    const r = Math.min(radius, dist(prev, curr) / 2, dist(curr, next) / 2)
    if (r < 0.5) {
      d += ` L ${fmt(curr.x)} ${fmt(curr.y)}`
      continue
    }
    const p1 = pointToward(curr, prev, r)
    const p2 = pointToward(curr, next, r)
    d += ` L ${fmt(p1.x)} ${fmt(p1.y)} Q ${fmt(curr.x)} ${fmt(curr.y)} ${fmt(p2.x)} ${fmt(p2.y)}`
  }
  const last = pts[pts.length - 1]!
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`
  return d
}

export function longestSegmentLabelAt(points: DagPoint[]): DagPoint | undefined {
  const pts = simplifyColinear(points)
  if (pts.length < 2) return undefined
  let bestLen = -1
  let best: DagPoint | undefined
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!
    const b = pts[i + 1]!
    const len = dist(a, b)
    if (len > bestLen) {
      bestLen = len
      best = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    }
  }
  return best
}

function centerOf(n: LaidOutDagNode): DagPoint {
  return { x: n.x + n.width / 2, y: n.y + n.height / 2 }
}

function attachX(n: LaidOutDagNode, index: number, count: number): number {
  const cx = n.x + n.width / 2
  if (count <= 1) return cx
  const span = Math.min(n.width - 32, (count - 1) * 18)
  return cx - span / 2 + (span * index) / (count - 1)
}

function routeOrthogonal(source: LaidOutDagNode, target: LaidOutDagNode, sx: number, tx: number): DagPoint[] {
  const sy = source.y + source.height
  const ty = target.y
  if (nearlyEqual(sx, tx)) {
    return [
      { x: sx, y: sy },
      { x: tx, y: ty },
    ]
  }
  const gap = Math.max(18, Math.min(DAG_GAP.y / 2, (ty - sy) / 2))
  const bendY = sy + gap
  return [
    { x: sx, y: sy },
    { x: sx, y: bendY },
    { x: tx, y: bendY },
    { x: tx, y: ty },
  ]
}

function layoutNodes(dag: PipelineDag): LaidOutDagNode[] {
  const grf = graph<PipelineDagNode, PipelineDagEdge>()
  const byId = new Map<string, ReturnType<typeof grf.node>>()
  for (const n of dag.nodes) {
    byId.set(n.id, grf.node(n))
  }
  for (const e of dag.edges) {
    const s = byId.get(e.source)
    const t = byId.get(e.target)
    if (s && t) grf.link(s, t, e)
  }

  const sizeOf = (n: PipelineDagNode) => {
    const size = dagNodeSizeOf(n)
    return [size.width, size.height] as const
  }

  // AI : d3-dag Ops default to never; nodeSize is typed, invoke is asserted onto our graph.
  const layout = sugiyama()
    .layering(layeringLongestPath())
    .decross(decrossTwoLayer())
    .coord(coordGreedy())
    .nodeSize((node: { data: PipelineDagNode }) => sizeOf(node.data))
    .gap([DAG_GAP.x, DAG_GAP.y])
  ;(layout as (g: typeof grf) => void)(grf)

  return dag.nodes.map((n) => {
    const gn = byId.get(n.id)
    const size = dagNodeSizeOf(n)
    const cx = gn?.ux ?? 0
    const cy = gn?.uy ?? 0
    return {
      ...n,
      width: size.width,
      height: size.height,
      x: cx - size.width / 2 + DAG_PAD,
      y: cy - size.height / 2 + DAG_PAD,
    }
  })
}

function layoutEdges(dag: PipelineDag, nodes: LaidOutDagNode[]): LaidOutDagEdge[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const outgoing = new Map<string, PipelineDagEdge[]>()
  const incoming = new Map<string, PipelineDagEdge[]>()
  for (const e of dag.edges) {
    const outs = outgoing.get(e.source) ?? []
    outs.push(e)
    outgoing.set(e.source, outs)
    const ins = incoming.get(e.target) ?? []
    ins.push(e)
    incoming.set(e.target, ins)
  }
  for (const list of outgoing.values()) {
    list.sort((a, b) => {
      const ax = centerOf(byId.get(a.target)!).x
      const bx = centerOf(byId.get(b.target)!).x
      return ax - bx
    })
  }
  for (const list of incoming.values()) {
    list.sort((a, b) => {
      const ax = centerOf(byId.get(a.source)!).x
      const bx = centerOf(byId.get(b.source)!).x
      return ax - bx
    })
  }

  return dag.edges.map((e) => {
    const source = byId.get(e.source)
    const target = byId.get(e.target)
    if (!source || !target) {
      return { ...e, points: [], path: "", dashed: dagEdgeIsDashed(e.kind) }
    }
    const outs = outgoing.get(e.source) ?? [e]
    const ins = incoming.get(e.target) ?? [e]
    const oi = Math.max(0, outs.findIndex((x) => x === e))
    const ii = Math.max(0, ins.findIndex((x) => x === e))
    const sx = attachX(source, oi, outs.length)
    const tx = attachX(target, ii, ins.length)
    const points = routeOrthogonal(source, target, sx, tx)
    const path = roundedOrthogonalPath(points)
    const labelAt = e.label ? longestSegmentLabelAt(points) : undefined
    return { ...e, points, path, dashed: dagEdgeIsDashed(e.kind), labelAt }
  })
}

function boundsOf(nodes: LaidOutDagNode[], edges: LaidOutDagEdge[]): { width: number; height: number } {
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
  return {
    width: Math.max(width + DAG_PAD, 240),
    height: Math.max(height + DAG_PAD, 120),
  }
}

export function layoutPipelineDag(dag: PipelineDag): LaidOutPipelineDag {
  const nodes = layoutNodes(dag)
  const edges = layoutEdges(dag, nodes)
  const { width, height } = boundsOf(nodes, edges)
  return { width, height, nodes, edges }
}

export function dagHasStartEnd(dag: PipelineDag): boolean {
  return dag.nodes.some((n) => n.id === DAG_START_ID) && dag.nodes.some((n) => n.id === DAG_END_ID)
}
