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
})
