// AI : cache / step traces / DAG live in the library, not as extra JSON fields.
import { stepNeverCaches } from "@/lib/module-kinds"
import type { PipelineAssistantModuleSpec } from "@/lib/server/pipeline-authoring-schema"
import type { SpineProgram } from "./api"

const cacheMem = new Map<string, unknown>()

export function withCache<T>(key: string, compute: () => T): T {
  if (cacheMem.has(key)) return cacheMem.get(key) as T
  const value = compute()
  cacheMem.set(key, value)
  return value
}

export function cachePlan(program: SpineProgram): Array<{ label: string; kind: string; cached: boolean }> {
  return flattenSpecs(program.modules).map((m) => ({
    label: m.label,
    kind: m.kind,
    cached: !stepNeverCaches(m.kind),
  }))
}

export function stepOutputs(program: SpineProgram): Array<{
  label: string
  kind: string
  structureIn?: string
  structureOut?: string
}> {
  return flattenSpecs(program.modules).map((m) => ({
    label: m.label,
    kind: m.kind,
    structureIn: m.structureIn,
    structureOut: m.structureOut,
  }))
}

function flattenSpecs(modules: PipelineAssistantModuleSpec[]): PipelineAssistantModuleSpec[] {
  const out: PipelineAssistantModuleSpec[] = []
  for (const m of modules) {
    out.push(m)
    if (m.forkBranches) {
      for (const b of m.forkBranches) {
        out.push(...flattenSpecs((b.modules as PipelineAssistantModuleSpec[]) ?? []))
      }
    }
  }
  return out
}

export function mermaidFromProgram(program: SpineProgram): string {
  const lines = ["flowchart LR"]
  const walk = (modules: PipelineAssistantModuleSpec[], prefix: string, prev?: string) => {
    let prevId = prev
    modules.forEach((m, i) => {
      const id = `${prefix}${i}`
      const out = m.structureOut ? ` → ${m.structureOut}` : ""
      lines.push(`  ${id}["${m.kind}: ${m.label}${out}"]`)
      if (prevId) lines.push(`  ${prevId} --> ${id}`)
      if (m.kind === "fork" && m.forkBranches) {
        m.forkBranches.forEach((b, bi) => {
          const nested = (b.modules as PipelineAssistantModuleSpec[]) ?? []
          if (!nested.length) return
          lines.push(`  subgraph ${id}_b${bi}["${b.label}"]`)
          walk(nested, `${id}_${bi}_`, id)
          lines.push("  end")
        })
      }
      prevId = id
    })
    return prevId
  }
  walk(program.modules, "n")
  return lines.join("\n")
}
