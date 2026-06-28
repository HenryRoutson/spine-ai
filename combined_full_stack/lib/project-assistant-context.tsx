"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import type { ProjectProposal } from "@/lib/project-assistant-types"

type ProjectAssistantSession = {
  messages: AssistantChatMessage<ProjectProposal>[]
  setMessages: React.Dispatch<React.SetStateAction<AssistantChatMessage<ProjectProposal>[]>>
}

type ProjectAssistantContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  getSession: (projectId: string, initialMessage: string) => ProjectAssistantSession
}

const ProjectAssistantContext = createContext<ProjectAssistantContextValue | null>(null)

function welcomeMessage(
  projectId: string,
  initialMessage: string,
): AssistantChatMessage<ProjectProposal> {
  return { id: `${projectId}-welcome`, role: "assistant", content: initialMessage }
}

export function ProjectAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [sessions, setSessions] = useState<
    Record<string, AssistantChatMessage<ProjectProposal>[]>
  >({})
  // AI : stable welcome rows until the user sends — avoids new [] each render before first setMessages
  const welcomeByProject = useRef(new Map<string, AssistantChatMessage<ProjectProposal>[]>())

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const getSession = useCallback(
    (projectId: string, initialMessage: string): ProjectAssistantSession => {
      const setMessages: ProjectAssistantSession["setMessages"] = (updater) => {
        setSessions((prev) => {
          const current =
            prev[projectId] ??
            welcomeByProject.current.get(projectId) ?? [welcomeMessage(projectId, initialMessage)]
          const next = typeof updater === "function" ? updater(current) : updater
          return { ...prev, [projectId]: next }
        })
      }
      const messages =
        sessions[projectId] ??
        welcomeByProject.current.get(projectId) ??
        (() => {
          const row = [welcomeMessage(projectId, initialMessage)]
          welcomeByProject.current.set(projectId, row)
          return row
        })()
      return { messages, setMessages }
    },
    [sessions],
  )

  const value = useMemo(
    () => ({ open, setOpen, toggle, getSession }),
    [open, getSession, toggle],
  )

  return (
    <ProjectAssistantContext.Provider value={value}>{children}</ProjectAssistantContext.Provider>
  )
}

export function useProjectAssistant() {
  const ctx = useContext(ProjectAssistantContext)
  if (!ctx) throw new Error("useProjectAssistant must be used within ProjectAssistantProvider")
  return ctx
}
