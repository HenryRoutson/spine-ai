import { describe, expect, it } from "vitest"
import { pipelineDagIsAcyclic, pipelineToDag, DAG_END_ID, DAG_START_ID, PipelineTriggerKind, pipelineTriggerId } from "@/lib/pipeline-dag"
import {
  DAG_STEP_SIZE,
  layoutPipelineDag,
  roundedOrthogonalPath,
} from "@/lib/pipeline-dag-layout"
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
    expect(dag.nodes.map((n) => n.id)).toEqual(expect.arrayContaining([DAG_START_ID, DAG_END_ID, "in", "llm", "out"]))
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
        ifCondition: { kind: IfConditionKind.Path, path: "is_legal" },
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

describe("pipeline DAG triggers", () => {
  it("always hangs a Manual trigger off Start without creating a cycle", () => {
    const modules = [step({ id: "in", kind: ModuleKind.Input, label: "In" })]
    const dag = pipelineToDag(modules)
    const manualId = pipelineTriggerId(PipelineTriggerKind.Manual)
    expect(pipelineDagIsAcyclic(dag)).toBe(true)
    expect(dag.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: manualId, kind: "trigger", triggerKind: PipelineTriggerKind.Manual }),
      ]),
    )
    expect(dag.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: manualId, target: DAG_START_ID, kind: "trigger" })]),
    )
    expect(dag.edges.some((e) => e.source === DAG_START_ID && e.target === manualId)).toBe(false)
  })

  it("accepts Schedule / Share / inbound-webhook as extra Start entries", () => {
    const modules = [step({ id: "in", kind: ModuleKind.Input, label: "In" })]
    const dag = pipelineToDag(modules, {
      triggers: [
        { id: "", kind: PipelineTriggerKind.Schedule, label: "Weekdays 9am" },
        { id: "", kind: PipelineTriggerKind.ShareLink, label: "Share link" },
        { id: "", kind: PipelineTriggerKind.InboundWebhook, label: "Inbound webhook" },
      ],
    })
    expect(pipelineDagIsAcyclic(dag)).toBe(true)
    expect(dag.nodes.filter((n) => n.kind === "trigger").map((n) => n.triggerKind).sort()).toEqual([
      PipelineTriggerKind.InboundWebhook,
      PipelineTriggerKind.Manual,
      PipelineTriggerKind.Schedule,
      PipelineTriggerKind.ShareLink,
    ].sort())
    const laid = layoutPipelineDag(dag)
    expect(laid.edges.filter((e) => e.kind === "trigger").every((e) => e.dashed && e.path.length > 0)).toBe(true)
    const chart = derivePipelineMermaid(modules, [])
    expect(chart).toContain("trig_manual")
    expect(chart).toContain("-.->")
  })
})

describe("pipeline DAG layout core", () => {
  it("rounds orthogonal corners and keeps a straight spine as a line", () => {
    const bent = roundedOrthogonalPath([
      { x: 0, y: 0 },
      { x: 0, y: 40 },
      { x: 80, y: 40 },
      { x: 80, y: 80 },
    ])
    expect(bent).toContain("Q")
    expect(bent.startsWith("M ")).toBe(true)
    const straight = roundedOrthogonalPath([
      { x: 10, y: 0 },
      { x: 10, y: 50 },
    ])
    expect(straight).toBe("M 10.0 0.0 L 10.0 50.0")
    expect(straight).not.toContain("Q")
  })

  it("aligns a linear pipeline as a vertical spine with original card sizes", () => {
    const modules = [
      step({ id: "in", kind: ModuleKind.Input, label: "In" }),
      step({ id: "llm", kind: ModuleKind.Llm, label: "Ask" }),
      step({ id: "out", kind: ModuleKind.Output, label: "Out" }),
    ]
    const laid = layoutPipelineDag(pipelineToDag(modules))
    const byId = new Map(laid.nodes.map((n) => [n.id, n]))
    const inN = byId.get("in")!
    const llm = byId.get("llm")!
    const out = byId.get("out")!
    expect(inN.width).toBe(DAG_STEP_SIZE.width)
    expect(inN.height).toBe(DAG_STEP_SIZE.height)
    expect(Math.abs(inN.x - llm.x)).toBeLessThan(1)
    expect(Math.abs(llm.x - out.x)).toBeLessThan(1)
    expect(inN.y).toBeLessThan(llm.y)
    expect(llm.y).toBeLessThan(out.y)
    const spine = laid.edges.find((e) => e.source === "in" && e.target === "llm")
    expect(spine?.path).toMatch(/^M /)
    expect(spine?.path).not.toContain("Q")
    expect(spine?.dashed).toBe(false)
  })

  it("fans Then/Else with rounded connectors and lane labels off the path", () => {
    const modules = [
      step({ id: "in", kind: ModuleKind.Input, label: "In" }),
      step({
        id: "ife",
        kind: ModuleKind.IfElse,
        label: "Route",
        ifCondition: { kind: IfConditionKind.Path, path: "is_legal" },
        forkBranches: [
          { id: "t", label: "Then", modules: [step({ id: "t1", kind: ModuleKind.N8n, label: "Legal" })] },
          { id: "e", label: "Else", modules: [step({ id: "e1", kind: ModuleKind.N8n, label: "Billing" })] },
        ],
      }),
    ]
    const laid = layoutPipelineDag(pipelineToDag(modules))
    expect(laid.edges.every((e) => e.path.length > 0)).toBe(true)
    expect(laid.edges.some((e) => e.path.includes("Q"))).toBe(true)
    const thenEdge = laid.edges.find((e) => e.kind === "then" && e.label === "Then")
    const elseEdge = laid.edges.find((e) => e.kind === "else" && e.label === "Else")
    expect(thenEdge?.labelAt).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }))
    expect(elseEdge?.labelAt).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }))
    const boxes = laid.nodes.map((n) => ({
      l: n.x,
      t: n.y,
      r: n.x + n.width,
      b: n.y + n.height,
    }))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const b = boxes[j]!
        const overlap = a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t
        expect(overlap).toBe(false)
      }
    }
  })
})
