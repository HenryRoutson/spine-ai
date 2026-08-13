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
import { addNamedModel, addPipelineStep, parseAddableKind } from "@/lib/cli/workspace_edits"
import { useSpineSnapshot } from "@/lib/cli/ink/use-session"
import { WorkspaceView, type TuiPrompt } from "@/lib/cli/ink/workspace-view"

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

export function SpineTui({ session, sessionPath, interactive = true, initialTab = "pipeline" }: SpineTuiProps) {
  const snap = useSpineSnapshot(session)
  const { exit } = useApp()
  const [selectedId, setSelectedId] = useState(snap.activeProjectId)
  const [prompt, setPrompt] = useState<TuiPrompt>(null)
  const [tab, setTab] = useState<TuiTab>(resolveTuiTab(initialTab))
  const [agentBusy, setAgentBusy] = useState(false)

  const selectedProjectId = snap.projects.some((p) => p.id === selectedId)
    ? selectedId
    : (snap.activeProjectId || snap.projects[0]?.id || "")

  useInput(
    (input, key) => {
      if (!interactive) return
      if (prompt?.kind === "rename" || prompt?.kind === "model" || prompt?.kind === "agent" || prompt?.kind === "step") {
        if (key.escape) {
          setPrompt(null)
          return
        }
        if (key.return) {
          const value = prompt.buffer.trim()
          if (prompt.kind === "rename" && value && selectedProjectId) session.renameProject(selectedProjectId, value)
          if (prompt.kind === "model" && value) addNamedModel(session, value)
          if (prompt.kind === "step" && value) {
            const kind = parseAddableKind(value)
            if (kind) addPipelineStep(session, kind)
          }
          if (prompt.kind === "agent" && value) {
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
          setPrompt(null)
          return
        }
        if (key.backspace || key.delete) {
          setPrompt({ ...prompt, buffer: prompt.buffer.slice(0, -1) })
          return
        }
        if (input && !key.ctrl && !key.meta) {
          setPrompt({ ...prompt, buffer: prompt.buffer + input })
        }
        return
      }
      if (prompt?.kind === "delete") {
        if (input === "y" && selectedProjectId) session.deleteProject(selectedProjectId)
        setPrompt(null)
        return
      }
      if (input === "q" || key.escape) {
        exit()
        return
      }
      const nextTab = parseTabKey(input)
      if (nextTab) {
        setTab(nextTab)
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
        const created = session.addProject({ open: true })
        setSelectedId(created.id)
        return
      }
      if (key.upArrow || key.downArrow) {
        if (!snap.projects.length) return
        const idx = Math.max(0, snap.projects.findIndex((p) => p.id === selectedProjectId))
        const next = snap.projects[(idx + (key.downArrow ? 1 : snap.projects.length - 1)) % snap.projects.length]
        if (!next) return
        setSelectedId(next.id)
        session.openProject(next.id)
        return
      }
      if (key.return && selectedProjectId) {
        session.openProject(selectedProjectId)
        return
      }
      if (input === "r" && selectedProjectId) {
        const name = snap.projects.find((p) => p.id === selectedProjectId)?.name ?? ""
        setPrompt({ kind: "rename", buffer: name })
        return
      }
      if (input === "m") {
        setPrompt({ kind: "model", buffer: "" })
        return
      }
      if (input === "s") {
        setPrompt({ kind: "step", buffer: "" })
        return
      }
      if (input === "a") {
        setTab("vibe")
        setPrompt({ kind: "agent", buffer: "" })
        return
      }
      if (input === "y" && session.pendingProposal) {
        session.applyPendingProposal()
        return
      }
      if (input === "d" && session.pendingProposal) {
        session.rejectPendingProposal()
        return
      }
      if (input === "x" && selectedProjectId) {
        const name = snap.projects.find((p) => p.id === selectedProjectId)?.name ?? selectedProjectId
        setPrompt({ kind: "delete", name })
      }
    },
    { isActive: interactive },
  )

  return (
    <WorkspaceView
      snap={snap}
      pipeline={toPipelineView(snap)}
      validation={toValidationView(snap)}
      docs={toDocsView(snap)}
      testing={toTestingView(snap)}
      agent={toAgentView(snap)}
      logs={toLogsView(snap)}
      tab={tab}
      selectedProjectId={selectedProjectId}
      prompt={prompt}
      sessionPath={sessionPath}
      agentBusy={agentBusy}
    />
  )
}
