import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { loadProjectContext } from "@/lib/cli/project_context"
import { DEFAULT_MODEL, FieldType, ModuleKind, type StructureModel, type StructureModelId } from "@/lib/types"
import { uid } from "@/lib/id"
import { materializeProposal } from "@/lib/server/pipeline_assistant"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { SEEDS_DIR } from "@/lib/server/seed"
import {
  VIBE_THINKING_MAX_TOKENS,
  isReadonlyVibePath,
  isWritableVibePath,
  listVibePaths,
  normalizeVibePath,
  parseVibeWorkspaceFiles,
  seedVibeWorkspace,
} from "@/lib/server/vibe-coding-workspace"
import { executeVibeHarnessTool, vibeHarnessEnabled } from "@/lib/server/vibe-coding-harness"

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
    expect(VIBE_THINKING_MAX_TOKENS).toBeGreaterThanOrEqual(4096)
  })

  it("rejects path traversal and keeps AGENTS.md read-only", () => {
    expect(normalizeVibePath("../etc/passwd")).toBeNull()
    expect(normalizeVibePath("/etc/passwd")).toBeNull()
    expect(normalizeVibePath("structures/../pipeline.json")).toBeNull()
    expect(isReadonlyVibePath("AGENTS.md")).toBe(true)
    expect(isWritableVibePath("AGENTS.md")).toBe(false)
    expect(isWritableVibePath("pipeline.json")).toBe(true)
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
  it("skips the file loop for the deterministic seed provider", () => {
    const prev = process.env.LLM_PROVIDER
    process.env.LLM_PROVIDER = "seed"
    expect(vibeHarnessEnabled()).toBe(false)
    if (prev === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prev
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
})
