"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { AssistantChatMessage } from "@/components/assistant-chat"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS, apiJson } from "@/lib/api-client"
import type { ProjectProposal } from "@/lib/project-assistant-types"

export type AssistantChatSummary = {
  id: string
  projectId: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

type ProjectAssistantSession = {
  messages: AssistantChatMessage<ProjectProposal>[]
  setMessages: React.Dispatch<React.SetStateAction<AssistantChatMessage<ProjectProposal>[]>>
  chats: AssistantChatSummary[]
  activeChatId: string | null
  chatsLoading: boolean
  selectChat: (chatId: string) => void
  newChat: () => void
  deleteChat: (chatId: string) => Promise<void>
}

type ProjectAssistantContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  ensureProjectChats: (projectId: string, initialMessage: string) => Promise<void>
  getSession: (projectId: string, initialMessage: string) => ProjectAssistantSession
}

const ProjectAssistantContext = createContext<ProjectAssistantContextValue | null>(null)

function welcomeMessage(
  projectId: string,
  initialMessage: string,
): AssistantChatMessage<ProjectProposal> {
  return { id: `${projectId}-welcome`, role: "assistant", content: initialMessage }
}

function defaultMessages(
  projectId: string,
  initialMessage: string,
): AssistantChatMessage<ProjectProposal>[] {
  return [welcomeMessage(projectId, initialMessage)]
}

function formatChatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export { formatChatDate }

export function ProjectAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [messagesByChat, setMessagesByChat] = useState<
    Record<string, AssistantChatMessage<ProjectProposal>[]>
  >({})
  const [chatsByProject, setChatsByProject] = useState<Record<string, AssistantChatSummary[]>>({})
  const [activeChatByProject, setActiveChatByProject] = useState<Record<string, string>>({})
  const [loadingByProject, setLoadingByProject] = useState<Record<string, boolean>>({})
  const loadStarted = useRef(new Set<string>())
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const initialMessageByProject = useRef(new Map<string, string>())
  const activeChatByProjectRef = useRef(activeChatByProject)
  activeChatByProjectRef.current = activeChatByProject

  const toggle = useCallback(() => setOpen((v) => !v), [])

  const persistMessages = useCallback(
    (chatId: string, messages: AssistantChatMessage<ProjectProposal>[]) => {
      const prev = saveTimers.current.get(chatId)
      if (prev) clearTimeout(prev)
      saveTimers.current.set(
        chatId,
        setTimeout(() => {
          saveTimers.current.delete(chatId)
          void apiJson(API_ROUTES.assistantChat(chatId), {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify({ messages }),
          }).catch(() => {})
        }, 600),
      )
    },
    [],
  )

  const ensureProjectChats = useCallback(
    async (projectId: string, initialMessage: string) => {
      if (loadStarted.current.has(projectId)) return
      loadStarted.current.add(projectId)
      initialMessageByProject.current.set(projectId, initialMessage)
      setLoadingByProject((prev) => ({ ...prev, [projectId]: true }))
      try {
        const { chats } = await apiJson<{ chats: AssistantChatSummary[] }>(
          `${API_ROUTES.assistantChats}?projectId=${encodeURIComponent(projectId)}`,
        )
        let nextChats = chats
        let activeId = chats[0]?.id

        if (!activeId) {
          const welcome = defaultMessages(projectId, initialMessage)
          const { chat } = await apiJson<{ chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] } }>(
            API_ROUTES.assistantChats,
            {
              method: "POST",
              headers: JSON_HEADERS,
              body: JSON.stringify({ projectId, messages: welcome }),
            },
          )
          nextChats = [chat]
          activeId = chat.id
          setMessagesByChat((prev) => ({ ...prev, [chat.id]: chat.messages?.length ? chat.messages : welcome }))
        } else {
          const top = chats[0]
          const { chat } = await apiJson<{
            chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] }
          }>(API_ROUTES.assistantChat(top.id))
          setMessagesByChat((prev) => ({
            ...prev,
            [top.id]:
              chat.messages?.length > 0
                ? chat.messages
                : defaultMessages(projectId, initialMessage),
          }))
        }

        setChatsByProject((prev) => ({ ...prev, [projectId]: nextChats }))
        setActiveChatByProject((prev) => ({ ...prev, [projectId]: activeId! }))
      } catch {
        const localId = `${projectId}-local`
        setChatsByProject((prev) => ({
          ...prev,
          [projectId]: [
            {
              id: localId,
              projectId,
              title: "Current chat",
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messageCount: 1,
            },
          ],
        }))
        setActiveChatByProject((prev) => ({ ...prev, [projectId]: localId }))
        setMessagesByChat((prev) => ({
          ...prev,
          [localId]: defaultMessages(projectId, initialMessage),
        }))
      } finally {
        setLoadingByProject((prev) => ({ ...prev, [projectId]: false }))
      }
    },
    [],
  )

  const selectChat = useCallback(
    async (projectId: string, chatId: string) => {
      setActiveChatByProject((prev) => ({ ...prev, [projectId]: chatId }))
      if (messagesByChat[chatId]) return
      const initialMessage = initialMessageByProject.current.get(projectId) ?? ""
      try {
        const { chat } = await apiJson<{
          chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] }
        }>(API_ROUTES.assistantChat(chatId))
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]:
            chat.messages?.length > 0
              ? chat.messages
              : defaultMessages(projectId, initialMessage),
        }))
      } catch {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: defaultMessages(projectId, initialMessage),
        }))
      }
    },
    [messagesByChat],
  )

  const newChat = useCallback(
    async (projectId: string, initialMessage: string) => {
      const welcome = defaultMessages(projectId, initialMessage)
      try {
        const { chat } = await apiJson<{
          chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] }
        }>(API_ROUTES.assistantChats, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ projectId, messages: welcome }),
        })
        setChatsByProject((prev) => ({
          ...prev,
          [projectId]: [chat, ...(prev[projectId] ?? [])],
        }))
        setActiveChatByProject((prev) => ({ ...prev, [projectId]: chat.id }))
        setMessagesByChat((prev) => ({ ...prev, [chat.id]: welcome }))
      } catch {
        const localId = `${projectId}-local-${Date.now()}`
        const summary: AssistantChatSummary = {
          id: localId,
          projectId,
          title: "New chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messageCount: 1,
        }
        setChatsByProject((prev) => ({
          ...prev,
          [projectId]: [summary, ...(prev[projectId] ?? [])],
        }))
        setActiveChatByProject((prev) => ({ ...prev, [projectId]: localId }))
        setMessagesByChat((prev) => ({ ...prev, [localId]: welcome }))
      }
    },
    [],
  )

  const deleteChat = useCallback(
    async (projectId: string, chatId: string, initialMessage: string) => {
      const pendingSave = saveTimers.current.get(chatId)
      if (pendingSave) {
        clearTimeout(pendingSave)
        saveTimers.current.delete(chatId)
      }

      const isLocalOnly = chatId.includes("-local")
      if (!isLocalOnly) {
        try {
          await apiJson(API_ROUTES.assistantChat(chatId), { method: "DELETE" })
        } catch {
          return
        }
      }

      const wasActive = activeChatByProjectRef.current[projectId] === chatId
      const remaining = (chatsByProject[projectId] ?? []).filter((c) => c.id !== chatId)

      setMessagesByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        return next
      })
      setChatsByProject((prev) => ({ ...prev, [projectId]: remaining }))

      if (!wasActive) return

      const nextActiveId = remaining[0]?.id
      if (nextActiveId) {
        setActiveChatByProject((prev) => ({ ...prev, [projectId]: nextActiveId }))
        void selectChat(projectId, nextActiveId)
        return
      }

      setActiveChatByProject((prev) => {
        const next = { ...prev }
        delete next[projectId]
        return next
      })
      void newChat(projectId, initialMessage)
    },
    [chatsByProject, newChat, selectChat],
  )

  const getSession = useCallback(
    (projectId: string, initialMessage: string): ProjectAssistantSession => {
      const activeChatId = activeChatByProject[projectId] ?? null
      const initial = initialMessageByProject.current.get(projectId) ?? initialMessage
      const messages =
        (activeChatId && messagesByChat[activeChatId]) ||
        defaultMessages(projectId, initial)

      const setMessages: ProjectAssistantSession["setMessages"] = (updater) => {
        const chatId = activeChatByProjectRef.current[projectId]
        if (!chatId) return
        setMessagesByChat((prev) => {
          const current = prev[chatId] ?? defaultMessages(projectId, initial)
          const next = typeof updater === "function" ? updater(current) : updater
          persistMessages(chatId, next)
          setChatsByProject((chatsPrev) => {
            const list = chatsPrev[projectId]
            if (!list) return chatsPrev
            const firstUser = next.find((m) => m.role === "user")
            const title = firstUser ? firstUser.content.trim().slice(0, 60) : "New chat"
            return {
              ...chatsPrev,
              [projectId]: list.map((c) =>
                c.id === chatId
                  ? { ...c, title, messageCount: next.length, updatedAt: Date.now() }
                  : c,
              ),
            }
          })
          return { ...prev, [chatId]: next }
        })
      }

      return {
        messages,
        setMessages,
        chats: chatsByProject[projectId] ?? [],
        activeChatId,
        chatsLoading: loadingByProject[projectId] ?? !loadStarted.current.has(projectId),
        selectChat: (chatId) => void selectChat(projectId, chatId),
        newChat: () => void newChat(projectId, initialMessage),
        deleteChat: (chatId) => deleteChat(projectId, chatId, initialMessage),
      }
    },
    [activeChatByProject, chatsByProject, deleteChat, loadingByProject, messagesByChat, newChat, persistMessages, selectChat],
  )

  useEffect(() => {
    return () => {
      for (const timer of saveTimers.current.values()) clearTimeout(timer)
    }
  }, [])

  const value = useMemo(
    () => ({ open, setOpen, toggle, ensureProjectChats, getSession }),
    [ensureProjectChats, getSession, open, toggle],
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

export function useProjectAssistantSession(
  projectId: string,
  initialMessage: string,
): ProjectAssistantSession {
  const { ensureProjectChats, getSession } = useProjectAssistant()
  useEffect(() => {
    void ensureProjectChats(projectId, initialMessage)
  }, [projectId, initialMessage, ensureProjectChats])
  return getSession(projectId, initialMessage)
}
