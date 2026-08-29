// AI : canonical DAG IR for the series-parallel pipeline (forks, if/else, combine side-feeds).
// AI : authoring stays insert-slot lanes; this graph is layout, mermaid, validation, and export topology.
// AI : triggers attach to Start (Run / Schedule / Share / hosted API). They are not graph steps or loops.
import { combineGroupAt } from "@/lib/pipeline-layout"
import {
  flattenPipelineModules,
  forkBranchesOf,
  isExclusiveKind,
  isIfElseKind,
  isNestedLaneKind,
} from "@/lib/fork-pipeline"
import { followingControlJoin, formatExclusiveCondition, exclusiveLaneKindLabel } from "@/lib/exclusive-control"
import type { PipelineModule } from "@/lib/types"

// AI : exclusive fan-out (arms → Join or End) is ready but off — diamond join-at-split is the UI until layout is revisited.
export const USE_EXCLUSIVE_DAG_TOPOLOGY = false

export const DAG_START_ID = "__start"
export const DAG_END_ID = "__end"

export enum PipelineTriggerKind {
  Manual = "manual",
  Schedule = "schedule",
  ShareLink = "share-link",
  HostedApi = "hosted-api",
  Assistant = "assistant",
  Testing = "testing",
  InboundWebhook = "inbound-webhook",
}

export const PIPELINE_TRIGGER_KIND_META: Record<PipelineTriggerKind, { label: string; hint: string }> = {
  [PipelineTriggerKind.Manual]: { label: "Run", hint: "Start from the app" },
  [PipelineTriggerKind.Schedule]: { label: "Schedule", hint: "Cron — Vibe Schedule tab, not a graph node" },
  [PipelineTriggerKind.ShareLink]: { label: "Share link", hint: "Inbound shared-link run" },
  [PipelineTriggerKind.HostedApi]: { label: "Hosted API", hint: "HTTP invoke" },
  [PipelineTriggerKind.Assistant]: { label: "Assistant", hint: "Agent-started run" },
  [PipelineTriggerKind.Testing]: { label: "Testing", hint: "Testing tab run" },
  [PipelineTriggerKind.InboundWebhook]: {
    label: "Inbound webhook",
    hint: "Reserved — Share link / hosted API cover inbound today; not an n8n trigger node",
  },
}

export type PipelineTrigger = {
  id: string
  kind: PipelineTriggerKind
  label: string
}

export type PipelineDagOpts = {
  triggers?: PipelineTrigger[]
  // AI : off by default — exclusive fan-out is kept for later; UI uses diamond join-at-split.
  exclusiveTopology?: boolean
}

export type PipelineDagEdgeKind = "spine" | "then" | "else" | "case" | "lane" | "side-input" | "trigger"

export type PipelineDagNodeKind = "start" | "end" | "step" | "trigger"

export type PipelineDagNode = {
  id: string
  kind: PipelineDagNodeKind
  label: string
  module?: PipelineModule
  triggerKind?: PipelineTriggerKind
}

export function pipelineTriggerId(kind: PipelineTriggerKind): string {
  return `__trigger_${kind}`
}

export function defaultPipelineTriggers(): PipelineTrigger[] {
  return [
    {
      id: pipelineTriggerId(PipelineTriggerKind.Manual),
      kind: PipelineTriggerKind.Manual,
      label: PIPELINE_TRIGGER_KIND_META[PipelineTriggerKind.Manual].label,
    },
  ]
}

export function resolvePipelineTriggers(extra?: PipelineTrigger[]): PipelineTrigger[] {
  const byKind = new Map<PipelineTriggerKind, PipelineTrigger>()
  for (const t of defaultPipelineTriggers()) byKind.set(t.kind, t)
  for (const t of extra ?? []) {
    byKind.set(t.kind, {
      id: t.id || pipelineTriggerId(t.kind),
      kind: t.kind,
      label: t.label.trim() || PIPELINE_TRIGGER_KIND_META[t.kind].label,
    })
  }
  return [...byKind.values()]
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

function laneEdgeKind(m: PipelineModule, index: number): PipelineDagEdgeKind {
  if (isIfElseKind(m.kind)) return index === 0 ? "then" : "else"
  if (isExclusiveKind(m.kind)) return "case"
  return "lane"
}

function addStepNode(nodes: Map<string, PipelineDagNode>, m: PipelineModule): void {
  if (nodes.has(m.id)) return
  nodes.set(m.id, {
    id: m.id,
    kind: "step",
    label: isExclusiveKind(m.kind) ? `${m.label}: ${formatExclusiveCondition(m)}` : m.label,
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

// AI : unused while USE_EXCLUSIVE_DAG_TOPOLOGY is false — arms go to Join or End instead of joining at the split.
function walkExclusiveSplit(
  m: PipelineModule,
  modules: PipelineModule[],
  index: number,
  pred: string,
  nodes: Map<string, PipelineDagNode>,
  edges: Map<EdgeKey, PipelineDagEdge>,
  exclusiveTopology: boolean,
): string {
  const join = followingControlJoin(modules, index)
  pushEdge(edges, { source: pred, target: m.id, kind: "spine" })
  const branches = forkBranchesOf(m)
  for (let bi = 0; bi < branches.length; bi++) {
    const b = branches[bi]!
    const kind = laneEdgeKind(m, bi)
    const label = exclusiveLaneKindLabel(m, bi, b)
    if (!b.modules.length) {
      if (join) {
        addStepNode(nodes, join)
        pushEdge(edges, { source: m.id, target: join.id, kind, label })
      } else {
        pushEdge(edges, { source: m.id, target: DAG_END_ID, kind, label })
      }
      continue
    }
    const last = walkLinear(b.modules, m.id, nodes, edges, { kind, label }, exclusiveTopology)
    if (join) {
      addStepNode(nodes, join)
      pushEdge(edges, { source: last, target: join.id, kind, label })
    }
  }
  return join ? join.id : m.id
}

function walkLinear(
  modules: PipelineModule[],
  predId: string,
  nodes: Map<string, PipelineDagNode>,
  edges: Map<EdgeKey, PipelineDagEdge>,
  first?: { kind: PipelineDagEdgeKind; label?: string },
  exclusiveTopology = USE_EXCLUSIVE_DAG_TOPOLOGY,
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
      if (exclusiveTopology && isExclusiveKind(m.kind)) {
        pred = walkExclusiveSplit(m, modules, i, pred, nodes, edges, exclusiveTopology)
        if (followingControlJoin(modules, i)) i += 1
        usedFirst = true
        continue
      }
      const branches = forkBranchesOf(m)
      for (let bi = 0; bi < branches.length; bi++) {
        const b = branches[bi]!
        const kind = laneEdgeKind(m, bi)
        const label = exclusiveLaneKindLabel(m, bi, b)
        if (!b.modules.length) {
          emit(pred, m.id, kind, label)
          continue
        }
        const last = walkLinear(b.modules, pred, nodes, edges, { kind, label }, exclusiveTopology)
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

export function pipelineToDag(modules: PipelineModule[], opts?: PipelineDagOpts): PipelineDag {
  const nodes = new Map<string, PipelineDagNode>()
  const edges = new Map<EdgeKey, PipelineDagEdge>()
  const triggers = resolvePipelineTriggers(opts?.triggers)
  for (const t of triggers) {
    nodes.set(t.id, { id: t.id, kind: "trigger", label: t.label, triggerKind: t.kind })
  }
  nodes.set(DAG_START_ID, { id: DAG_START_ID, kind: "start", label: "Start" })
  nodes.set(DAG_END_ID, { id: DAG_END_ID, kind: "end", label: "End" })
  for (const t of triggers) {
    pushEdge(edges, { source: t.id, target: DAG_START_ID, kind: "trigger" })
  }

  walkLinear(modules, DAG_START_ID, nodes, edges, undefined, opts?.exclusiveTopology ?? USE_EXCLUSIVE_DAG_TOPOLOGY)

  const { indeg } = degreeMaps([...edges.values()])
  for (const id of nodes.keys()) {
    const n = nodes.get(id)
    if (!n || n.kind === "start" || n.kind === "trigger") continue
    if ((indeg.get(id) ?? 0) === 0) {
      pushEdge(edges, { source: DAG_START_ID, target: id, kind: "spine" })
    }
  }
  const afterIn = degreeMaps([...edges.values()])
  for (const id of nodes.keys()) {
    const n = nodes.get(id)
    if (!n || n.kind === "end" || n.kind === "trigger") continue
    if ((afterIn.outdeg.get(id) ?? 0) === 0) {
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
