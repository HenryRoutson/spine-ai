import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { loadProjectContext } from "@/lib/cli/project_context"
import { DEFAULT_MODEL, ModuleKind } from "@/lib/types"
import { BUILTIN_DOCUMENT_ID } from "@/lib/server/builtin_models"
import { materializeProposal } from "@/lib/server/pipeline_assistant"
import { formatPipelineValidationErrors } from "@/lib/server/validity"
import { stepEmitsList } from "@/lib/server/type_expr"
import { structureOutForAssistant } from "@/lib/server/assistant-prompt"
import { SEEDS_DIR } from "@/lib/server/seed"

type AssistantRaw = Parameters<typeof materializeProposal>[0]

function receiptMapRaw(overrides?: Partial<AssistantRaw>): AssistantRaw {
  return {
    message: "map receipts",
    modules: [
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
    ],
    modulePatch: null,
    models: [
      {
        name: "ReceiptRow",
        description: "One receipt.",
        fields: [{ name: "vendor", type: "text", optional: false, description: "Vendor" }],
      },
    ],
    typeAliases: null,
    docs: null,
    documentationUpdate: null,
    projectNameUpdate: null,
    proposedActions: null,
    ...overrides,
  }
}

describe("pipeline assistant materialize", () => {
  it("llm-batch emits a list even when structureOut is the item name", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const proposal = materializeProposal(receiptMapRaw(), session.project!, DEFAULT_MODEL)
    expect(proposal).toBeTruthy()
    const batch = proposal!.modules.find((m) => m.kind === ModuleKind.LlmBatch)
    expect(batch).toBeTruthy()
    expect(stepEmitsList(batch)).toBe(true)
    const input = proposal!.modules.find((m) => m.kind === ModuleKind.Input)
    expect(input?.outStructureId).toBe(BUILTIN_DOCUMENT_ID)
    expect(stepEmitsList(input)).toBe(true)
    const errors = formatPipelineValidationErrors(
      proposal!.modules,
      proposal!.models,
      proposal!.typeAliases,
    )
    expect(errors).toBe("")
  })

  it("does not silently wire models[0] when a structure name is unknown", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const raw = receiptMapRaw()
    raw.modules = raw.modules!.map((m) =>
      m.kind === ModuleKind.LlmBatch ? { ...m, structureOut: "NopeModel" } : m,
    )
    const proposal = materializeProposal(raw, session.project!, DEFAULT_MODEL)
    expect(proposal).toBeTruthy()
    const batch = proposal!.modules.find((m) => m.kind === ModuleKind.LlmBatch)!
    const receiptId = proposal!.models.find((m) => m.name === "ReceiptRow")?.id
    expect(receiptId).toBeTruthy()
    expect(batch.outStructureId).not.toBe(receiptId)
    expect(batch.outStructureId).toBeUndefined()
  })

  it("context JSON writes list[] on custom-code emit and item name on llm-batch", () => {
    const ctx = loadProjectContext(resolve(SEEDS_DIR, "batch_llm_example.json"))
    const wrap = ctx.project.modules.find((m) => m.label.includes("Wrap"))
    const batch = ctx.project.modules.find((m) => m.kind === ModuleKind.LlmBatch)
    expect(structureOutForAssistant(wrap!, ctx.project.models)).toBe("list[TextChunk]")
    expect(structureOutForAssistant(batch!, ctx.project.models)).toBe("ChunkSummary")
  })
})
