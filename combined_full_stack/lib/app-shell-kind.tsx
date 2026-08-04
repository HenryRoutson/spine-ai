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
import { isDemoRoute } from "@/lib/demo-mode"
import { getStoreNavigationBridge } from "@/lib/store-navigation-bridge"
import type { ProjectId } from "@/lib/types"

export enum AppShellKind {
  Consumer = "consumer",
  Builder = "builder",
  Picker = "picker",
}

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
  if (typeof window === "undefined") return AppShellKind.Consumer
  if (readActiveProjectSession()) return AppShellKind.Builder
  return AppShellKind.Consumer
}

export function AppShellKindProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [shellKind, setShellKind] = useState<AppShellKind>(AppShellKind.Consumer)
  const [hydrated, setHydrated] = useState(false)

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shellParam = params.get("shell")
    const windowParam = params.get("window")
    const demoRoute = pathname.startsWith("/demo")
    let next: AppShellKind = demoRoute
      ? AppShellKind.Builder
      : pathname.startsWith("/projects") || shellParam === "picker"
        ? AppShellKind.Picker
        : resolveShellKindFromSession()

    if (windowParam === "billing" || windowParam === "settings") {
      if (next === AppShellKind.Picker) next = AppShellKind.Consumer
    }

    setShellKind(next)
    setHydrated(true)

    // AI : leaving /demo for / requires auth — shell switches on /demo must not change the route.
    if (!demoRoute && (shellParam || pathname.startsWith("/projects"))) {
      router.replace("/", { scroll: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const navigateToRunMode = useCallback(() => {
    const nav = getStoreNavigationBridge()
    nav?.leaveBuilder()
    clearActiveProjectSession()
    setShellKind(AppShellKind.Consumer)
    if (!isDemoRoute()) router.replace("/", { scroll: false })
  }, [router])

  const navigateToBuildMode = useCallback(() => {
    const sessionId = readActiveProjectSession()
    if (sessionId) {
      const nav = getStoreNavigationBridge()
      nav?.enterBuilder(sessionId)
      setShellKind(AppShellKind.Builder)
      if (!isDemoRoute()) router.replace("/", { scroll: false })
      return
    }
    const nav = getStoreNavigationBridge()
    nav?.enterPicker()
    setShellKind(AppShellKind.Picker)
    if (!isDemoRoute()) router.replace("/", { scroll: false })
  }, [router])

  const navigateToProjectPicker = useCallback(() => {
    const nav = getStoreNavigationBridge()
    nav?.enterPicker()
    setShellKind(AppShellKind.Picker)
    if (!isDemoRoute()) router.replace("/", { scroll: false })
  }, [router])

  const openBuildWorkspace = useCallback(
    (projectId: ProjectId) => {
      const nav = getStoreNavigationBridge()
      nav?.enterBuilder(projectId)
      setShellKind(AppShellKind.Builder)
      if (!isDemoRoute()) router.replace("/", { scroll: false })
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
