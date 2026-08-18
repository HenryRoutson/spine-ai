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
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"

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

  it("does not auto-insert a third Document input when two inputs already exist", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const raw = receiptMapRaw()
    raw.models = [
      {
        name: "Resume",
        description: "Extracted resume.",
        fields: [{ name: "name", type: "text", optional: false, description: "Name" }],
      },
      {
        name: "JobDescription",
        description: "Parsed job.",
        fields: [{ name: "required_skills", type: "list[text]", optional: false, description: "Skills" }],
      },
      {
        name: "ResumeBatch",
        description: "Merged.",
        fields: [
          { name: "resumes", type: "list[model]", optional: false, description: "Resumes", ref: "Resume" },
          { name: "job_desc", type: "model", optional: false, description: "Job", ref: "JobDescription" },
        ],
      },
    ]
    raw.modules = [
      {
        kind: ModuleKind.Input,
        label: "Resume Uploads",
        note: "Many resumes.",
        structureOut: "list[Document]",
        inputType: "text",
        inputDescription: "resumes",
      },
      {
        kind: ModuleKind.LlmBatch,
        label: "Extract Resume Fields",
        note: "One Resume per file.",
        structureIn: "Document",
        structureOut: "Resume",
        prompt: "Extract name.",
        inputDescription: "docs",
      },
      {
        kind: ModuleKind.Input,
        label: "Job Description",
        note: "One job posting.",
        structureOut: "Document",
        inputType: "text",
        inputDescription: "job",
      },
      {
        kind: ModuleKind.Llm,
        label: "Parse Job Requirements",
        note: "Parse required skills.",
        structureIn: "Document",
        structureOut: "JobDescription",
        prompt: "List skills.",
        inputDescription: "job doc",
      },
      {
        kind: ModuleKind.Combine,
        label: "Combine Inputs",
        note: "Merge resumes with job.",
        structureIn: "Resume",
        structureOut: "ResumeBatch",
        inputDescription: "merged",
      },
      {
        kind: ModuleKind.Output,
        label: "Out",
        structureIn: "ResumeBatch",
        structureOut: "ResumeBatch",
        inputDescription: "out",
      },
    ]
    const proposal = materializeProposal(raw, session.project!, DEFAULT_MODEL)
    expect(proposal).toBeTruthy()
    const inputs = proposal!.modules.filter((m) => m.kind === ModuleKind.Input)
    expect(inputs.map((m) => m.label)).toEqual(["Resume Uploads", "Job Description"])
    expect(proposal!.modules.some((m) => m.label === "Combine Inputs Document")).toBe(false)
  })

  it("assemble after two parses is valid even if structureIn is leftover Resume", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const raw = receiptMapRaw()
    raw.models = [
      {
        name: "Resume",
        description: "Extracted resume.",
        fields: [{ name: "name", type: "tuple[text,quote]", optional: false, description: "Name" }],
      },
      {
        name: "JobDescription",
        description: "Parsed job.",
        fields: [{ name: "required_skills", type: "list[text]", optional: false, description: "Skills" }],
      },
      {
        name: "ResumeBatch",
        description: "Merged.",
        fields: [
          { name: "resumes", type: "list[model]", optional: false, description: "Resumes", ref: "Resume" },
          { name: "job_desc", type: "model", optional: false, description: "Job", ref: "JobDescription" },
        ],
      },
    ]
    raw.modules = [
      {
        kind: ModuleKind.Input,
        label: "Resume Uploads",
        note: "Many resumes.",
        structureOut: "list[Document]",
        inputType: "text",
        inputDescription: "resumes",
      },
      {
        kind: ModuleKind.LlmBatch,
        label: "Extract Resume Fields",
        note: "One Resume per Document. Link Quotes is auto-inserted.",
        structureIn: "Document",
        structureOut: "Resume",
        prompt: "Extract name.",
        inputDescription: "docs",
      },
      {
        kind: ModuleKind.Input,
        label: "Job Description",
        note: "One job posting.",
        structureOut: "Document",
        inputType: "text",
        inputDescription: "job",
      },
      {
        kind: ModuleKind.Llm,
        label: "Parse Job Requirements",
        note: "Parse required skills.",
        structureIn: "Document",
        structureOut: "JobDescription",
        prompt: "List skills.",
        inputDescription: "job doc",
      },
      {
        kind: ModuleKind.Assemble,
        label: "Join Resume and Job",
        note: "Zip quoted resumes with parsed job.",
        structureIn: "Resume",
        structureOut: "ResumeBatch",
        assembleBindings: {
          resumes: { kind: "state", label: "Extract Resume Fields" },
          job_desc: { kind: "spine" },
        },
        inputDescription: "job on spine plus resumes in state",
      },
      {
        kind: ModuleKind.Output,
        label: "Out",
        structureIn: "ResumeBatch",
        structureOut: "ResumeBatch",
        inputDescription: "out",
      },
    ]
    const proposal = materializeProposal(raw, session.project!, DEFAULT_MODEL)
    expect(proposal).toBeTruthy()
    expect(proposal!.modules.filter((m) => m.kind === ModuleKind.Input).map((m) => m.label)).toEqual([
      "Resume Uploads",
      "Job Description",
    ])
    const assemble = proposal!.modules.find((m) => m.kind === ModuleKind.Assemble)!
    const jobId = proposal!.models.find((m) => m.name === "JobDescription")?.id
    expect(assemble.inStructureId).toBe(jobId)
    expect(assemble.assembleBindings?.resumes).toEqual({ kind: "state", label: "Link Quotes" })
    expect(formatPipelineValidationErrors(proposal!.modules, proposal!.models, proposal!.typeAliases)).toBe("")

    const resumeId = proposal!.models.find((m) => m.name === "Resume")?.id
    const leftover = proposal!.modules.map((m) =>
      m.kind === ModuleKind.Assemble ? { ...m, inStructureId: resumeId } : m,
    )
    expect(formatPipelineValidationErrors(leftover, proposal!.models, proposal!.typeAliases)).toBe("")
  })

  it("flags combine output with no side-document field", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const raw = receiptMapRaw()
    raw.models = [
      {
        name: "Resume",
        description: "Extracted resume.",
        fields: [{ name: "name", type: "text", optional: false, description: "Name" }],
      },
      {
        name: "ResumeBatch",
        description: "Merged.",
        fields: [
          { name: "resumes", type: "list[model]", optional: false, description: "Resumes", ref: "Resume" },
          { name: "job_desc", type: "model", optional: false, description: "Job", ref: "Resume" },
        ],
      },
    ]
    raw.modules = [
      {
        kind: ModuleKind.Input,
        label: "Resume Uploads",
        note: "Many resumes.",
        structureOut: "list[Document]",
        inputType: "text",
        inputDescription: "resumes",
      },
      {
        kind: ModuleKind.LlmBatch,
        label: "Extract Resume Fields",
        note: "One Resume per file.",
        structureIn: "Document",
        structureOut: "Resume",
        prompt: "Extract name.",
        inputDescription: "docs",
      },
      {
        kind: ModuleKind.Combine,
        label: "Combine Inputs",
        note: "Merge with a side document.",
        structureIn: "Resume",
        structureOut: "ResumeBatch",
        inputDescription: "merged",
      },
      {
        kind: ModuleKind.Output,
        label: "Out",
        structureIn: "ResumeBatch",
        structureOut: "ResumeBatch",
        inputDescription: "out",
      },
    ]
    const proposal = materializeProposal(raw, session.project!, DEFAULT_MODEL)
    expect(proposal).toBeTruthy()
    expect(proposal!.modules.some((m) => m.kind === ModuleKind.Input && m.label === "Combine Inputs Document")).toBe(
      true,
    )
    const errors = formatPipelineValidationErrors(
      proposal!.modules,
      proposal!.models,
      proposal!.typeAliases,
    )
    expect(errors).toMatch(/no field for the side input/)
  })
})

describe("combine seeds", () => {
  it("expense auditor combine still has a document side field", () => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, "expense_auditor.json"))
    const errors = formatPipelineValidationErrors(
      project.modules,
      project.models,
      project.typeAliases ?? [],
    )
    expect(errors).not.toMatch(/no field for the side input/)
  })
})
