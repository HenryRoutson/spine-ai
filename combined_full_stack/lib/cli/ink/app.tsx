// AI : Ink app — dispatches SpineSession methods (same names as useStore); no fetch in render.

import { useState } from "react"
import { useApp, useInput } from "ink"
import type { SpineSession } from "@/lib/core/session"
import { toPipelineView, toValidationView } from "@/lib/core/view"
import { addNamedModel } from "@/lib/cli/workspace_edits"
import { useSpineSnapshot } from "@/lib/cli/ink/use-session"
import { WorkspaceView, type TuiPrompt } from "@/lib/cli/ink/workspace-view"

export type SpineTuiProps = {
  session: SpineSession
  sessionPath?: string
  interactive?: boolean
}

export function spineTuiTree(props: SpineTuiProps) {
  return <SpineTui {...props} />
}

export function SpineTui({ session, sessionPath, interactive = true }: SpineTuiProps) {
  const snap = useSpineSnapshot(session)
  const { exit } = useApp()
  const [selectedId, setSelectedId] = useState(snap.activeProjectId)
  const [prompt, setPrompt] = useState<TuiPrompt>(null)

  const selectedProjectId = snap.projects.some((p) => p.id === selectedId)
    ? selectedId
    : (snap.activeProjectId || snap.projects[0]?.id || "")

  useInput(
    (input, key) => {
      if (!interactive) return
      if (prompt?.kind === "rename" || prompt?.kind === "model") {
        if (key.escape) {
          setPrompt(null)
          return
        }
        if (key.return) {
          const value = prompt.buffer.trim()
          if (prompt.kind === "rename" && value && selectedProjectId) session.renameProject(selectedProjectId, value)
          if (prompt.kind === "model" && value) addNamedModel(session, value)
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
      selectedProjectId={selectedProjectId}
      prompt={prompt}
      sessionPath={sessionPath}
    />
  )
}
