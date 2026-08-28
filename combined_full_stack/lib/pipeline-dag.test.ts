import { describe, expect, it } from "vitest"
import { pipelineDagIsAcyclic, pipelineToDag, DAG_END_ID, DAG_START_ID } from "@/lib/pipeline-dag"
import { layoutPipelineDag } from "@/lib/pipeline-dag-layout"
import { derivePipelineMermaid } from "@/lib/pipeline-mermaid"
import { IfConditionKind, ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"

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

describe("pipeline DAG IR", () => {
  it("is a start-to-end chain for a linear pipeline", () => {
    const modules = [
      step({ id: "in", kind: ModuleKind.Input, label: "In" }),
      step({ id: "llm", kind: ModuleKind.Llm, label: "Ask" }),
      step({ id: "out", kind: ModuleKind.Output, label: "Out" }),
    ]
    const dag = pipelineToDag(modules)
    expect(pipelineDagIsAcyclic(dag)).toBe(true)
    expect(dag.nodes.map((n) => n.id)).toEqual([DAG_START_ID, DAG_END_ID, "in", "llm", "out"])
    expect(dag.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: DAG_START_ID, target: "in" }),
        expect.objectContaining({ source: "in", target: "llm" }),
        expect.objectContaining({ source: "llm", target: "out" }),
        expect.objectContaining({ source: "out", target: DAG_END_ID }),
      ]),
    )
  })

  it("fans Then/Else out of an if-else and joins at the if node", () => {
    const modules = [
      step({ id: "in", kind: ModuleKind.Input, label: "In" }),
      step({
        id: "ife",
        kind: ModuleKind.IfElse,
        label: "Route",
        ifCondition: { kind: IfConditionKind.Equals, path: "kind", value: "legal" },
        forkBranches: [
          { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.N8n, label: "Legal" })] },
          { id: "e", label: "Else", modules: [step({ id: "e1", kind: ModuleKind.N8n, label: "Billing" })] },
        ],
      }),
    ]
    const dag = pipelineToDag(modules)
    expect(pipelineDagIsAcyclic(dag)).toBe(true)
    expect(dag.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "in", target: "t1", kind: "then", label: "Then" }),
        expect.objectContaining({ source: "t1", target: "ife", kind: "then" }),
        expect.objectContaining({ source: "in", target: "e1", kind: "else", label: "Else" }),
        expect.objectContaining({ source: "e1", target: "ife", kind: "else" }),
      ]),
    )
    const laid = layoutPipelineDag(dag)
    expect(laid.width).toBeGreaterThan(80)
    expect(laid.height).toBeGreaterThan(80)
    expect(laid.nodes.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true)
    const chart = derivePipelineMermaid(modules, [])
    expect(chart).toContain("Then")
    expect(chart).toContain("Else")
    expect(chart).toContain("-->")
  })

  it("keeps empty Else as a skip-edge to the join", () => {
    const modules = [
      step({ id: "in", kind: ModuleKind.Input, label: "In" }),
      step({
        id: "ife",
        kind: ModuleKind.IfElse,
        label: "Route",
        ifCondition: { kind: IfConditionKind.Path, path: "ok" },
        forkBranches: [
          { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.Output, label: "LegalOut" })] },
          { id: "e", label: "Else", modules: [] },
        ],
      }),
    ]
    const dag = pipelineToDag(modules)
    expect(dag.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "in", target: "ife", kind: "else" }),
        expect.objectContaining({ source: "t1", target: "ife", kind: "then" }),
      ]),
    )
  })
})
