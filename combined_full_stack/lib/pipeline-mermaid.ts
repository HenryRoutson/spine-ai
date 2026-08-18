import { combineGroupAt, segmentPipeline, type PipelineSegment } from "@/lib/pipeline-layout"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { formatModuleSpineIn, formatModuleSpineOut } from "@/lib/spine-type"
import { ModuleKind, type PipelineModule, type StructureModel } from "@/lib/types"

export type PipelineMermaidTheme = "light" | "dark"

// AI : escape labels for mermaid flowchart node text — derived live from pipeline modules.
function mermaidEscape(text: string): string {
  return text.replace(/"/g, "'").replace(/\[/g, "(").replace(/\]/g, ")")
}

function nodeId(modules: PipelineModule[], moduleId: string): string {
  const i = flattenPipelineModules(modules).findIndex((m) => m.id === moduleId)
  return i >= 0 ? `n${i}` : `n_${moduleId.replace(/\W/g, "_")}`
}

function stepIoLine(m: PipelineModule, models: StructureModel[]): string {
  const inT = formatModuleSpineIn(m, models)
  const outT = formatModuleSpineOut(m, models)
  if (m.kind === ModuleKind.Input) return `→ ${outT}`
  if (m.kind === ModuleKind.Output || m.kind === ModuleKind.Assert || m.kind === ModuleKind.HumanReview) {
    return inT
  }
  return `${inT} → ${outT}`
}

function stepNodeLabel(m: PipelineModule, stepNum: number, models: StructureModel[]): string {
  const kind = m.kind.replace(/-/g, " ")
  return `${stepNum}. ${m.label}<br/><small>${kind} · ${stepIoLine(m, models)}</small>`
}

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"

function defineNode(
  modules: PipelineModule[],
  m: PipelineModule,
  stepNum: number,
  models: StructureModel[],
): string {
  const id = nodeId(modules, m.id)
  const label = mermaidEscape(stepNodeLabel(m, stepNum, models))
  return `  ${id}["${label}"]:::step`
}

function themeFrontmatter(theme: PipelineMermaidTheme): string[] {
  const vars =
    theme === "dark"
      ? [
          `    fontFamily: '${MONO_FONT}'`,
          "    background: 'transparent'",
          "    primaryColor: '#000000'",
          "    primaryTextColor: '#ffffff'",
          "    primaryBorderColor: '#ffffff'",
          "    lineColor: '#a3a3a3'",
          "    secondaryColor: '#171717'",
          "    tertiaryColor: '#262626'",
          "    edgeLabelBackground: '#000000'",
          "    edgeLabelText: '#ffffff'",
        ]
      : [
          `    fontFamily: '${MONO_FONT}'`,
          "    background: 'transparent'",
          "    primaryColor: '#ffffff'",
          "    primaryTextColor: '#000000'",
          "    primaryBorderColor: '#000000'",
          "    lineColor: '#525252'",
          "    secondaryColor: '#f5f5f5'",
          "    tertiaryColor: '#e5e5e5'",
          "    edgeLabelBackground: '#ffffff'",
          "    edgeLabelText: '#000000'",
        ]

  return ["---", "config:", "  theme: base", "  themeVariables:", ...vars, "---"]
}

function themeClassDefs(theme: PipelineMermaidTheme): string[] {
  if (theme === "dark") {
    return [
      "classDef step fill:#000000,stroke:#ffffff,stroke-width:2px,color:#ffffff,rx:6px,ry:6px",
      "classDef empty fill:#171717,stroke:#737373,stroke-width:2px,color:#d4d4d4,rx:6px,ry:6px",
    ]
  }

  return [
    "classDef step fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000,rx:6px,ry:6px",
    "classDef empty fill:#f5f5f5,stroke:#737373,stroke-width:2px,color:#525252,rx:6px,ry:6px",
  ]
}

// AI : flowchart LR mirrors the pipeline canvas — spine plus dashed side feeds into combine steps.
export function derivePipelineMermaid(
  modules: PipelineModule[],
  models: StructureModel[],
  theme: PipelineMermaidTheme = "light",
): string {
  if (!modules.length) {
    return [
      ...themeFrontmatter(theme),
      "flowchart LR",
      ...themeClassDefs(theme),
      '  empty["No pipeline steps yet"]:::empty',
    ].join("\n")
  }

  const nodeDefs: string[] = []
  const edges: string[] = []
  walkMermaidSegments(segmentPipeline(modules), modules, models, nodeDefs, edges, undefined)

  return [
    ...themeFrontmatter(theme),
    "flowchart LR",
    ...themeClassDefs(theme),
    ...nodeDefs,
    ...edges,
  ].join("\n")
}

function walkMermaidSegments(
  segments: PipelineSegment[],
  modules: PipelineModule[],
  models: StructureModel[],
  nodeDefs: string[],
  edges: string[],
  prevMainId: string | undefined,
): string | undefined {
  let prev = prevMainId
  const flat = flattenPipelineModules(modules)
  for (const seg of segments) {
    if (seg.kind === "step") {
      nodeDefs.push(defineNode(modules, seg.module, flat.findIndex((m) => m.id === seg.module.id) + 1, models))
      const nid = nodeId(modules, seg.module.id)
      if (prev) edges.push(`  ${prev} --> ${nid}`)
      prev = nid
      continue
    }
    if (seg.kind === "fork") {
      const forkNid = nodeId(modules, seg.fork.id)
      nodeDefs.push(defineNode(modules, seg.fork, flat.findIndex((m) => m.id === seg.fork.id) + 1, models))
      for (const b of seg.branches) {
        const subId = `lane_${b.id.replace(/\W/g, "_")}`
        nodeDefs.push(`  subgraph ${subId}["${mermaidEscape(b.label)}"]`)
        const first = b.segments[0]
        const last = walkMermaidSegments(b.segments, modules, models, nodeDefs, edges, undefined)
        nodeDefs.push("  end")
        if (prev && first) {
          const firstId =
            first.kind === "step"
              ? nodeId(modules, first.module.id)
              : first.kind === "combine"
                ? nodeId(modules, first.combine.id)
                : nodeId(modules, first.fork.id)
          edges.push(`  ${prev} --> ${firstId}`)
        } else if (prev) {
          edges.push(`  ${prev} --> ${forkNid}`)
        }
        if (last) edges.push(`  ${last} --> ${forkNid}`)
      }
      if (prev && seg.branches.every((b) => b.segments.length === 0)) {
        edges.push(`  ${prev} --> ${forkNid}`)
      }
      prev = forkNid
      continue
    }

    const { combine, input, parse, index } = seg
    nodeDefs.push(defineNode(modules, input, flat.findIndex((m) => m.id === input.id) + 1, models))
    if (parse) {
      nodeDefs.push(defineNode(modules, parse, flat.findIndex((m) => m.id === parse.id) + 1, models))
    }
    nodeDefs.push(defineNode(modules, combine, index + 1, models))

    const inputNid = nodeId(modules, input.id)
    const parseNid = parse ? nodeId(modules, parse.id) : undefined
    const combineNid = nodeId(modules, combine.id)
    const sideTail = parseNid ?? inputNid

    if (parseNid) edges.push(`  ${inputNid} --> ${parseNid}`)
    edges.push(`  ${sideTail} -. "side input" .-> ${combineNid}`)
    if (prev) edges.push(`  ${prev} --> ${combineNid}`)
    prev = combineNid
  }
  return prev
}

// AI : sanity check for combine side feeds when building the graph.
export function combineSideInputIndex(modules: PipelineModule[], combineIndex: number): number | undefined {
  const g = combineGroupAt(modules, combineIndex)
  if (!g) return undefined
  return modules.findIndex((m) => m.id === g.input.id)
}
