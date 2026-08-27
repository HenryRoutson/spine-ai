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
import { isPickerEntryPath, pickerHomeHref, pickerListFromPathname, pickerListFromSearch, peekPendingPickerList, writePendingPickerList, type picker_list_tab } from "@/lib/picker-list"
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
  navigateToProjectPicker: (tab?: picker_list_tab) => void
  openBuildWorkspace: (projectId: ProjectId) => void
}

const AppShellKindContext = createContext<AppShellKindContextValue | null>(null)

function resolveShellKindFromSession(): AppShellKind {
  if (typeof window === "undefined") return AppShellKind.Consumer
  if (isDemoRoute()) return AppShellKind.Builder
  if (readActiveProjectSession()) return AppShellKind.Builder
  return AppShellKind.Consumer
}

export function AppShellKindProvider({
  children,
  initialKind,
}: {
  children: ReactNode
  initialKind?: AppShellKind
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [shellKind, setShellKind] = useState<AppShellKind>(
    () => initialKind ?? resolveShellKindFromSession(),
  )
  const [hydrated, setHydrated] = useState(false)

  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shellParam = params.get("shell")
    const windowParam = params.get("window")
    const demoRoute = isDemoRoute() || pathname.startsWith("/demo")
    const pickerList =
      pickerListFromPathname(pathname) ?? pickerListFromSearch(window.location.search)
    let next: AppShellKind = demoRoute
      ? AppShellKind.Builder
      : isPickerEntryPath(pathname) || shellParam === "picker" || pickerList != null
        ? AppShellKind.Picker
        : resolveShellKindFromSession()

    if (windowParam === "billing" || windowParam === "settings") {
      if (next === AppShellKind.Picker) next = AppShellKind.Consumer
    }

    setShellKind(next)
    setHydrated(true)

    // AI : leaving /demo for / requires auth — shell switches on /demo must not change the route.
    if (!demoRoute && (shellParam || isPickerEntryPath(pathname))) {
      router.replace(pickerHomeHref(pickerList ?? "pipelines"), { scroll: false })
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
    if (!isDemoRoute()) router.replace(pickerHomeHref("pipelines"), { scroll: false })
  }, [router])

  const navigateToProjectPicker = useCallback((tab?: picker_list_tab) => {
    const next = tab ?? peekPendingPickerList() ?? "pipelines"
    writePendingPickerList(next)
    const nav = getStoreNavigationBridge()
    nav?.enterPicker()
    setShellKind(AppShellKind.Picker)
    if (isDemoRoute()) return
    const href = pickerHomeHref(next)
    if (typeof window !== "undefined") window.history.replaceState(null, "", href)
    router.replace(href, { scroll: false })
  }, [router])

  const openBuildWorkspace = useCallback(
    (projectId: ProjectId) => {
      const nav = getStoreNavigationBridge()
      nav?.enterBuilder(projectId)
      setShellKind(AppShellKind.Builder)
      if (isDemoRoute()) return
      // AI : dropping ?list= via router.replace remounts AppShell and wipes the website studio.
      if (typeof window !== "undefined" && window.location.pathname === "/") {
        if (window.location.search) window.history.replaceState(null, "", "/")
        return
      }
      router.replace("/", { scroll: false })
    },
    [router],
  )

  const value = useMemo(
    () => ({
      shellKind: hydrated ? shellKind : (initialKind ?? resolveShellKindFromSession()),
      setShellKind,
      navigateToRunMode,
      navigateToBuildMode,
      navigateToProjectPicker,
      openBuildWorkspace,
    }),
    [hydrated, initialKind, shellKind, navigateToRunMode, navigateToBuildMode, navigateToProjectPicker, openBuildWorkspace],
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
