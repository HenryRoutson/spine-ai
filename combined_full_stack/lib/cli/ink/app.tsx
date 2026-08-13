// AI : Ink app — dispatches SpineSession methods (same names as useStore); no fetch in render.

import { useState } from "react"
import { useApp, useInput } from "ink"
import type { SpineSession } from "@/lib/core/session"
import {
  TUI_TABS,
  resolveTuiTab,
  toAgentView,
  toDocsView,
  toLogsView,
  toPipelineView,
  toTestingView,
  toValidationView,
  type TuiTab,
} from "@/lib/core/view"
import { addNamedModel, addPipelineStep, assignStepStructure, patchStep, removeStep } from "@/lib/cli/workspace_edits"
import { useSpineSnapshot } from "@/lib/cli/ink/use-session"
import { WorkspaceView } from "@/lib/cli/ink/workspace-view"
import {
  commandAvailable,
  resolveSelectedStepId,
  selectedIndex,
  suggestAgentPrompts,
  suggestCommands,
  suggestModelAssign,
  suggestModelNames,
  suggestPipelineSteps,
  suggestStepEdits,
  suggestStepKinds,
  tabFromCommandId,
  wrapIndex,
  type TuiCommandId,
  type TuiPane,
  type TuiPrompt,
} from "@/lib/cli/ink/commands"

export type SpineTuiProps = {
  session: SpineSession
  sessionPath?: string
  interactive?: boolean
  initialTab?: TuiTab
}

export function spineTuiTree(props: SpineTuiProps) {
  return <SpineTui {...props} />
}

function parseTabKey(input: string): TuiTab | undefined {
  if (input === "0") return TUI_TABS[9]
  const n = Number(input)
  if (n >= 1 && n <= 9) return TUI_TABS[n - 1]
  return undefined
}

function pickDigit(input: string): number | undefined {
  if (input.length === 1 && input >= "1" && input <= "9") return Number(input) - 1
  return undefined
}

export function SpineTui({ session, sessionPath, interactive = true, initialTab = "pipeline" }: SpineTuiProps) {
  const snap = useSpineSnapshot(session)
  const { exit } = useApp()
  const [selectedId, setSelectedId] = useState(snap.activeProjectId)
  const [prompt, setPrompt] = useState<TuiPrompt>(null)
  const [tab, setTab] = useState<TuiTab>(resolveTuiTab(initialTab))
  const [agentBusy, setAgentBusy] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState("")
  const [pane, setPane] = useState<TuiPane>("steps")
  const validation = toValidationView(snap)
  const pipeline = toPipelineView(snap)
  const stepId = resolveSelectedStepId(pipeline, selectedStepId)
  const ctx = {
    hasProject: snap.projects.length > 0,
    hasProposal: snap.pendingProposal != null,
    hasSteps: (pipeline?.steps.length ?? 0) > 0,
  }
  const stepPane = tab === "pipeline" && pane === "steps"

  const selectedProjectId = snap.projects.some((p) => p.id === selectedId)
    ? selectedId
    : (snap.activeProjectId || snap.projects[0]?.id || "")

  function askVibe(message: string) {
    const value = message.trim()
    if (!value) return
    setTab("vibe")
    setAgentBusy(true)
    void (async () => {
      try {
        const { askAgent } = await import("@/lib/cli/agent")
        await askAgent(session, value)
      } finally {
        setAgentBusy(false)
      }
    })()
  }

  function runCommand(id: TuiCommandId) {
    const nextTab = tabFromCommandId(id)
    if (nextTab) {
      setTab(nextTab)
      setPrompt(null)
      return
    }
    if (id === "new-project") {
      const created = session.addProject({ open: true })
      setSelectedId(created.id)
      setPrompt(null)
      return
    }
    if (id === "rename") {
      if (!selectedProjectId) return
      setPrompt({ kind: "rename", buffer: snap.projects.find((p) => p.id === selectedProjectId)?.name ?? "" })
      return
    }
    if (id === "add-model") {
      setPrompt({ kind: "model", buffer: "", selected: 0 })
      return
    }
    if (id === "add-step") {
      setPrompt({ kind: "step", buffer: "", selected: 0 })
      return
    }
    if (id === "configure-step") {
      setTab("pipeline")
      setPane("steps")
      const hits = suggestPipelineSteps("", pipeline)
      const idx = Math.max(0, hits.findIndex((s) => s.id === stepId))
      setPrompt({ kind: "pick-step", buffer: "", selected: idx })
      return
    }
    if (id === "vibe") {
      setTab("vibe")
      setPrompt({ kind: "agent", buffer: "", selected: 0 })
      return
    }
    if (id === "apply") {
      if (session.pendingProposal) session.applyPendingProposal()
      setPrompt(null)
      return
    }
    if (id === "reject") {
      if (session.pendingProposal) session.rejectPendingProposal()
      setPrompt(null)
      return
    }
    if (id === "delete") {
      if (!selectedProjectId) return
      setPrompt({ kind: "delete", name: snap.projects.find((p) => p.id === selectedProjectId)?.name ?? selectedProjectId })
      return
    }
    if (id === "quit") exit()
  }

  function suggestionLen(current: TuiPrompt): number {
    if (current?.kind === "command") return suggestCommands(current.buffer, ctx).length
    if (current?.kind === "step") return suggestStepKinds(current.buffer).length
    if (current?.kind === "pick-step") return suggestPipelineSteps(current.buffer, pipeline).length
    if (current?.kind === "edit-step") {
      const module = session.modules.find((m) => m.id === current.stepId)
      const step = pipeline?.steps.find((s) => s.id === current.stepId)
      return suggestStepEdits(current.buffer, {
        kind: module?.kind ?? "",
        label: module?.label ?? "",
        prompt: module?.prompt,
        note: module?.note,
        modelName: session.models.find((m) => m.id === module?.outStructureId || m.id === module?.inStructureId)?.name,
        invalid: step?.invalid ?? [],
        modelCount: session.models.length,
      }).length
    }
    if (current?.kind === "step-field" && current.field === "structure") {
      return suggestModelAssign(current.buffer, session.models.map((m) => m.name)).length
    }
    if (current?.kind === "agent") return suggestAgentPrompts(current.buffer, validation).length
    if (current?.kind === "model") return suggestModelNames(current.buffer).length
    return 0
  }

  function openEditStep(id: string) {
    setSelectedStepId(id)
    setTab("pipeline")
    setPane("steps")
    setPrompt({ kind: "edit-step", stepId: id, buffer: "", selected: 0 })
  }

  function cycleStep(delta: number) {
    const steps = pipeline?.steps ?? []
    if (!steps.length) return
    const idx = Math.max(0, steps.findIndex((s) => s.id === stepId))
    const next = steps[wrapIndex(idx, steps.length, delta)]
    if (next) setSelectedStepId(next.id)
  }

  function commitPrompt(current: TuiPrompt, index?: number) {
    if (!current) return
    if (current.kind === "rename") {
      const value = current.buffer.trim()
      if (value && selectedProjectId) session.renameProject(selectedProjectId, value)
      setPrompt(null)
      return
    }
    if (current.kind === "model") {
      const hits = suggestModelNames(current.buffer)
      const value = current.buffer.trim() || hits[index ?? selectedIndex(current, hits.length)]
      if (value) addNamedModel(session, value)
      setPrompt(null)
      return
    }
    if (current.kind === "step") {
      const hits = suggestStepKinds(current.buffer)
      const picked = hits[index ?? selectedIndex(current, hits.length)]
      if (!picked) return
      addPipelineStep(session, picked.kind)
      setPrompt(null)
      return
    }
    if (current.kind === "agent") {
      const hits = suggestAgentPrompts(current.buffer, validation)
      const value = current.buffer.trim() || hits[index ?? selectedIndex(current, hits.length)]
      if (value) askVibe(value)
      setPrompt(null)
      return
    }
    if (current.kind === "pick-step") {
      const hits = suggestPipelineSteps(current.buffer, pipeline)
      const picked = hits[index ?? selectedIndex(current, hits.length)]
      if (!picked) return
      openEditStep(picked.id)
      return
    }
    if (current.kind === "edit-step") {
      const module = session.modules.find((m) => m.id === current.stepId)
      const step = pipeline?.steps.find((s) => s.id === current.stepId)
      const hits = suggestStepEdits(current.buffer, {
        kind: module?.kind ?? "",
        label: module?.label ?? "",
        prompt: module?.prompt,
        note: module?.note,
        modelName: session.models.find((m) => m.id === module?.outStructureId || m.id === module?.inStructureId)?.name,
        invalid: step?.invalid ?? [],
        modelCount: session.models.length,
      })
      const action = hits[index ?? selectedIndex(current, hits.length)]
      if (!action) return
      if (action.id === "remove") {
        removeStep(session, current.stepId)
        setPrompt(null)
        return
      }
      if (action.id === "structure" && session.models.length === 0) {
        setPrompt({ kind: "model", buffer: "", selected: 0 })
        return
      }
      const seed =
        action.id === "label" ? (module?.label ?? "") : action.id === "prompt" ? (module?.prompt ?? "") : action.id === "note" ? (module?.note ?? "") : ""
      setPrompt({ kind: "step-field", stepId: current.stepId, field: action.id, buffer: seed, selected: 0 })
      return
    }
    if (current.kind === "step-field") {
      if (current.field === "structure") {
        const hits = suggestModelAssign(current.buffer, session.models.map((m) => m.name))
        const value = current.buffer.trim() || hits[index ?? selectedIndex(current, hits.length)]
        if (value) assignStepStructure(session, current.stepId, value)
        setPrompt(null)
        return
      }
      const value = current.buffer.trim()
      if (current.field === "label" && value) patchStep(session, current.stepId, { label: value })
      if (current.field === "prompt") patchStep(session, current.stepId, { prompt: value })
      if (current.field === "note") patchStep(session, current.stepId, { note: value })
      setPrompt(null)
      return
    }
    if (current.kind === "command") {
      const hits = suggestCommands(current.buffer, ctx)
      const cmd = hits[index ?? selectedIndex(current, hits.length)]
      if (!cmd || !commandAvailable(cmd, ctx)) return
      runCommand(cmd.id)
    }
  }

  useInput(
    (input, key) => {
      if (!interactive) return
      if (prompt?.kind === "delete") {
        if (input === "y" && selectedProjectId) session.deleteProject(selectedProjectId)
        setPrompt(null)
        return
      }
      if (prompt) {
        if (key.escape) {
          setPrompt(null)
          return
        }
        const len = suggestionLen(prompt)
        if (key.upArrow || (key.tab && key.shift)) {
          setPrompt({ ...prompt, selected: wrapIndex(selectedIndex(prompt, len), len, -1) })
          return
        }
        if (key.downArrow || key.tab) {
          if ((prompt.kind === "model" || prompt.kind === "agent") && key.tab && !key.shift) {
            const fill =
              prompt.kind === "model"
                ? suggestModelNames(prompt.buffer)[selectedIndex(prompt, len)]
                : suggestAgentPrompts(prompt.buffer, validation)[selectedIndex(prompt, len)]
            if (fill) setPrompt({ ...prompt, buffer: fill, selected: 0 })
            return
          }
          setPrompt({ ...prompt, selected: wrapIndex(selectedIndex(prompt, len), len, 1) })
          return
        }
        if (key.return) {
          commitPrompt(prompt)
          return
        }
        const digit = prompt.kind === "rename" ? undefined : pickDigit(input)
        if (digit !== undefined && digit < len) {
          commitPrompt(prompt, digit)
          return
        }
        if (key.backspace || key.delete) {
          setPrompt({ ...prompt, buffer: prompt.buffer.slice(0, -1), selected: 0 })
          return
        }
        if (input && !key.ctrl && !key.meta) {
          setPrompt({ ...prompt, buffer: prompt.buffer + input, selected: 0 })
        }
        return
      }
      if (input === "/" || input === "?") {
        setPrompt({ kind: "command", buffer: "", selected: 0 })
        return
      }
      if (input === "q" || key.escape) {
        exit()
        return
      }
      if (key.tab && tab === "pipeline") {
        setPane((p) => (p === "steps" ? "projects" : "steps"))
        return
      }
      const nextTab = parseTabKey(input)
      if (nextTab) {
        setTab(nextTab)
        if (nextTab !== "pipeline") setPane("projects")
        else setPane("steps")
        return
      }
      if (input === "]") {
        setTab(TUI_TABS[(TUI_TABS.indexOf(tab) + 1) % TUI_TABS.length]!)
        return
      }
      if (input === "[") {
        setTab(TUI_TABS[(TUI_TABS.indexOf(tab) + TUI_TABS.length - 1) % TUI_TABS.length]!)
        return
      }
      if (input === "n") {
        runCommand("new-project")
        return
      }
      if (input === "e") {
        runCommand("configure-step")
        return
      }
      if (input === "j") {
        cycleStep(1)
        return
      }
      if (input === "k") {
        cycleStep(-1)
        return
      }
      if (key.upArrow || key.downArrow) {
        if (stepPane && (pipeline?.steps.length ?? 0) > 0) {
          cycleStep(key.downArrow ? 1 : -1)
          return
        }
        if (!snap.projects.length) return
        const idx = Math.max(0, snap.projects.findIndex((p) => p.id === selectedProjectId))
        const next = snap.projects[(idx + (key.downArrow ? 1 : snap.projects.length - 1)) % snap.projects.length]
        if (!next) return
        setSelectedId(next.id)
        session.openProject(next.id)
        return
      }
      if (key.return) {
        if (stepPane && stepId) {
          openEditStep(stepId)
          return
        }
        if (selectedProjectId) session.openProject(selectedProjectId)
        return
      }
      if (input === "r") runCommand("rename")
      else if (input === "m") runCommand("add-model")
      else if (input === "s") runCommand("add-step")
      else if (input === "a") runCommand("vibe")
      else if (input === "y") runCommand("apply")
      else if (input === "d") runCommand("reject")
      else if (input === "x") runCommand("delete")
    },
    { isActive: interactive },
  )

  return (
    <WorkspaceView
      snap={snap}
      pipeline={pipeline}
      validation={validation}
      docs={toDocsView(snap)}
      testing={toTestingView(snap)}
      agent={toAgentView(snap)}
      logs={toLogsView(snap)}
      tab={tab}
      selectedProjectId={selectedProjectId}
      prompt={prompt}
      sessionPath={sessionPath}
      agentBusy={agentBusy}
      selectedStepId={stepId}
      pane={stepPane ? "steps" : "projects"}
    />
  )
}
