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
import { isDemoMode } from "@/lib/demo-mode"
import {
  sameStreamingDraft,
  type AssistantStreamingDraft,
} from "@/lib/assistant-chat-types"
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

type ChatMessageUpdater = React.Dispatch<
  React.SetStateAction<AssistantChatMessage<ProjectProposal>[]>
>
type StreamingDraftUpdater = React.Dispatch<React.SetStateAction<AssistantStreamingDraft | null>>

/** AI : chat-scoped bindings so parallel agents keep writing to the chat that started the turn. */
export type ProjectAssistantChatBindings = {
  chatId: string
  messages: AssistantChatMessage<ProjectProposal>[]
  setMessages: ChatMessageUpdater
  streamingDraft: AssistantStreamingDraft | null
  setStreamingDraft: StreamingDraftUpdater
  assistantBusy: boolean
  setAssistantBusy: (busy: boolean) => void
  isMine: boolean
}

type ProjectAssistantSession = {
  messages: AssistantChatMessage<ProjectProposal>[]
  setMessages: ChatMessageUpdater
  streamingDraft: AssistantStreamingDraft | null
  setStreamingDraft: StreamingDraftUpdater
  assistantBusy: boolean
  setAssistantBusy: (busy: boolean) => void
  /** AI : true if any open/history chat is streaming — dock toggle indicator. */
  anyAssistantBusy: boolean
  chats: AssistantChatSummary[]
  /** AI : Cursor-style open agent tabs (subset of chats); history lists all. */
  openChatIds: string[]
  activeChatId: string | null
  /** AI : false when viewing a teammate's chat on a shared project */
  activeChatIsMine: boolean
  chatsLoading: boolean
  selectChat: (chatId: string) => void
  newChat: () => void
  closeOpenChat: (chatId: string) => void
  deleteChat: (chatId: string) => Promise<void>
  getChatBindings: (chatId: string) => ProjectAssistantChatBindings
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

function defaultMessages(
  chatId: string,
  initialMessage: string,
): AssistantChatMessage<ProjectProposal>[] {
  return [{ id: `${chatId}-welcome`, role: "assistant", content: initialMessage }]
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

function ensureIdInOpenTabs(openIds: string[] | undefined, chatId: string): string[] {
  const prev = openIds ?? []
  if (prev.includes(chatId)) return prev
  return [...prev, chatId]
}

export function ProjectAssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true)
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
  const [openChatIdsByProject, setOpenChatIdsByProject] = useState<Record<string, string[]>>({})
  const [activeChatByProject, setActiveChatByProject] = useState<Record<string, string>>({})
  const [loadingByProject, setLoadingByProject] = useState<Record<string, boolean>>({})
  const loadStarted = useRef(new Set<string>())
  const saveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const initialMessageByProject = useRef(new Map<string, string>())
  const activeChatByProjectRef = useRef(activeChatByProject)
  activeChatByProjectRef.current = activeChatByProject
  const openChatIdsByProjectRef = useRef(openChatIdsByProject)
  openChatIdsByProjectRef.current = openChatIdsByProject
  const messagesByChatRef = useRef(messagesByChat)
  messagesByChatRef.current = messagesByChat
  const chatsByProjectRef = useRef(chatsByProject)
  chatsByProjectRef.current = chatsByProject
  // AI : local-* → server id while a turn may still be in flight on the old id.
  const chatIdAliasRef = useRef<Record<string, string>>({})

  const resolveChatId = useCallback((chatId: string): string => {
    let cur = chatId
    const seen = new Set<string>()
    while (chatIdAliasRef.current[cur] && !seen.has(cur)) {
      seen.add(cur)
      cur = chatIdAliasRef.current[cur]!
    }
    return cur
  }, [])

  const migrateChatId = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return
    chatIdAliasRef.current[fromId] = toId
    // AI : keep open-tab / active ids stable (local-*) so mounted agents are not remounted mid-stream.
    setMessagesByChat((prev) => {
      if (!(fromId in prev)) return prev
      const next = { ...prev, [toId]: prev[toId] ?? prev[fromId] }
      delete next[fromId]
      return next
    })
    setStreamingDraftByChat((prev) => {
      if (!(fromId in prev)) return prev
      const next = { ...prev, [toId]: prev[toId] ?? prev[fromId] }
      delete next[fromId]
      return next
    })
    setAssistantBusyByChat((prev) => {
      if (!(fromId in prev)) return prev
      const next = { ...prev }
      if (prev[fromId]) next[toId] = true
      delete next[fromId]
      return next
    })
  }, [])

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

  const seedLocalChat = useCallback((projectId: string, initialMessage: string) => {
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
    setOpenChatIdsByProject((prev) => {
      if ((prev[projectId] ?? []).length > 0) return prev
      return { ...prev, [projectId]: [localId] }
    })
    setMessagesByChat((prev) => ({
      ...prev,
      [localId]: prev[localId] ?? defaultMessages(localId, initialMessage),
    }))
  }, [])

  const ensureProjectChats = useCallback(
    async (projectId: string, initialMessage: string) => {
      if (loadStarted.current.has(projectId)) return
      loadStarted.current.add(projectId)
      initialMessageByProject.current.set(projectId, initialMessage)
      setLoadingByProject((prev) => ({ ...prev, [projectId]: true }))
      // AI : public /demo has no session — skip chats API (401) and keep a local thread.
      if (isDemoMode()) {
        seedLocalChat(projectId, initialMessage)
        setLoadingByProject((prev) => ({ ...prev, [projectId]: false }))
        return
      }
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
        setOpenChatIdsByProject((prev) => {
          if ((prev[projectId] ?? []).length > 0) return prev
          return { ...prev, [projectId]: [activeId!] }
        })
      } catch {
        seedLocalChat(projectId, initialMessage)
      } finally {
        setLoadingByProject((prev) => ({ ...prev, [projectId]: false }))
      }
    },
    [seedLocalChat],
  )

  const selectChat = useCallback(
    async (projectId: string, chatId: string) => {
      // AI : history pick opens a horizontal tab (Cursor-style) without dropping other agents.
      const openIds = openChatIdsByProjectRef.current[projectId] ?? []
      const existingTab = openIds.find(
        (id) => id === chatId || resolveChatId(id) === chatId,
      )
      const tabId = existingTab ?? chatId
      setOpenChatIdsByProject((prev) => ({
        ...prev,
        [projectId]: ensureIdInOpenTabs(prev[projectId], tabId),
      }))
      setActiveChatByProject((prev) => ({ ...prev, [projectId]: tabId }))
      const resolvedId = resolveChatId(tabId)
      if (messagesByChatRef.current[resolvedId] || messagesByChatRef.current[tabId]) return
      const initialMessage = initialMessageByProject.current.get(projectId) ?? ""
      try {
        const { chat } = await apiJson<{
          chat: AssistantChatSummary & { messages: AssistantChatMessage<ProjectProposal>[] }
        }>(API_ROUTES.assistantChat(resolvedId))
        setMessagesByChat((prev) => ({
          ...prev,
          [resolvedId]:
            prev[resolvedId] ??
            (chat.messages?.length > 0
              ? chat.messages
              : defaultMessages(resolvedId, initialMessage)),
        }))
      } catch {
        setMessagesByChat((prev) => ({
          ...prev,
          [resolvedId]: prev[resolvedId] ?? defaultMessages(resolvedId, initialMessage),
        }))
      }
    },
    [resolveChatId],
  )

  const newChat = useCallback(
    async (projectId: string, initialMessage: string) => {
      const previousChatId = activeChatByProjectRef.current[projectId]
      if (previousChatId) cancelPendingSave(previousChatId)

      const localId = `${projectId}-local-${Date.now()}`
      const welcome = defaultMessages(localId, initialMessage)

      // AI : switch UI immediately so new chat feels instant even while POST is in flight.
      setActiveChatByProject((prev) => ({ ...prev, [projectId]: localId }))
      setOpenChatIdsByProject((prev) => ({
        ...prev,
        [projectId]: ensureIdInOpenTabs(prev[projectId], localId),
      }))
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
        // AI : leave active/open on localId; alias + message migrate keep the mounted agent alive.
        migrateChatId(localId, chat.id)
        let migratedMessages = defaultMessages(chat.id, initialMessage)
        setMessagesByChat((prev) => {
          migratedMessages =
            prev[chat.id] ?? prev[localId] ?? defaultMessages(chat.id, initialMessage)
          const next = { ...prev, [chat.id]: migratedMessages }
          delete next[localId]
          return next
        })
        persistMessages(chat.id, migratedMessages)
      } catch {
        // AI : keep the optimistic local chat when persistence is unavailable.
      }
    },
    [cancelPendingSave, migrateChatId, persistMessages],
  )

  const deleteChat = useCallback(
    async (projectId: string, chatId: string, initialMessage: string) => {
      const resolvedId = resolveChatId(chatId)
      const pendingSave = saveTimers.current.get(resolvedId)
      if (pendingSave) {
        clearTimeout(pendingSave)
        saveTimers.current.delete(resolvedId)
      }

      const isLocalOnly = resolvedId.includes("-local")
      if (!isLocalOnly) {
        try {
          await apiJson(API_ROUTES.assistantChat(resolvedId), { method: "DELETE" })
        } catch {
          return
        }
      }

      const openIds = openChatIdsByProjectRef.current[projectId] ?? []
      const tabsForChat = openIds.filter(
        (id) => id === chatId || id === resolvedId || resolveChatId(id) === resolvedId,
      )
      const wasActive = tabsForChat.includes(activeChatByProjectRef.current[projectId] ?? "")
      const remaining = (chatsByProjectRef.current[projectId] ?? []).filter(
        (c) => c.id !== chatId && c.id !== resolvedId,
      )
      const remainingOpen = openIds.filter((id) => !tabsForChat.includes(id))

      setMessagesByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        delete next[resolvedId]
        for (const tabId of tabsForChat) delete next[tabId]
        return next
      })
      setStreamingDraftByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        delete next[resolvedId]
        for (const tabId of tabsForChat) delete next[tabId]
        return next
      })
      setAssistantBusyByChat((prev) => {
        const next = { ...prev }
        delete next[chatId]
        delete next[resolvedId]
        for (const tabId of tabsForChat) delete next[tabId]
        return next
      })
      setChatsByProject((prev) => ({ ...prev, [projectId]: remaining }))
      setOpenChatIdsByProject((prev) => ({ ...prev, [projectId]: remainingOpen }))

      if (!wasActive) return

      const nextActiveId = remainingOpen[remainingOpen.length - 1] ?? remaining[0]?.id
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
    [newChat, resolveChatId, selectChat],
  )

  const closeOpenChat = useCallback(
    (projectId: string, chatId: string, initialMessage: string) => {
      const openIds = openChatIdsByProjectRef.current[projectId] ?? []
      if (!openIds.includes(chatId)) return
      const remainingOpen = openIds.filter((id) => id !== chatId)
      const wasActive = activeChatByProjectRef.current[projectId] === chatId

      // AI : last tab close → new agent; drop closed id first so newChat doesn't keep it open.
      setOpenChatIdsByProject((prev) => ({ ...prev, [projectId]: remainingOpen }))

      if (remainingOpen.length === 0) {
        void newChat(projectId, initialMessage)
        return
      }

      if (!wasActive) return
      const nextActiveId = remainingOpen[remainingOpen.length - 1]!
      setActiveChatByProject((prev) => ({ ...prev, [projectId]: nextActiveId }))
      void selectChat(projectId, nextActiveId)
    },
    [newChat, selectChat],
  )

  const getSession = useCallback(
    (projectId: string, initialMessage: string): ProjectAssistantSession => {
      const activeChatId = activeChatByProject[projectId] ?? null
      const initial = initialMessageByProject.current.get(projectId) ?? initialMessage
      const chats = chatsByProject[projectId] ?? []
      const openChatIdsRaw = openChatIdsByProject[projectId] ?? []
      // AI : keep active in tabs even if state briefly lags after load/migrate.
      const openChatIds =
        activeChatId && !openChatIdsRaw.includes(activeChatId)
          ? [...openChatIdsRaw, activeChatId]
          : openChatIdsRaw
      const activeSummary = activeChatId
        ? chats.find((c) => c.id === resolveChatId(activeChatId)) ??
          chats.find((c) => c.id === activeChatId)
        : undefined
      const activeChatIsMine = activeSummary?.isMine ?? true
      const messages =
        (activeChatId && messagesByChat[resolveChatId(activeChatId)]) ||
        (activeChatId ? defaultMessages(resolveChatId(activeChatId), initial) : [])

      const bindChat = (chatId: string): ProjectAssistantChatBindings => {
        const resolvedId = resolveChatId(chatId)
        const summary = chats.find((c) => c.id === resolvedId)
        const isMine = summary?.isMine ?? true
        const chatMessages = messagesByChat[resolvedId] ?? defaultMessages(resolvedId, initial)

        const setMessages: ChatMessageUpdater = (updater) => {
          const targetId = resolveChatId(chatId)
          const owned =
            (chatsByProjectRef.current[projectId] ?? []).find((c) => c.id === targetId)?.isMine ??
            true
          if (!owned) return
          setMessagesByChat((prev) => {
            const current = prev[targetId] ?? defaultMessages(targetId, initial)
            const next = typeof updater === "function" ? updater(current) : updater
            persistMessages(targetId, next)
            setChatsByProject((chatsPrev) => {
              const list = chatsPrev[projectId]
              if (!list) return chatsPrev
              const firstUser = next.find((m) => m.role === "user")
              const title = firstUser ? firstUser.content.trim().slice(0, 60) : "New chat"
              return {
                ...chatsPrev,
                [projectId]: list.map((c) =>
                  c.id === targetId
                    ? { ...c, title, messageCount: next.length, updatedAt: Date.now() }
                    : c,
                ),
              }
            })
            return { ...prev, [targetId]: next }
          })
        }

        const setStreamingDraft: StreamingDraftUpdater = (updater) => {
          const targetId = resolveChatId(chatId)
          setStreamingDraftByChat((prev) => {
            const current = prev[targetId] ?? null
            const next = typeof updater === "function" ? updater(current) : updater
            if (sameStreamingDraft(next, current)) return prev
            return { ...prev, [targetId]: next }
          })
        }

        const setAssistantBusy = (busy: boolean) => {
          const targetId = resolveChatId(chatId)
          setAssistantBusyByChat((prev) => {
            if (busy) {
              if (prev[targetId]) return prev
              return { ...prev, [targetId]: true }
            }
            if (!(targetId in prev)) return prev
            const next = { ...prev }
            delete next[targetId]
            return next
          })
        }

        return {
          chatId: resolvedId,
          messages: chatMessages,
          setMessages,
          streamingDraft: streamingDraftByChat[resolvedId] ?? null,
          setStreamingDraft,
          assistantBusy: assistantBusyByChat[resolvedId] ?? false,
          setAssistantBusy,
          isMine,
        }
      }

      const activeBindings = activeChatId
        ? bindChat(activeChatId)
        : {
            chatId: "",
            messages,
            setMessages: (() => {}) as ChatMessageUpdater,
            streamingDraft: null,
            setStreamingDraft: (() => {}) as StreamingDraftUpdater,
            assistantBusy: false,
            setAssistantBusy: () => {},
            isMine: true,
          }

      return {
        messages: activeBindings.messages,
        setMessages: activeBindings.setMessages,
        streamingDraft: activeBindings.streamingDraft,
        setStreamingDraft: activeBindings.setStreamingDraft,
        assistantBusy: activeBindings.assistantBusy,
        setAssistantBusy: activeBindings.setAssistantBusy,
        anyAssistantBusy: Object.values(assistantBusyByChat).some(Boolean),
        chats,
        openChatIds,
        activeChatId,
        activeChatIsMine,
        chatsLoading: loadingByProject[projectId] ?? !loadStarted.current.has(projectId),
        selectChat: (chatId) => void selectChat(projectId, chatId),
        newChat: () => void newChat(projectId, initialMessage),
        closeOpenChat: (chatId) => closeOpenChat(projectId, chatId, initialMessage),
        deleteChat: (chatId) => deleteChat(projectId, chatId, initialMessage),
        getChatBindings: bindChat,
      }
    },
    [
      activeChatByProject,
      assistantBusyByChat,
      chatsByProject,
      closeOpenChat,
      deleteChat,
      loadingByProject,
      messagesByChat,
      newChat,
      openChatIdsByProject,
      persistMessages,
      resolveChatId,
      selectChat,
      streamingDraftByChat,
    ],
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
