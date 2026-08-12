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
import { UiContextSelectOverlay } from "@/components/ui-context-select-overlay"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS, apiJson } from "@/lib/api-client"
import type { AssistantStreamingDraft } from "@/lib/assistant-chat-types"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import {
  dedupeUiContextRefs,
  MAX_UI_CONTEXT_ITEMS,
  type UiContextRef,
} from "@/lib/ui-context-types"

export type AssistantChatSummary = {
  id: string
  projectId: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
  userId: string
  ownerEmail: string | null
  isMine: boolean
}

/** AI : short label for shared-project history — email local-part, or You. */
export function chatOwnerLabel(chat: Pick<AssistantChatSummary, "isMine" | "ownerEmail">): string {
  if (chat.isMine) return "You"
  const email = chat.ownerEmail?.trim()
  if (!email) return "Teammate"
  const at = email.indexOf("@")
  return at > 0 ? email.slice(0, at) : email
}

function optimisticChatSummary(
  id: string,
  projectId: string,
  title: string,
  messageCount: number,
): AssistantChatSummary {
  return {
    id,
    projectId,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount,
    userId: "",
    ownerEmail: null,
    isMine: true,
  }
}

type ProjectAssistantSession = {
  messages: AssistantChatMessage<ProjectProposal>[]
  setMessages: React.Dispatch<React.SetStateAction<AssistantChatMessage<ProjectProposal>[]>>
  streamingDraft: AssistantStreamingDraft | null
  setStreamingDraft: React.Dispatch<React.SetStateAction<AssistantStreamingDraft | null>>
  assistantBusy: boolean
  setAssistantBusy: (busy: boolean) => void
  chats: AssistantChatSummary[]
  activeChatId: string | null
  /** AI : false when viewing a teammate's chat on a shared project */
  activeChatIsMine: boolean
  chatsLoading: boolean
  selectChat: (chatId: string) => void
  newChat: () => void
  deleteChat: (chatId: string) => Promise<void>
}

type ProjectAssistantContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
  selectMode: boolean
  setSelectMode: (on: boolean) => void
  toggleSelectMode: () => void
  uiContextPins: UiContextRef[]
  pinUiContext: (ref: UiContextRef) => void
  unpinUiContext: (id: string) => void
  clearUiContextPins: () => void
  ensureProjectChats: (projectId: string, initialMessage: string) => Promise<void>
  getSession: (projectId: string, initialMessage: string) => ProjectAssistantSession
}

const ProjectAssistantContext = createContext<ProjectAssistantContextValue | null>(null)

function welcomeMessage(
  chatId: string,
  initialMessage: string,
): AssistantChatMessage<ProjectProposal> {
  return { id: `${chatId}-welcome`, role: "assistant", content: initialMessage }
}

function defaultMessages(
  chatId: string,
  initialMessage: string,
): AssistantChatMessage<ProjectProposal>[] {
  return [welcomeMessage(chatId, initialMessage)]
}

function formatChatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function chatMonthKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}`
}

function formatChatMonthYear(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  })
}

export type AssistantChatMonthGroup = {
  monthKey: string
  monthLabel: string
  chats: AssistantChatSummary[]
}

function groupChatsByMonth(chats: AssistantChatSummary[]): AssistantChatMonthGroup[] {
  const groups: AssistantChatMonthGroup[] = []
  for (const chat of chats) {
    const key = chatMonthKey(chat.updatedAt)
    const last = groups[groups.length - 1]
    if (last?.monthKey === key) {
      last.chats.push(chat)
    } else {
      groups.push({
        monthKey: key,
        monthLabel: formatChatMonthYear(chat.updatedAt),
        chats: [chat],
      })
    }
  }
  return groups
}

export { formatChatDate, groupChatsByMonth }

export function ProjectAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [uiContextPins, setUiContextPins] = useState<UiContextRef[]>([])
  const [messagesByChat, setMessagesByChat] = useState<
    Record<string, AssistantChatMessage<ProjectProposal>[]>
  >({})
  const [streamingDraftByChat, setStreamingDraftByChat] = useState<
    Record<string, AssistantStreamingDraft | null>
  >({})
  const [assistantBusyByChat, setAssistantBusyByChat] = useState<Record<string, boolean>>({})
  const [chatsByProject, setChatsByProject] = useState<Record<string, AssistantChatSummary[]>>({})
  const [activeChatByProject, setActiveChatByProject] = useState<Record<string, string>>({})
  const [loadingByProject, setLoadingByProject] = useState<Record<string, boolean>>({})
  const loadStarted = useRef(new Set<string>())
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const initialMessageByProject = useRef(new Map<string, string>())
  const activeChatByProjectRef = useRef(activeChatByProject)
  activeChatByProjectRef.current = activeChatByProject
  const messagesByChatRef = useRef(messagesByChat)
  messagesByChatRef.current = messagesByChat
  const chatsByProjectRef = useRef(chatsByProject)
  chatsByProjectRef.current = chatsByProject

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => {
      const next = !v
      if (next) setOpen(true)
      return next
    })
  }, [])
  const pinUiContext = useCallback((ref: UiContextRef) => {
    setUiContextPins((prev) => dedupeUiContextRefs([ref, ...prev]).slice(0, MAX_UI_CONTEXT_ITEMS))
  }, [])
  const unpinUiContext = useCallback((id: string) => {
    setUiContextPins((prev) => prev.filter((p) => p.id !== id))
  }, [])
  const clearUiContextPins = useCallback(() => setUiContextPins([]), [])

  const persistMessages = useCallback(
    (chatId: string, messages: AssistantChatMessage<ProjectProposal>[]) => {
      // AI : optimistic local chats are promoted to server ids after POST succeeds.
      if (chatId.includes("-local-")) return
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

  const cancelPendingSave = useCallback((chatId: string) => {
    const pending = saveTimers.current.get(chatId)
    if (pending) {
      clearTimeout(pending)
      saveTimers.current.delete(chatId)
    }
  }, [])

  function mergeChatSummaries(
    existing: AssistantChatSummary[],
    incoming: AssistantChatSummary[],
  ): AssistantChatSummary[] {
    const merged = [...existing]
    for (const chat of incoming) {
      const i = merged.findIndex((c) => c.id === chat.id)
      if (i === -1) merged.push(chat)
      else merged[i] = chat
    }
    return merged.sort((a, b) => b.updatedAt - a.updatedAt)
  }

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
        // AI : open your own thread first — don't land in a teammate's read-only chat.
        let activeId = chats.find((c) => c.isMine)?.id

        if (!activeId) {
          const localId = `${projectId}-local-${Date.now()}`
          const welcome = defaultMessages(localId, initialMessage)
          const { chat } = await apiJson<{ chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] } }>(
            API_ROUTES.assistantChats,
            {
              method: "POST",
              headers: JSON_HEADERS,
              body: JSON.stringify({ projectId, messages: welcome }),
            },
          )
          nextChats = mergeChatSummaries(chats, [chat])
          activeId = chat.id
          setMessagesByChat((prev) => ({
            ...prev,
            [chat.id]: chat.messages?.length ? chat.messages : welcome,
          }))
        } else {
          const top = chats.find((c) => c.id === activeId) ?? chats[0]
          const { chat } = await apiJson<{
            chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] }
          }>(API_ROUTES.assistantChat(top.id))
          setMessagesByChat((prev) => {
            if (prev[top.id]) return prev
            return {
              ...prev,
              [top.id]:
                chat.messages?.length > 0
                  ? chat.messages
                  : defaultMessages(top.id, initialMessage),
            }
          })
        }

        setChatsByProject((prev) => {
          const existing = prev[projectId] ?? []
          const merged = existing.length > 0 ? mergeChatSummaries(existing, nextChats) : nextChats
          return { ...prev, [projectId]: merged }
        })
        setActiveChatByProject((prev) => {
          if (prev[projectId]) return prev
          return { ...prev, [projectId]: activeId! }
        })
      } catch {
        const localId = `${projectId}-local-${Date.now()}`
        setChatsByProject((prev) => ({
          ...prev,
          [projectId]: [
            optimisticChatSummary(localId, projectId, "Current chat", 1),
            ...(prev[projectId] ?? []),
          ],
        }))
        setActiveChatByProject((prev) => {
          if (prev[projectId]) return prev
          return { ...prev, [projectId]: localId }
        })
        setMessagesByChat((prev) => ({
          ...prev,
          [localId]: prev[localId] ?? defaultMessages(localId, initialMessage),
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
      if (messagesByChatRef.current[chatId]) return
      const initialMessage = initialMessageByProject.current.get(projectId) ?? ""
      try {
        const { chat } = await apiJson<{
          chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] }
        }>(API_ROUTES.assistantChat(chatId))
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]:
            prev[chatId] ??
            (chat.messages?.length > 0
              ? chat.messages
              : defaultMessages(chatId, initialMessage)),
        }))
      } catch {
        setMessagesByChat((prev) => ({
          ...prev,
          [chatId]: prev[chatId] ?? defaultMessages(chatId, initialMessage),
        }))
      }
    },
    [],
  )

  const newChat = useCallback(
    async (projectId: string, initialMessage: string) => {
      const previousChatId = activeChatByProjectRef.current[projectId]
      if (previousChatId) cancelPendingSave(previousChatId)

      const localId = `${projectId}-local-${Date.now()}`
      const welcome = defaultMessages(localId, initialMessage)

      // AI : switch UI immediately so new chat feels instant even while POST is in flight.
      setActiveChatByProject((prev) => ({ ...prev, [projectId]: localId }))
      setMessagesByChat((prev) => ({ ...prev, [localId]: welcome }))
      setChatsByProject((prev) => ({
        ...prev,
        [projectId]: [
          optimisticChatSummary(localId, projectId, "New chat", welcome.length),
          ...(prev[projectId] ?? []),
        ],
      }))

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
          [projectId]: mergeChatSummaries(
            (prev[projectId] ?? []).filter((c) => c.id !== localId),
            [chat],
          ),
        }))
        setActiveChatByProject((prev) => ({ ...prev, [projectId]: chat.id }))
        let migratedMessages = defaultMessages(chat.id, initialMessage)
        setMessagesByChat((prev) => {
          migratedMessages = prev[localId] ?? defaultMessages(chat.id, initialMessage)
          const next = { ...prev, [chat.id]: migratedMessages }
          delete next[localId]
          return next
        })
        persistMessages(chat.id, migratedMessages)
      } catch {
        // AI : keep the optimistic local chat when persistence is unavailable.
      }
    },
    [cancelPendingSave, persistMessages],
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
      const remaining = (chatsByProjectRef.current[projectId] ?? []).filter((c) => c.id !== chatId)

      setMessagesByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        return next
      })
      setStreamingDraftByChat((prev) => {
        if (!(chatId in prev)) return prev
        const next = { ...prev }
        delete next[chatId]
        return next
      })
      setAssistantBusyByChat((prev) => {
        if (!(chatId in prev)) return prev
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
    [newChat, selectChat],
  )

  const getSession = useCallback(
    (projectId: string, initialMessage: string): ProjectAssistantSession => {
      const activeChatId = activeChatByProject[projectId] ?? null
      const initial = initialMessageByProject.current.get(projectId) ?? initialMessage
      const chats = chatsByProject[projectId] ?? []
      const activeSummary = activeChatId ? chats.find((c) => c.id === activeChatId) : undefined
      const activeChatIsMine = activeSummary?.isMine ?? true
      const messages =
        (activeChatId && messagesByChat[activeChatId]) ||
        (activeChatId ? defaultMessages(activeChatId, initial) : [])

      const setMessages: ProjectAssistantSession["setMessages"] = (updater) => {
        const chatId = activeChatByProjectRef.current[projectId]
        if (!chatId) return
        const owned =
          (chatsByProjectRef.current[projectId] ?? []).find((c) => c.id === chatId)?.isMine ?? true
        if (!owned) return
        setMessagesByChat((prev) => {
          const current = prev[chatId] ?? defaultMessages(chatId, initial)
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
        streamingDraft: activeChatId ? (streamingDraftByChat[activeChatId] ?? null) : null,
        setStreamingDraft: (updater) => {
          const chatId = activeChatByProjectRef.current[projectId]
          if (!chatId) return
          setStreamingDraftByChat((prev) => {
            const current = prev[chatId] ?? null
            const next = typeof updater === "function" ? updater(current) : updater
            if (next === current) return prev
            return { ...prev, [chatId]: next }
          })
        },
        assistantBusy: activeChatId ? (assistantBusyByChat[activeChatId] ?? false) : false,
        setAssistantBusy: (busy) => {
          const chatId = activeChatByProjectRef.current[projectId]
          if (!chatId) return
          setAssistantBusyByChat((prev) => {
            if (!busy && !(chatId in prev)) return prev
            if (!busy) {
              const next = { ...prev }
              delete next[chatId]
              return next
            }
            return { ...prev, [chatId]: true }
          })
        },
        chats,
        activeChatId,
        activeChatIsMine,
        chatsLoading: loadingByProject[projectId] ?? !loadStarted.current.has(projectId),
        selectChat: (chatId) => void selectChat(projectId, chatId),
        newChat: () => void newChat(projectId, initialMessage),
        deleteChat: (chatId) => deleteChat(projectId, chatId, initialMessage),
      }
    },
    [activeChatByProject, assistantBusyByChat, chatsByProject, deleteChat, loadingByProject, messagesByChat, newChat, persistMessages, selectChat, streamingDraftByChat],
  )

  useEffect(() => {
    return () => {
      for (const timer of saveTimers.current.values()) clearTimeout(timer)
    }
  }, [])

  const value = useMemo(
    () => ({
      open,
      setOpen,
      toggle,
      selectMode,
      setSelectMode,
      toggleSelectMode,
      uiContextPins,
      pinUiContext,
      unpinUiContext,
      clearUiContextPins,
      ensureProjectChats,
      getSession,
    }),
    [
      clearUiContextPins,
      ensureProjectChats,
      getSession,
      open,
      pinUiContext,
      selectMode,
      toggle,
      toggleSelectMode,
      uiContextPins,
      unpinUiContext,
    ],
  )

  return (
    <ProjectAssistantContext.Provider value={value}>
      {children}
      <UiContextSelectOverlay />
    </ProjectAssistantContext.Provider>
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
