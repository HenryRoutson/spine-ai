import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { loadProjectContext } from "@/lib/cli/project_context"
import { DEFAULT_MODEL, FieldType, ModuleKind, type StructureModel, type StructureModelId } from "@/lib/types"
import { uid } from "@/lib/id"
import { materializeProposal, runVibeWorkspaceChecks } from "@/lib/server/pipeline_assistant"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { SEEDS_DIR } from "@/lib/server/seed"
import {
  VIBE_HARNESS_MAX_TOKENS,
  VIBE_THINKING_MAX_TOKENS,
  isReadonlyVibePath,
  isWritableVibePath,
  listVibePaths,
  normalizeVibePath,
  parseVibeWorkspaceFiles,
  seedVibeWorkspace,
  coerceVibePipelineModules,
} from "@/lib/server/vibe-coding-workspace"
import {
  executeVibeHarnessTool,
  vibeHarnessEnabled,
  applyHarnessTurn,
  isHarnessProposalPass,
  harnessDraftHasPipelineWork,
  vibeHarnessTurnSchema,
} from "@/lib/server/vibe-coding-harness"

type AssistantRaw = Parameters<typeof materializeProposal>[0]

function receiptModules(): AssistantRaw["modules"] {
  return [
    {
      kind: ModuleKind.Input,
      label: "Receipt Uploads",
      note: "Many receipt files.",
      structureOut: "list[Document]",
      inputType: "text",
      inputMinCount: 2,
      inputDescription: "receipt files",
    },
    {
      kind: ModuleKind.LlmBatch,
      label: "Extract Each Receipt",
      note: "One row per file.",
      structureIn: "Document",
      structureOut: "ReceiptRow",
      prompt: "Extract vendor and amount.",
      inputDescription: "list of documents",
    },
    {
      kind: ModuleKind.Output,
      label: "Receipt Rows Output",
      structureIn: "ReceiptRow",
      structureOut: "ReceiptRow",
      inputDescription: "rows",
    },
  ]
}

describe("vibe coding workspace", () => {
  it("gives thinking enough budget for a real plan", () => {
    expect(VIBE_THINKING_MAX_TOKENS).toBeGreaterThanOrEqual(8192)
    expect(VIBE_HARNESS_MAX_TOKENS).toBeGreaterThanOrEqual(4096)
  })

  it("rejects path traversal and keeps AGENTS.md read-only", () => {
    expect(normalizeVibePath("../etc/passwd")).toBeNull()
    expect(normalizeVibePath("/etc/passwd")).toBeNull()
    expect(normalizeVibePath("structures/../pipeline.json")).toBeNull()
    expect(isReadonlyVibePath("AGENTS.md")).toBe(true)
    expect(isWritableVibePath("AGENTS.md")).toBe(false)
    expect(isWritableVibePath("pipeline.json")).toBe(true)
    expect(isWritableVibePath("pipeline.js")).toBe(true)
    expect(isWritableVibePath("structures/ReceiptRow.json")).toBe(true)
    expect(isWritableVibePath("tests/receipt.txt")).toBe(true)
  })

  it("round-trips a seed into files the agent can edit", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const ws = seedVibeWorkspace({ project: ctx.project, globalModel: DEFAULT_MODEL })
    expect(ws.files.get("AGENTS.md")).toMatch(/run_tests/)
    expect(ws.files.get("AGENTS.md")).toMatch(/RAM only/)
    expect(ws.files.has("pipeline.json")).toBe(true)
    expect(listVibePaths(ws.files, "structures").length).toBeGreaterThan(0)
    const draft = parseVibeWorkspaceFiles(ws.files, ws.seed)
    expect(draft.errors).toEqual([])
    expect(draft.modules).toBeNull()
    expect(draft.models).toBeNull()
  })

  it("serializes multi-type inputs as a single assistant inputType", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "company_legal_evaluation.json"))
    const ws = seedVibeWorkspace({ project: ctx.project, globalModel: DEFAULT_MODEL })
    const pipeline = JSON.parse(ws.files.get("pipeline.json") ?? "[]") as Array<{ inputType?: unknown }>
    for (const step of pipeline) {
      if (step.inputType !== undefined) expect(typeof step.inputType).toBe("string")
    }
  })

  it("treats pipeline.json edits as a full modules replacement and catches list/single bugs", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const model: StructureModel = {
      id: uid<StructureModelId>("m_"),
      name: "ReceiptRow",
      description: "One receipt.",
      fields: [{ id: uid("f_"), name: "vendor", type: FieldType.Text, optional: false, description: "Vendor" }],
    }
    session.applyProjectChanges({ models: [model] })
    const good: AssistantRaw = {
      message: "map receipts",
      modules: receiptModules(),
      modulePatch: null,
      models: [{ name: "ReceiptRow", description: "One receipt.", fields: [{ name: "vendor", type: "text", optional: false, description: "Vendor" }] }],
      typeAliases: null,
      docs: null,
      documentationUpdate: "# Receipts",
      projectNameUpdate: null,
      proposedActions: null,
      targetFunctionName: null,
    }
    const goodProposal = materializeProposal(good, session.project!, DEFAULT_MODEL)!
    session.applyProposal(goodProposal)

    const ws = seedVibeWorkspace({ project: session.project!, globalModel: DEFAULT_MODEL })
    const broken = receiptModules()!
    broken[0] = { ...broken[0]!, structureOut: "Document" }
    ws.files.set("pipeline.json", `${JSON.stringify(broken, null, 2)}\n`)
    const draft = parseVibeWorkspaceFiles(ws.files, ws.seed)
    expect(draft.modules).toEqual(broken)
    const raw: AssistantRaw = {
      ...good,
      modules: draft.modules as AssistantRaw["modules"],
      models: null,
      documentationUpdate: null,
    }
    const proposal = materializeProposal(raw, session.project!, DEFAULT_MODEL)!
    const errors = formatPipelineValidationErrors(proposal.modules, proposal.models, proposal.typeAliases)
    expect(errors).toMatch(/list/i)
  })
})

describe("vibe coding harness tools", () => {
  it("skips the file loop for the deterministic seed provider unless the flag is on", () => {
    const prevProvider = process.env.LLM_PROVIDER
    const prevHarness = process.env.SPINE_VIBE_HARNESS
    process.env.LLM_PROVIDER = "seed"
    delete process.env.SPINE_VIBE_HARNESS
    expect(vibeHarnessEnabled()).toBe(false)
    process.env.SPINE_VIBE_HARNESS = "0"
    expect(vibeHarnessEnabled()).toBe(false)
    process.env.SPINE_VIBE_HARNESS = "1"
    expect(vibeHarnessEnabled()).toBe(true)
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    if (prevHarness === undefined) delete process.env.SPINE_VIBE_HARNESS
    else process.env.SPINE_VIBE_HARNESS = prevHarness
  })

  it("write_file refuses escapes and run_tests writes VALIDATION.md", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const ws = seedVibeWorkspace({ project: session.project!, globalModel: DEFAULT_MODEL })
    const escaped = executeVibeHarnessTool(
      { tool: "write_file", path: "../secret.env", content: "KEY=1" },
      ws,
      () => "PASS",
    )
    expect(escaped).toMatch(/^error:/)
    expect([...ws.files.keys()].some((p) => p.includes("secret"))).toBe(false)

    const agents = executeVibeHarnessTool(
      { tool: "write_file", path: "AGENTS.md", content: "nope" },
      ws,
      () => "PASS",
    )
    expect(agents).toMatch(/read-only/)

    const wrote = executeVibeHarnessTool(
      { tool: "write_file", path: "message.md", content: "I'll add a receipt pipeline." },
      ws,
      () => "PASS",
    )
    expect(wrote).toMatch(/wrote message.md/)
    const tested = executeVibeHarnessTool({ tool: "run_tests" }, ws, () => "PASS\nI/O valid")
    expect(tested).toContain("PASS")
    expect(ws.files.get("VALIDATION.md")).toContain("PASS")
  })

  it("auto run_tests after writes and ignores Q&A PASS / premature done", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const ws = seedVibeWorkspace({ project: session.project!, globalModel: DEFAULT_MODEL })
    const qa = isHarnessProposalPass("PASS (no project file changes — Q&A only).", {
      message: "hi",
      modules: null,
      models: null,
      typeAliases: null,
      docs: null,
      documentationUpdate: null,
      projectNameUpdate: null,
      targetFunctionName: null,
      proposedActions: null,
      errors: [],
    })
    expect(qa).toBe(false)

    const applied = applyHarnessTurn(
      {
        tools: [
          { tool: "write_file", path: "message.md", content: "I'll add a notes pipeline." },
          { tool: "done", message: "done early" },
        ],
      },
      ws,
      () => "FAIL schema — pipeline.json still a stub Input",
    )
    expect(applied.wrote).toBe(true)
    expect(applied.done).toBe(false)
    expect(applied.results.some((r) => r.includes("run_tests (auto)"))).toBe(true)
    expect(ws.files.get("VALIDATION.md")).toMatch(/FAIL/)
  })

  it("keeps the first 12 tools instead of failing the turn", () => {
    const tools = Array.from({ length: 15 }, (_, i) => ({
      tool: "write_file" as const,
      path: i === 0 ? "pipeline.json" : `tests/doc_${i}.txt`,
      content: i === 0 ? "[]" : `file ${i}`,
    }))
    const parsed = vibeHarnessTurnSchema.safeParse({ tools })
    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.tools).toHaveLength(12)
    expect(parsed.data.tools[0]?.path).toBe("pipeline.json")
  })

  it("run_tests reports Document structureOut errors instead of a generic FAIL", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const ws = seedVibeWorkspace({ project: session.project!, globalModel: DEFAULT_MODEL })
    executeVibeHarnessTool(
      {
        tool: "write_file",
        path: "pipeline.json",
        content: JSON.stringify(
          [
            {
              kind: "input",
              label: "Policy",
              note: "KYC policy PDF.",
              inputType: "pdf",
              structureOut: "KycRule",
            },
            {
              kind: "output",
              label: "Out",
              structureIn: "KycRule",
              structureOut: "KycRule",
            },
          ],
          null,
          2,
        ),
      },
      ws,
      () => "unused",
    )
    const draft = parseVibeWorkspaceFiles(ws.files, ws.seed)
    const report = runVibeWorkspaceChecks(draft, session.project!, DEFAULT_MODEL, [])
    expect(report).toMatch(/^FAIL schema/m)
    expect(report).toMatch(/structureOut Document/)
  })

  it("does not treat Input+Output as a finished pipeline", () => {
    expect(
      harnessDraftHasPipelineWork({
        message: "ok",
        modules: [
          { kind: "input", label: "Input", note: "in", structureOut: "Document" },
          { kind: "output", label: "Output" },
        ],
        models: null,
        typeAliases: null,
        docs: null,
        documentationUpdate: null,
        projectNameUpdate: null,
        targetFunctionName: null,
        proposedActions: null,
        errors: [],
      }),
    ).toBe(false)
    expect(
      harnessDraftHasPipelineWork({
        message: "ok",
        modules: [
          { kind: "input", label: "Files", note: "uploads", structureOut: "list[Document]" },
          { kind: "llm-batch", label: "Extract", note: "one row", structureIn: "Document", structureOut: "Row" },
          { kind: "output", label: "Rows" },
        ],
        models: null,
        typeAliases: null,
        docs: null,
        documentationUpdate: null,
        projectNameUpdate: null,
        targetFunctionName: null,
        proposedActions: null,
        errors: [],
      }),
    ).toBe(true)
  })

  it("coerces typed non-JSON inputs to Document and drops empty forks", () => {
    const coerced = coerceVibePipelineModules([
      {
        kind: "input",
        label: "Policy",
        note: "KYC policy PDF.",
        inputType: "pdf",
        structureOut: "KycRule",
      },
      { kind: "fork", label: "Split" },
      {
        kind: "fork",
        label: "Extract",
        prompt: "Extract rules.",
        structureOut: "KycRule",
      },
      { kind: "output", label: "Out", structureIn: "KycRule", structureOut: "KycRule" },
    ]) as Array<{ kind: string; structureOut?: string }>
    expect(coerced[0]?.structureOut).toBe("Document")
    expect(coerced.map((s) => s.kind)).toEqual(["input", "llm", "output"])
    expect(coerced[1]?.structureOut).toBe("KycRule")
  })
})
