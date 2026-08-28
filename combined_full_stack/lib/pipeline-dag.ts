// AI : canonical DAG IR for the series-parallel pipeline (forks, typed ifs, combine side-feeds).
// AI : authoring stays insert-slot lanes; this graph is layout, mermaid, validation, and export topology.
import { combineGroupAt } from "@/lib/pipeline-layout"
import {
  flattenPipelineModules,
  forkBranchesOf,
  isIfElseKind,
  isNestedLaneKind,
} from "@/lib/fork-pipeline"
import { formatIfCondition } from "@/lib/if-condition"
import type { PipelineModule } from "@/lib/types"

export const DAG_START_ID = "__start"
export const DAG_END_ID = "__end"

export type PipelineDagEdgeKind = "spine" | "then" | "else" | "lane" | "side-input"

export type PipelineDagNodeKind = "start" | "end" | "step"

export type PipelineDagNode = {
  id: string
  kind: PipelineDagNodeKind
  label: string
  module?: PipelineModule
}

export type PipelineDagEdge = {
  source: string
  target: string
  kind: PipelineDagEdgeKind
  label?: string
}

export type PipelineDag = {
  nodes: PipelineDagNode[]
  edges: PipelineDagEdge[]
}

type EdgeKey = string

function edgeKey(e: Pick<PipelineDagEdge, "source" | "target" | "kind">): EdgeKey {
  return `${e.source}\0${e.target}\0${e.kind}`
}

function laneEdgeKind(isIf: boolean, index: number): PipelineDagEdgeKind {
  if (!isIf) return "lane"
  return index === 0 ? "then" : "else"
}

function addStepNode(nodes: Map<string, PipelineDagNode>, m: PipelineModule): void {
  if (nodes.has(m.id)) return
  nodes.set(m.id, {
    id: m.id,
    kind: "step",
    label: isIfElseKind(m.kind) ? `${m.label}: ${formatIfCondition(m.ifCondition)}` : m.label,
    module: m,
  })
}

function pushEdge(edges: Map<EdgeKey, PipelineDagEdge>, edge: PipelineDagEdge): void {
  const key = edgeKey(edge)
  const prev = edges.get(key)
  if (!prev) {
    edges.set(key, edge)
    return
  }
  if (edge.label && prev.label && edge.label !== prev.label) {
    edges.set(key, { ...prev, label: `${prev.label} / ${edge.label}` })
  }
}

function walkLinear(
  modules: PipelineModule[],
  predId: string,
  nodes: Map<string, PipelineDagNode>,
  edges: Map<EdgeKey, PipelineDagEdge>,
  first?: { kind: PipelineDagEdgeKind; label?: string },
): string {
  const inGroup = new Set<string>()
  for (let i = 0; i < modules.length; i++) {
    const g = combineGroupAt(modules, i)
    if (g) {
      inGroup.add(g.input.id)
      if (g.convert) inGroup.add(g.convert.id)
      if (g.parse) inGroup.add(g.parse.id)
    }
  }

  let pred = predId
  let usedFirst = false
  const emit = (source: string, target: string, kind: PipelineDagEdgeKind = "spine", label?: string) => {
    const hopKind = !usedFirst && first ? first.kind : kind
    const hopLabel = !usedFirst && first?.label ? first.label : label
    usedFirst = true
    pushEdge(edges, { source, target, kind: hopKind, label: hopLabel })
  }

  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]!
    const g = combineGroupAt(modules, i)
    if (g) {
      addStepNode(nodes, m)
      addStepNode(nodes, g.input)
      if (g.convert) addStepNode(nodes, g.convert)
      if (g.parse) addStepNode(nodes, g.parse)
      emit(pred, m.id, "spine")
      let side = g.input.id
      if (g.convert) {
        pushEdge(edges, { source: side, target: g.convert.id, kind: "side-input", label: "side input" })
        side = g.convert.id
      }
      if (g.parse) {
        pushEdge(edges, { source: side, target: g.parse.id, kind: "side-input", label: "side input" })
        side = g.parse.id
      }
      pushEdge(edges, { source: side, target: m.id, kind: "side-input", label: "side input" })
      pred = m.id
      continue
    }
    if (inGroup.has(m.id)) continue

    addStepNode(nodes, m)
    if (isNestedLaneKind(m.kind)) {
      const isIf = isIfElseKind(m.kind)
      const branches = forkBranchesOf(m)
      for (let bi = 0; bi < branches.length; bi++) {
        const b = branches[bi]!
        const kind = laneEdgeKind(isIf, bi)
        const label = isIf ? (bi === 0 ? "Then" : "Else") : b.label.trim() || `lane ${bi + 1}`
        if (!b.modules.length) {
          emit(pred, m.id, kind, label)
          continue
        }
        const last = walkLinear(b.modules, pred, nodes, edges, { kind, label })
        pushEdge(edges, { source: last, target: m.id, kind, label })
        usedFirst = true
      }
      pred = m.id
      continue
    }

    emit(pred, m.id, "spine")
    pred = m.id
  }
  return pred
}

function degreeMaps(edges: PipelineDagEdge[]): {
  indeg: Map<string, number>
  outdeg: Map<string, number>
} {
  const indeg = new Map<string, number>()
  const outdeg = new Map<string, number>()
  for (const e of edges) {
    outdeg.set(e.source, (outdeg.get(e.source) ?? 0) + 1)
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }
  return { indeg, outdeg }
}

export function pipelineToDag(modules: PipelineModule[]): PipelineDag {
  const nodes = new Map<string, PipelineDagNode>()
  const edges = new Map<EdgeKey, PipelineDagEdge>()
  nodes.set(DAG_START_ID, { id: DAG_START_ID, kind: "start", label: "Start" })
  nodes.set(DAG_END_ID, { id: DAG_END_ID, kind: "end", label: "End" })

  walkLinear(modules, DAG_START_ID, nodes, edges)

  const { indeg } = degreeMaps([...edges.values()])
  for (const id of nodes.keys()) {
    if (id !== DAG_START_ID && (indeg.get(id) ?? 0) === 0) {
      pushEdge(edges, { source: DAG_START_ID, target: id, kind: "spine" })
    }
  }
  const afterIn = degreeMaps([...edges.values()])
  for (const id of nodes.keys()) {
    if (id !== DAG_END_ID && (afterIn.outdeg.get(id) ?? 0) === 0) {
      pushEdge(edges, { source: id, target: DAG_END_ID, kind: "spine" })
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()] }
}

export function pipelineDagIsAcyclic(dag: PipelineDag): boolean {
  const outgoing = new Map<string, string[]>()
  const indeg = new Map<string, number>()
  for (const n of dag.nodes) {
    outgoing.set(n.id, [])
    indeg.set(n.id, 0)
  }
  for (const e of dag.edges) {
    outgoing.get(e.source)?.push(e.target)
    indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1)
  }
  const queue = dag.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  let seen = 0
  while (queue.length) {
    const id = queue.shift()!
    seen += 1
    for (const nxt of outgoing.get(id) ?? []) {
      const nextDeg = (indeg.get(nxt) ?? 0) - 1
      indeg.set(nxt, nextDeg)
      if (nextDeg === 0) queue.push(nxt)
    }
  }
  return seen === dag.nodes.length
}

export function pipelineHasDagControlFlow(modules: PipelineModule[]): boolean {
  return flattenPipelineModules(modules).some((m) => isNestedLaneKind(m.kind))
}
