import { describe, expect, it } from "vitest"
import { renderToString } from "ink"
import { createSpineSession } from "@/lib/core/session"
import { addNamedModel } from "@/lib/cli/workspace_edits"
import { renderSpineTuiString, shouldLaunchInteractiveTui, runTuiCommand } from "@/lib/cli/ink/launch"
import { WorkspaceView } from "@/lib/cli/ink/workspace-view"
import { toAgentView, toDocsView, toLogsView, toPipelineView, toTestingView, toValidationView } from "@/lib/core/view"
import { runSpineCli } from "@/lib/cli/run"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DocLabel, InputType, ModuleKind, RunSource, RunStatus, RunStepStatus, RunTestStepStatus } from "@/lib/types"

describe("Ink TUI", () => {
  it("renderToString shows an empty workspace", () => {
    const session = createSpineSession()
    const frame = renderSpineTuiString(session, "memory")
    expect(frame).toContain("Spine")
    expect(frame).toContain("empty")
    expect(frame).toContain("Projects")
    expect(frame).toContain("1:structure")
    expect(frame).toContain("search commands")
    expect(frame).toContain("New project")
    expect(frame).toContain("create a project")
  })

  it("renders the same session mutations as the React store / session CLI", () => {
    const session = createSpineSession()
    const created = session.addProject({ open: true })
    session.renameProject(created.id, "Ink Pipeline")
    session.setDocumentation("Local TUI")
    addNamedModel(session, "Finding")
    const frame = renderSpineTuiString(session, "/tmp/demo.json")
    expect(frame).toContain("Ink Pipeline")
    expect(frame).toContain("Finding")
    expect(frame).toContain("Input")
    expect(frame).toContain("Output")
    expect(frame).toContain("Validation: ok")
    expect(frame).toContain("Local TUI")
  })

  it("WorkspaceView prompt is presentational", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const snap = session.getSnapshot()
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={toPipelineView(snap)}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="pipeline"
        selectedProjectId={snap.activeProjectId}
        prompt={{ kind: "rename", buffer: "New Name" }}
      />,
    )
    expect(frame).toContain("rename: New Name")
    expect(frame).toContain("enter to save")
  })

  it("command palette lists matching actions", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const snap = session.getSnapshot()
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={toPipelineView(snap)}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="pipeline"
        selectedProjectId={snap.activeProjectId}
        prompt={{ kind: "command", buffer: "model", selected: 0 }}
      />,
    )
    expect(frame).toContain("Add model")
    expect(frame).toContain("fixes Input / Output")
  })

  it("step prompt suggests llm from a prefix", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const snap = session.getSnapshot()
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={toPipelineView(snap)}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="pipeline"
        selectedProjectId={snap.activeProjectId}
        prompt={{ kind: "step", buffer: "ll", selected: 0 }}
      />,
    )
    expect(frame).toContain("add step: ll")
    expect(frame).toContain("llm")
    expect(frame).toContain("LLM Call")
  })

  it("shows Configure step and the selected step inspector", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const snap = session.getSnapshot()
    const pipeline = toPipelineView(snap)
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={pipeline}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="pipeline"
        selectedProjectId={snap.activeProjectId}
        prompt={null}
        pane="steps"
      />,
    )
    expect(frame).toContain("Configure step")
    expect(frame).toContain("Looking at:")
    expect(frame).toContain("press e")
  })

  it("pick-step lists pipeline steps to inspect", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const snap = session.getSnapshot()
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={toPipelineView(snap)}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="pipeline"
        selectedProjectId={snap.activeProjectId}
        prompt={{ kind: "pick-step", buffer: "", selected: 0 }}
      />,
    )
    expect(frame).toContain("look at step:")
    expect(frame).toContain("Input")
    expect(frame).toContain("Output")
  })

  it("tui --once goes through the CLI dispatcher without hanging", async () => {
    const dir = mkdtempSync(join(tmpdir(), "spine-tui-"))
    const sessionPath = join(dir, "session.json")
    try {
      await runSpineCli(["session", "add-project", "--session", sessionPath])
      await runSpineCli(["session", "rename", "--name", "From Tui", "--session", sessionPath])
      const result = await runSpineCli(["tui", "--once", "--session", sessionPath])
      expect(result.command).toBe("tui")
      expect(result.ok).toBe(true)
      expect(result.data?.interactive).toBe(false)
      expect(String(result.data?.human)).toContain("From Tui")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it("interactive TUI is skipped when stdout is not a TTY", () => {
    expect(shouldLaunchInteractiveTui({}, { isTTY: false })).toBe(false)
    expect(shouldLaunchInteractiveTui({ once: true }, { isTTY: true })).toBe(false)
    expect(shouldLaunchInteractiveTui({}, { isTTY: true })).toBe(true)
  })

  it("runTuiCommand --once returns a frame", async () => {
    const result = await runTuiCommand({ once: true })
    expect(result.ok).toBe(true)
    expect(String(result.data?.human)).toContain("Spine")
  })

  it("tui --once --tab agent shows the agent panel", async () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    session.appendChat({ role: "user", content: "Add a Finding structure" })
    session.appendChat({ role: "assistant", content: "I'll propose a Finding model." })
    const frame = renderSpineTuiString(session, "memory", { tab: "agent" })
    expect(frame).toContain("Vibe")
    expect(frame).toContain("Finding")
    expect(frame).toContain("vibe")
  })

  it("groups tabs by area and shows usability annotations", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const pipeline = renderSpineTuiString(session, "memory", { tab: "pipeline" })
    expect(pipeline).toContain("Build")
    expect(pipeline).toContain("1:structure")
    expect(pipeline).toContain("2:pipeline")
    expect(pipeline).toContain("Linear Pipeline")
    expect(pipeline).toContain("Each step declares its input and output model")
    expect(pipeline).toContain("annotation:")

    const logging = renderSpineTuiString(session, "memory", { tab: "logging" }).replace(/\s+/g, " ")
    expect(logging).toContain("Observe")
    expect(logging).toContain("7:logging")
    expect(logging).toContain("Run History")
    expect(logging).toContain("full per-step trace")
    expect(logging).toContain("press i to run inference")
  })

  it("logging tab inspects a run with cost, duration, and highlighted I/O", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    session.addRun({
      id: "run_inspect" as never,
      startedAt: Date.now() - 5_000,
      status: RunStatus.Ok,
      totalMs: 2400,
      billedCents: 1.2,
      savedCents: 0.3,
      model: "test-model",
      notes: "vendor total check",
      source: RunSource.App,
      steps: [
        {
          moduleId: "m1" as never,
          kind: ModuleKind.Llm,
          label: "Extract",
          status: RunStepStatus.Ok,
          ms: 2100,
          costCents: 1.2,
          inputPreview: "",
          outputPreview: "",
          outputJson: '{"vendor":"Acme","total":12.5}',
        },
      ],
    })
    const frame = renderSpineTuiString(session, "memory", { tab: "logs" })
    expect(frame).toContain("Extract")
    expect(frame).toContain("vendor total check")
    expect(frame).toContain("$0.012")
    expect(frame).toContain("2.4s")
    expect(frame).toContain("Looking at:")
    expect(frame).toContain("Acme")
    expect(frame).toContain("cache saved")
  })

  it("logging shows error traces in red-path copy", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    session.addRun({
      id: "run_err" as never,
      startedAt: Date.now(),
      status: RunStatus.Error,
      totalMs: 800,
      billedCents: 0,
      savedCents: 0,
      model: "test-model",
      source: RunSource.App,
      steps: [
        {
          moduleId: "m2" as never,
          kind: ModuleKind.Llm,
          label: "Extract",
          status: RunStepStatus.Error,
          ms: 800,
          costCents: 0,
          inputPreview: "",
          outputPreview: "schema failed: total",
        },
      ],
    })
    const logs = toLogsView(session.getSnapshot())
    expect(logs.errorCount).toBe(1)
    expect(logs.runs[0]?.hasErrors).toBe(true)
    expect(logs.runs[0]?.stepRows[0]?.error).toContain("schema failed")
    const frame = renderSpineTuiString(session, "memory", { tab: "logging" })
    expect(frame).toContain("schema failed")
    expect(frame).toContain("Extract")
  })

  it("testing tab shows pass/fail verdicts from logged runs", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    session.addDocContent({
      name: "test_1_testing.json",
      type: InputType.Text,
      label: DocLabel.Inference,
      content: '{"description":"x","inputs":{},"expectedOutputs":{}}',
    })
    session.addRun({
      id: "run_test" as never,
      startedAt: Date.now(),
      status: RunStatus.Ok,
      totalMs: 100,
      billedCents: 0,
      savedCents: 0,
      model: "test-model",
      source: RunSource.Testing,
      test: {
        testDocName: "test_1_testing.json",
        results: [{ label: "Output", status: RunTestStepStatus.Fail, diffPath: "total" }],
      },
      steps: [],
    })
    const frame = renderSpineTuiString(session, "memory", { tab: "testing" })
    expect(frame).toContain("Pipeline Tests")
    expect(frame).toContain("test_1_testing.json")
    expect(frame).toContain("fail")
    expect(frame).toContain("press t")
  })

  it("inference tab lists input slots by step label", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const doc = session.addDocContent({
      name: "receipt.txt",
      type: InputType.Text,
      label: DocLabel.Inference,
      content: "Acme $12",
    })
    const input = session.modules.find((m) => m.kind === ModuleKind.Input)
    if (input) session.setInferenceInputDocIds({ [input.id]: doc.id })
    const frame = renderSpineTuiString(session, "memory", { tab: "inference" })
    expect(frame).toContain("Run Pipeline")
    expect(frame).toContain("Input")
    expect(frame).toContain("receipt.txt")
    expect(frame).toContain("Logging")
  })

  it("command palette includes run inference and logging filter", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const snap = session.getSnapshot()
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={toPipelineView(snap)}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="logging"
        selectedProjectId={snap.activeProjectId}
        prompt={{ kind: "command", buffer: "run", selected: 0 }}
      />,
    )
    expect(frame).toContain("Run inference")
    expect(frame).toContain("appears in Logging")
  })

  it("pick-run lists runs to inspect", () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    session.addRun({
      id: "run_pick" as never,
      startedAt: Date.now(),
      status: RunStatus.Ok,
      totalMs: 50,
      billedCents: 0,
      savedCents: 0,
      model: "test-model",
      steps: [],
    })
    const snap = session.getSnapshot()
    const frame = renderToString(
      <WorkspaceView
        snap={snap}
        pipeline={toPipelineView(snap)}
        validation={toValidationView(snap)}
        docs={toDocsView(snap)}
        testing={toTestingView(snap)}
        agent={toAgentView(snap)}
        logs={toLogsView(snap)}
        tab="logging"
        selectedProjectId={snap.activeProjectId}
        prompt={{ kind: "pick-run", buffer: "", selected: 0 }}
      />,
    )
    expect(frame).toContain("look at run:")
    expect(frame).toContain("ok")
  })
})
