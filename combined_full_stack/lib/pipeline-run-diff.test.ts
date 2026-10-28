import { describe, expect, it } from "vitest"
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"
import { enrichRunModules } from "@/lib/pipeline-run-diff"

function step(partial: Omit<Partial<PipelineModule>, "id"> & { id: string; kind: PipelineModule["kind"]; label: string }): PipelineModule {
  return {
    note: "",
    cached: true,
    avgMs: 0,
    avgCostCents: 0,
    ...partial,
    id: partial.id as ModuleId,
  }
}

describe("enrichRunModules nested forks", () => {
  it("copies I/O config from a step inside a nested lane", () => {
    const nested = step({
      id: "mod_html",
      kind: ModuleKind.N8n,
      label: "Strip HTML",
      inStructureId: "m_post" as PipelineModule["inStructureId"],
      outStructureId: "m_text" as PipelineModule["outStructureId"],
    })
    const current: PipelineModule[] = [
      step({ id: "mod_in", kind: ModuleKind.Input, label: "Raw Post" }),
      step({
        id: "mod_outer",
        kind: ModuleKind.Fork,
        label: "Prepare",
        forkJoin: "product",
        forkBranches: [
          {
            id: "copy",
            label: "Copy",
            modules: [
              step({
                id: "mod_inner",
                kind: ModuleKind.Fork,
                label: "Formats",
                forkJoin: "product",
                forkBranches: [{ id: "html", label: "HTML", modules: [nested] }],
              }),
            ],
          },
        ],
      }),
    ]
    const runModules: PipelineModule[] = [
      step({ id: "mod_html", kind: ModuleKind.N8n, label: "Strip HTML" }),
    ]
    const enriched = enrichRunModules(runModules, current)
    expect(enriched[0]?.inStructureId).toBe("m_post")
    expect(enriched[0]?.outStructureId).toBe("m_text")
  })
})
