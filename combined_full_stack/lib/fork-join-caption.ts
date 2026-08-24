import {
  forkBranchesOf,
  forkJoinOf,
  forkProductField,
  type ForkJoin,
} from "@/lib/fork-pipeline"
import {
  MERGE_DICT_STRATEGY_LABELS,
  MERGE_LIST_STRATEGY_LABELS,
  MERGE_SCALAR_STRATEGY_LABELS,
} from "@/lib/list-ops-steps"
import { DEFAULT_MERGE_POLICY } from "@/lib/merger"
import type { AssembleSource, PipelineModule } from "@/lib/types"

export type ForkJoinMapping = {
  lane: string
  into: string
}

export type ForkJoinCaption = {
  join: ForkJoin
  title: string
  detail: string
  mappings: ForkJoinMapping[]
}

function assembleSourceCaption(source: AssembleSource | undefined): string {
  if (!source) return "—"
  if (source.kind === "spine") return "spine"
  if (source.kind === "state") return source.label
  const from = source.from === "spine" ? "spine" : source.from.label
  return `${from}.${source.path}`
}

function mergePolicyCaption(fork: PipelineModule): string {
  const layer = fork.mergePolicy?.default ?? DEFAULT_MERGE_POLICY.default
  const list = layer?.list ? MERGE_LIST_STRATEGY_LABELS[layer.list] : "concat lists"
  const dict = layer?.dict ? MERGE_DICT_STRATEGY_LABELS[layer.dict] : "deep merge"
  const scalar = layer?.scalar ? MERGE_SCALAR_STRATEGY_LABELS[layer.scalar] : "last wins"
  return `${dict}; ${list}; ${scalar}`
}

export function forkJoinCaption(fork: PipelineModule): ForkJoinCaption {
  const join = forkJoinOf(fork)
  const branches = forkBranchesOf(fork)
  if (join === "assemble") {
    const bindings = fork.assembleBindings ?? {}
    const mappings = Object.entries(bindings).map(([field, source]) => ({
      lane: assembleSourceCaption(source),
      into: field,
    }))
    return {
      join,
      title: "assemble join",
      detail: mappings.length
        ? "zip named fields from spine and lane labels"
        : "bind output fields to spine or lane labels",
      mappings,
    }
  }
  if (join === "merge") {
    return {
      join,
      title: "merge join",
      detail: mergePolicyCaption(fork),
      mappings: branches.map((b) => ({ lane: b.label, into: "merged object" })),
    }
  }
  return {
    join,
    title: "product join",
    detail: "one field per lane on the joined structure",
    mappings: branches.map((b) => ({ lane: b.label, into: forkProductField(b) })),
  }
}
