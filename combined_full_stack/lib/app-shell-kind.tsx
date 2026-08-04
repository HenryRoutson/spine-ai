"use client"

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { registerAppModeNavApi } from "@/lib/app-mode-nav"
import { clearActiveProjectSession, readActiveProjectSession } from "@/lib/active-project-session"
import { getStoreNavigationBridge } from "@/lib/store-navigation-bridge"
import type { ProjectId } from "@/lib/types"

export type AppShellKind = "consumer" | "builder" | "picker"

type AppShellKindContextValue = {
  shellKind: AppShellKind
  setShellKind: (kind: AppShellKind) => void
  navigateToRunMode: () => void
  navigateToBuildMode: () => void
  navigateToProjectPicker: () => void
  openBuildWorkspace: (projectId: ProjectId) => void
}

const AppShellKindContext = createContext<AppShellKindContextValue | null>(null)

function resolveShellKindFromSession(): AppShellKind {
  if (typeof window === "undefined") return "consumer"
  if (readActiveProjectSession()) return "builder"
  return "consumer"
}

export function AppShellKindProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [shellKind, setShellKind] = useState<AppShellKind>("consumer")
  const [hydrated, setHydrated] = useState(false)

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shellParam = params.get("shell")
    const windowParam = params.get("window")
    let next: AppShellKind =
      pathname.startsWith("/projects") || shellParam === "picker"
        ? "picker"
        : resolveShellKindFromSession()

    if (windowParam === "billing" || windowParam === "settings") {
      if (next === "picker") next = "consumer"
    }

    setShellKind(next)
    setHydrated(true)

    if (shellParam || pathname.startsWith("/projects")) {
      router.replace("/", { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateToRunMode = useCallback(() => {
    const nav = getStoreNavigationBridge()
    nav?.leaveBuilder()
    clearActiveProjectSession()
    setShellKind("consumer")
    router.replace("/", { scroll: false })
  }, [router])

  const navigateToBuildMode = useCallback(() => {
    const sessionId = readActiveProjectSession()
    if (sessionId) {
      const nav = getStoreNavigationBridge()
      nav?.enterBuilder(sessionId)
      setShellKind("builder")
      router.replace("/", { scroll: false })
      return
    }
    const nav = getStoreNavigationBridge()
    nav?.enterPicker()
    setShellKind("picker")
    router.replace("/", { scroll: false })
  }, [router])

  const navigateToProjectPicker = useCallback(() => {
    const nav = getStoreNavigationBridge()
    nav?.enterPicker()
    setShellKind("picker")
    router.replace("/", { scroll: false })
  }, [router])

  const openBuildWorkspace = useCallback(
    (projectId: ProjectId) => {
      const nav = getStoreNavigationBridge()
      nav?.enterBuilder(projectId)
      setShellKind("builder")
      router.replace("/", { scroll: false })
    },
    [router],
  )

  const value = useMemo(
    () => ({
      shellKind: hydrated ? shellKind : resolveShellKindFromSession(),
      setShellKind,
      navigateToRunMode,
      navigateToBuildMode,
      navigateToProjectPicker,
      openBuildWorkspace,
    }),
    [hydrated, shellKind, navigateToRunMode, navigateToBuildMode, navigateToProjectPicker, openBuildWorkspace],
  )

  useLayoutEffect(() => {
    registerAppModeNavApi({
      navigateToRunMode,
      navigateToBuildMode,
      navigateToProjectPicker,
      openBuildWorkspace,
    })
    return () => registerAppModeNavApi(null)
  }, [navigateToRunMode, navigateToBuildMode, navigateToProjectPicker, openBuildWorkspace])

  return <AppShellKindContext.Provider value={value}>{children}</AppShellKindContext.Provider>
}

export function useAppShellKind() {
  const ctx = useContext(AppShellKindContext)
  if (!ctx) throw new Error("useAppShellKind requires AppShellKindProvider")
  return ctx
}

export function useOptionalAppShellKind() {
  return useContext(AppShellKindContext)
}
