import { combineGroupAt, segmentPipeline } from "@/lib/pipeline-layout"
import { formatModuleSpineIn, formatModuleSpineOut } from "@/lib/spine-type"
import { ModuleKind, type PipelineModule, type StructureModel } from "@/lib/types"

export type PipelineMermaidTheme = "light" | "dark"

// AI : escape labels for mermaid flowchart node text — derived live from pipeline modules.
function mermaidEscape(text: string): string {
  return text.replace(/"/g, "'").replace(/\[/g, "(").replace(/\]/g, ")")
}

function nodeId(modules: PipelineModule[], moduleId: string): string {
  const i = modules.findIndex((m) => m.id === moduleId)
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
// AI : TODO (allow-pipeline-non-linear-fork) — mermaid subgraph per lane; join node after parallel edges.
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

  const segments = segmentPipeline(modules)
  const nodeDefs: string[] = []
  const edges: string[] = []
  let prevMainId: string | undefined

  for (const seg of segments) {
    if (seg.kind === "step") {
      nodeDefs.push(defineNode(modules, seg.module, seg.index + 1, models))
      const nid = nodeId(modules, seg.module.id)
      if (prevMainId) edges.push(`  ${prevMainId} --> ${nid}`)
      prevMainId = nid
      continue
    }

    const { combine, input, parse, index } = seg
    nodeDefs.push(defineNode(modules, input, modules.findIndex((m) => m.id === input.id) + 1, models))
    if (parse) {
      nodeDefs.push(defineNode(modules, parse, modules.findIndex((m) => m.id === parse.id) + 1, models))
    }
    nodeDefs.push(defineNode(modules, combine, index + 1, models))

    const inputNid = nodeId(modules, input.id)
    const parseNid = parse ? nodeId(modules, parse.id) : undefined
    const combineNid = nodeId(modules, combine.id)
    const sideTail = parseNid ?? inputNid

    if (parseNid) edges.push(`  ${inputNid} --> ${parseNid}`)
    edges.push(`  ${sideTail} -. "side input" .-> ${combineNid}`)
    if (prevMainId) edges.push(`  ${prevMainId} --> ${combineNid}`)
    prevMainId = combineNid
  }

  return [
    ...themeFrontmatter(theme),
    "flowchart LR",
    ...themeClassDefs(theme),
    ...nodeDefs,
    ...edges,
  ].join("\n")
}

// AI : sanity check for combine side feeds when building the graph.
export function combineSideInputIndex(modules: PipelineModule[], combineIndex: number): number | undefined {
  const g = combineGroupAt(modules, combineIndex)
  if (!g) return undefined
  return modules.findIndex((m) => m.id === g.input.id)
}
