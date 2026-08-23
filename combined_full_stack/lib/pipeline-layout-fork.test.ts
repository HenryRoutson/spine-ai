import { describe, expect, it } from "vitest"
import { ModuleKind, type ModuleId, type PipelineModule, type StructureModelId } from "@/lib/types"
import { segmentPipeline } from "@/lib/pipeline-layout"

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

describe("nested fork canvas", () => {
  it("renders an inner fork as a fork box, not a flat card", () => {
    const inner = step({
      id: "inner",
      kind: ModuleKind.Fork,
      label: "Inner",
      forkJoin: "product",
      forkBranches: [
        {
          id: "ia",
          label: "A",
          modules: [step({ id: "ia1", kind: ModuleKind.N8n, label: "Hash", n8nNodeType: "n8n-nodes-base.crypto" })],
        },
        {
          id: "ib",
          label: "B",
          modules: [step({ id: "ib1", kind: ModuleKind.N8n, label: "Set", n8nNodeType: "n8n-nodes-base.set" })],
        },
      ],
    })
    const outer = step({
      id: "outer",
      kind: ModuleKind.Fork,
      label: "Outer",
      forkJoin: "product",
      forkBranches: [
        { id: "oa", label: "Date", modules: [step({ id: "oa1", kind: ModuleKind.N8n, label: "Date", n8nNodeType: "n8n-nodes-base.dateTime" })] },
        { id: "ob", label: "Copy", modules: [inner] },
      ],
    })
    const segs = segmentPipeline([
      step({ id: "in", kind: ModuleKind.Input, label: "In", outStructureId: "m" as StructureModelId }),
      outer,
      step({ id: "out", kind: ModuleKind.Output, label: "Out" }),
    ])
    expect(segs.map((s) => s.kind)).toEqual(["step", "fork", "step"])
    const fork = segs[1]
    expect(fork?.kind).toBe("fork")
    if (fork?.kind !== "fork") return
    const copyLane = fork.branches.find((b) => b.label === "Copy")
    expect(copyLane?.segments[0]?.kind).toBe("fork")
  })
})
