import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { FieldType, InputType, ModuleKind } from "@/lib/types"
import { createSpineSession } from "@/lib/core/session"
import { createRecordingEgress, createThrowingEgress } from "@/lib/core/transport"
import { askAgent } from "@/lib/cli/agent"
import { runSpineCli } from "@/lib/cli/run"
import { uid } from "@/lib/id"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type { StructureModel, StructureModelId } from "@/lib/types"

function findingProposal(): ProjectProposal {
  const model: StructureModel = {
    id: uid<StructureModelId>("m_"),
    name: "Finding",
    description: "",
    fields: [{ id: uid("f_"), name: "summary", type: FieldType.Text, optional: false, description: "" }],
  }
  return {
    modules: [
      {
        id: uid("mod_"),
        kind: ModuleKind.Input,
        label: "Input",
        note: "",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
        inputType: InputType.Text,
      },
      {
        id: uid("mod_"),
        kind: ModuleKind.Output,
        label: "Output",
        note: "",
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
        inStructureId: model.id,
        outStructureId: model.id,
      },
    ],
    models: [model],
    typeAliases: [],
    docs: [],
    documentation: "from agent",
    projectName: "Agent Pipeline",
    changed: {
      modules: true,
      models: true,
      typeAliases: false,
      docs: false,
      documentation: true,
      name: true,
    },
  }
}

describe("spine agent CLI", () => {
  it("ask --offline is blocked as remote", async () => {
    const session = createSpineSession({ egress: createThrowingEgress() })
    session.addProject({ open: true })
    const result = await askAgent(session, "Add a Finding structure")
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.message).toMatch(/offline/)
    expect(session.chat).toEqual([])
  })

  it("ask with a stub propose applies locally without LLM", async () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const proposal = findingProposal()
    const result = await askAgent(session, "Add a Finding structure", {
      apply: true,
      propose: async () => ({
        message: "I'll add Finding.",
        proposal: { ...proposal, docs: [] },
        invalidCount: 0,
        validationErrors: null,
        retryCount: 0,
        usageCents: 0,
        promptTokens: 0,
        completionTokens: 0,
      }),
    })
    expect(result.ok).toBe(true)
    expect(session.project?.name).toBe("Agent Pipeline")
    expect(session.project?.models.map((m) => m.name)).toEqual(["Finding"])
    expect(session.chat.map((t) => t.role)).toEqual(["user", "assistant"])
    expect(session.pendingProposal).toBeNull()
  })

  it("structure ask uses HTTP egress when the server responds", async () => {
    const proposal = findingProposal()
    const session = createSpineSession({
      egress: createRecordingEgress(async (url) => {
        expect(String(url)).toContain("/api/structure-assistant")
        return new Response(
          JSON.stringify({
            message: "Added Finding.",
            proposal: { models: proposal.models },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }),
    })
    session.addProject({ open: true })
    const result = await askAgent(session, "add Finding", { kind: "structure", apply: true })
    expect(result.ok).toBe(true)
    expect(session.project?.models.map((m) => m.name)).toEqual(["Finding"])
  })

  it("does not start a second vibe ask while one is in flight", async () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    session.setAssistantInFlight({
      projectId: session.activeProjectId,
      message: "Add a Finding structure",
      startedAt: Date.now(),
    })
    const result = await askAgent(session, "Add a Finding structure", {
      propose: async () => {
        throw new Error("should not run while in flight")
      },
    })
    expect(result.ok).toBe(true)
    expect(result.data?.inFlight).toBe(true)
    expect(session.chat).toEqual([])
  })

  it("CLI apply-file mutates the session like Vibe approve", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spine-agent-"))
    const sessionPath = join(dir, "session.json")
    const proposalPath = join(dir, "proposal.json")
    try {
      const created = await runSpineCli(["session", "add-project", "--session", sessionPath])
      expect(created.ok).toBe(true)
      writeFileSync(proposalPath, JSON.stringify(findingProposal()))
      const applied = await runSpineCli([
        "agent",
        "apply-file",
        "--file",
        proposalPath,
        "--session",
        sessionPath,
        "--offline",
      ])
      expect(applied.ok, JSON.stringify(applied.issues)).toBe(true)
      const listed = await runSpineCli(["session", "list", "--session", sessionPath])
      const summary = listed.data?.summary as { activeName: string }
      expect(summary.activeName).toBe("Agent Pipeline")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("CLI import-seed + mermaid + tests work without the network", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spine-seed-"))
    const sessionPath = join(dir, "session.json")
    try {
      const imported = await runSpineCli([
        "session",
        "import-seed",
        "--file",
        "batch_llm_example",
        "--session",
        sessionPath,
        "--offline",
      ])
      expect(imported.ok, JSON.stringify(imported.issues)).toBe(true)
      const mermaid = await runSpineCli(["session", "mermaid", "--session", sessionPath, "--offline"])
      expect(mermaid.ok).toBe(true)
      expect(String(mermaid.data?.mermaid)).toContain("flowchart")
      const stepped = await runSpineCli([
        "session",
        "add-step",
        "--kind",
        "llm",
        "--label",
        "Extract",
        "--session",
        sessionPath,
        "--offline",
      ])
      expect(stepped.ok, JSON.stringify(stepped.issues)).toBe(true)
      const tests = await runSpineCli(["session", "tests", "--session", sessionPath, "--offline"])
      expect(tests.command).toBe("session tests")
      expect(typeof tests.data?.testCount).toBe("number")
      const named = await runSpineCli([
        "session",
        "add-model",
        "--name",
        "Finding",
        "--session",
        sessionPath,
        "--offline",
      ])
      expect(named.ok, JSON.stringify(named.issues)).toBe(true)
      const field = await runSpineCli([
        "session",
        "add-field",
        "--model",
        "Finding",
        "--name",
        "title",
        "--type",
        "text",
        "--session",
        sessionPath,
        "--offline",
      ])
      expect(field.ok, JSON.stringify(field.issues)).toBe(true)
      const assigned = await runSpineCli([
        "session",
        "assign-structure",
        "--id",
        "Extract",
        "--model",
        "Finding",
        "--session",
        sessionPath,
        "--offline",
      ])
      expect(assigned.ok, JSON.stringify(assigned.issues)).toBe(true)
      const blocked = await runSpineCli(["session", "start-run", "--session", sessionPath, "--offline"])
      expect(blocked.ok).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
