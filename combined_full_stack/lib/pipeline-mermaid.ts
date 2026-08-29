import { pipelineToDag, DAG_END_ID, DAG_START_ID } from "@/lib/pipeline-dag"
import { combineGroupAt } from "@/lib/pipeline-layout"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { formatModuleSpineIn, formatModuleSpineOut } from "@/lib/spine-type"
import { ModuleKind, type PipelineModule, type StructureModel } from "@/lib/types"

export type PipelineMermaidTheme = "light" | "dark"

function mermaidEscape(text: string): string {
  return text.replace(/"/g, "'").replace(/\[/g, "(").replace(/\]/g, ")")
}

function nodeId(modules: PipelineModule[], moduleId: string): string {
  if (moduleId === DAG_START_ID) return "start"
  if (moduleId === DAG_END_ID) return "end"
  if (moduleId.startsWith("__trigger_")) return `trig_${moduleId.slice("__trigger_".length).replace(/\W/g, "_")}`
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
      "classDef terminal fill:#171717,stroke:#ffffff,stroke-width:1px,color:#d4d4d4,rx:12px,ry:12px",
    ]
  }

  return [
    "classDef step fill:#ffffff,stroke:#000000,stroke-width:2px,color:#000000,rx:6px,ry:6px",
    "classDef empty fill:#f5f5f5,stroke:#737373,stroke-width:2px,color:#525252,rx:6px,ry:6px",
    "classDef terminal fill:#f5f5f5,stroke:#000000,stroke-width:1px,color:#525252,rx:12px,ry:12px",
  ]
}

// AI : flowchart LR is the pipeline DAG (d3-dag / mermaid share pipelineToDag).
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

  const dag = pipelineToDag(modules)
  const flat = flattenPipelineModules(modules)
  const nodeDefs: string[] = []
  for (const n of dag.nodes) {
    if (n.kind === "start") {
      nodeDefs.push('  start["Start"]:::terminal')
      continue
    }
    if (n.kind === "end") {
      nodeDefs.push('  end["End"]:::terminal')
      continue
    }
    if (n.kind === "trigger") {
      nodeDefs.push(`  ${nodeId(modules, n.id)}["${mermaidEscape(n.label)}"]:::terminal`)
      continue
    }
    const m = n.module
    if (!m) continue
    const stepNum = flat.findIndex((x) => x.id === m.id) + 1
    const id = nodeId(modules, m.id)
    nodeDefs.push(`  ${id}["${mermaidEscape(stepNodeLabel(m, stepNum, models))}"]:::step`)
  }

  const edges: string[] = []
  for (const e of dag.edges) {
    const src = nodeId(modules, e.source)
    const dst = nodeId(modules, e.target)
    if (e.kind === "side-input") {
      edges.push(`  ${src} -. "side input" .-> ${dst}`)
      continue
    }
    if (e.kind === "trigger") {
      edges.push(`  ${src} -.-> ${dst}`)
      continue
    }
    if (e.label) {
      edges.push(`  ${src} -->|"${mermaidEscape(e.label)}"| ${dst}`)
      continue
    }
    edges.push(`  ${src} --> ${dst}`)
  }

  return [
    ...themeFrontmatter(theme),
    "flowchart LR",
    ...themeClassDefs(theme),
    ...nodeDefs,
    ...edges,
  ].join("\n")
}

export function combineSideInputIndex(modules: PipelineModule[], combineIndex: number): number | undefined {
  const g = combineGroupAt(modules, combineIndex)
  if (!g) return undefined
  return modules.findIndex((m) => m.id === g.input.id)
}
