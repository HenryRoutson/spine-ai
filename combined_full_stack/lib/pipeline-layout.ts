import type { PipelineModule } from "@/lib/types"

export type PipelineSegment =
  | { kind: "step"; module: PipelineModule; index: number }
  | { kind: "combine"; combine: PipelineModule; input: PipelineModule; index: number }

// AI : combine steps consume pipeline state + a secondary input module immediately before them —
// AI : group the pair so the linear canvas shows where the extra document feeds in.
export function segmentPipeline(modules: PipelineModule[]): PipelineSegment[] {
  const segments: PipelineSegment[] = []
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i]
    if (m.kind === "input" && modules[i + 1]?.kind === "combine") continue
    if (m.kind === "combine" && modules[i - 1]?.kind === "input") {
      segments.push({ kind: "combine", combine: m, input: modules[i - 1], index: i })
    } else {
      segments.push({ kind: "step", module: m, index: i })
    }
  }
  return segments
}

// AI : move/remove treat the secondary input + combine as one block.
export function combinePairIds(modules: PipelineModule[], id: string): string[] {
  const i = modules.findIndex((m) => m.id === id)
  if (i < 0) return [id]
  const m = modules[i]
  if (m.kind === "input" && modules[i + 1]?.kind === "combine") return [m.id, modules[i + 1].id]
  if (m.kind === "combine" && modules[i - 1]?.kind === "input") return [modules[i - 1].id, m.id]
  return [id]
}
