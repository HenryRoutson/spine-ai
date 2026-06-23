"use client"

// AI : the client half of the bridge — hydrates from GET /api/state, applies mutations
// AI : optimistically, and persists them through the thin API routes. Exposes the exact
// AI : surface the v2 components were written against (useStore, uid, addDoc, addRun, …).

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
import type {
  BillingPoint,
  DocLabel,
  DocRef,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  Strategy,
  StructureModel,
} from "@/lib/types"
import { DEFAULT_MODEL } from "@/lib/types"
import { billingSeries } from "@/lib/billing"
import { migrateProjectModules, syncAutoQuoteSteps } from "@/lib/quote-steps"

export type BillingAccountView = {
  balanceCents: number
  totalBilledCents: number
  subscribed: boolean
  minRunBalanceCents: number
  topupOptionsCents: number[]
  subCentsPerMonth: number
  billingCapCents: number
}

// AI : generic so `id: uid()` infers branded ids (ModuleId, StructureModelId, …) in place.
function uid<T extends string = string>(): T {
  return Math.random().toString(36).slice(2, 9) as T
}

interface ServerState {
  projects: Project[]
  docs: DocRef[]
  runs: PipelineRun[]
}

interface StoreState {
  projects: Project[]
  activeProjectId: string
  setActiveProjectId: (id: string) => void
  addProject: () => void
  cloneFromTemplate: (templateId: string) => Promise<Project>
  cloneProject: (projectId: string) => Promise<Project>
  resyncExamples: () => Promise<number>
  renameProject: (id: string, name: string) => void
  deleteProject: (id: string) => void
  project: Project
  // shortcuts that read/write the active project
  models: StructureModel[]
  setModels: (m: StructureModel[]) => void
  modules: PipelineModule[]
  setModules: (m: PipelineModule[]) => void
  strategies: Strategy[]
  setStrategies: (s: Strategy[]) => void
  // global model
  model: string
  setModel: (m: string) => void
  // documents — real upload through POST /api/docs (content-hash dedupe server-side)
  docs: DocRef[]
  addDoc: (file: File, label: DocLabel) => Promise<DocRef>
  // runs / logs
  runs: PipelineRun[]
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  // billing (computed from real run history only)
  billing: BillingPoint[]
  billingAccount: BillingAccountView | null
  refreshBilling: () => Promise<void>
  refresh: () => Promise<void>
  prefetchProject: (id: string) => void
  projectLoading: boolean
  saveError: string | null
  clearSaveError: () => void
}

type PrefetchEntry = {
  promise: Promise<ServerState>
  data?: ServerState
}

const StoreContext = createContext<StoreState | null>(null)

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin", ...init })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${url} → ${res.status}`)
  return res.json() as Promise<T>
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [billingAccount, setBillingAccount] = useState<BillingAccountView | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string>("")
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [projectLoading, setProjectLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)
  const prefetchCache = useRef(new Map<string, PrefetchEntry>())

  const clearSaveError = useCallback(() => setSaveError(null), [])

  const persistProject = useCallback(async (id: string, body: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "same-origin",
      })
      if (!res.ok) {
        const msg = (await res.json().catch(() => null))?.error ?? `save failed (${res.status})`
        setSaveError(msg)
        return
      }
      setSaveError(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    }
  }, [])

  const refreshBilling = useCallback(async () => {
    setBillingAccount(await api<BillingAccountView>("/api/billing"))
  }, [])

  const fetchState = useCallback(async (projectId: string) => {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return api<ServerState>(`/api/state${q}`)
  }, [])

  const loadProjectState = useCallback(
    async (projectId: string) => {
      const cached = projectId ? prefetchCache.current.get(projectId) : undefined
      if (cached?.data) {
        prefetchCache.current.delete(projectId)
        return cached.data
      }
      if (cached?.promise) {
        const data = await cached.promise
        prefetchCache.current.delete(projectId)
        return data
      }
      return fetchState(projectId)
    },
    [fetchState],
  )

  const prefetchProject = useCallback(
    (projectId: string) => {
      if (!projectId || projectId === activeProjectId || prefetchCache.current.has(projectId)) return
      const entry: PrefetchEntry = {
        promise: undefined!,
      }
      // AI : warm /api/state on hover so the click reuses an in-flight or finished fetch.
      entry.promise = fetchState(projectId).then((data) => {
        entry.data = data
        return data
      })
      prefetchCache.current.set(projectId, entry)
    },
    [activeProjectId, fetchState],
  )

  const applyState = useCallback(
    (data: ServerState, projectId: string) => {
      setLoadError(null)
      setState(data)
      // AI : first load (or stale id) — pin to the first project so the selector stays in sync.
      if (!projectId || !data.projects.some((p) => p.id === projectId))
        setActiveProjectId(data.projects[0]?.id ?? "")
      refreshBilling().catch(console.error) // AI : billing failure must not block pipeline UI
    },
    [refreshBilling],
  )

  const refresh = useCallback(async (projectId = activeProjectId) => {
    applyState(await fetchState(projectId), projectId)
  }, [activeProjectId, applyState, fetchState])

  useEffect(() => {
    let alive = true
    const cached = activeProjectId ? prefetchCache.current.get(activeProjectId) : undefined
    // AI : after first hydrate, swap main content for a loader while runs/docs re-scope.
    if (hydratedRef.current && activeProjectId && !cached?.data) setProjectLoading(true)

    loadProjectState(activeProjectId)
      .then((data) => {
        if (!alive) return
        applyState(data, activeProjectId)
      })
      .catch((err) => {
        if (alive) setLoadError(err instanceof Error ? err.message : "Failed to load store")
      })
      .finally(() => {
        if (alive) {
          setProjectLoading(false)
          hydratedRef.current = true
        }
      })

    return () => {
      alive = false
    }
    // AI : refetch on project switch so runs/billing re-scope to the active project.
  }, [activeProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI : Stripe Checkout success redirect — confirm session once, then strip query params.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get("session_id")
    const canceled = params.has("canceled")
    if (!sessionId && !canceled) return

    const clean = () => window.history.replaceState({}, "", window.location.pathname)
    if (canceled) {
      clean()
      return
    }
    api<{ creditedCents: number }>("/api/billing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(({ creditedCents }) => refreshBilling().then(() => creditedCents))
      .catch(console.error)
      .finally(clean)
  }, [refreshBilling])

  const projects = state?.projects ?? []
  const project = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? projects[0],
    [projects, activeProjectId],
  )

  // AI : optimistic local update + debounced PUT (builders patch on every keystroke).
  const patchProject = useCallback(
    (patch: Partial<Project>) => {
      setState((prev) => {
        if (!prev) return prev
        const id = activeProjectId || prev.projects[0]?.id
        let next: Project | undefined
        const nextProjects = prev.projects.map((p) => (p.id === id ? (next = { ...p, ...patch }) : p))
        if (next) {
          if (saveTimer.current) clearTimeout(saveTimer.current)
          const body = JSON.stringify(next)
          saveTimer.current = setTimeout(() => {
            void persistProject(id, body)
          }, 500)
        }
        return { ...prev, projects: nextProjects }
      })
    },
    [activeProjectId, persistProject],
  )

  const addProject = useCallback(() => {
    api<Project>("/api/projects", { method: "POST" })
      .then((fresh) => {
        setState((prev) => (prev ? { ...prev, projects: [...prev.projects, fresh] } : prev))
        setActiveProjectId(fresh.id)
      })
      .catch((err) => setSaveError(err instanceof Error ? err.message : "Failed to create project"))
  }, [])

  const cloneFromTemplate = useCallback((templateId: string) => {
    return api<Project>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    })
      .then((fresh) => {
        setState((prev) => (prev ? { ...prev, projects: [...prev.projects, fresh] } : prev))
        setActiveProjectId(fresh.id)
        return fresh
      })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Failed to clone template")
        throw err
      })
  }, [])

  const cloneProjectById = useCallback((cloneFrom: string) => {
    return api<Project>("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cloneFrom }),
    })
      .then((fresh) => {
        setState((prev) => (prev ? { ...prev, projects: [...prev.projects, fresh] } : prev))
        setActiveProjectId(fresh.id)
        return fresh
      })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Failed to clone project")
        throw err
      })
  }, [])

  const resyncExamples = useCallback(() => {
    return api<{ updated: number }>("/api/projects/resync-examples", { method: "POST" })
      .then(async ({ updated }) => {
        await refresh()
        return updated
      })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Failed to refresh examples")
        throw err
      })
  }, [refresh])

  // AI : discrete rename — save immediately (not debounced like builder keystrokes).
  const renameProject = useCallback((id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    setState((prev) => {
      if (!prev) return prev
      const current = prev.projects.find((p) => p.id === id)
      if (!current || current.name === trimmed) return prev
      const next = { ...current, name: trimmed }
      void persistProject(id, JSON.stringify(next))
      return { ...prev, projects: prev.projects.map((p) => (p.id === id ? next : p)) }
    })
  }, [persistProject])

  const deleteProject = useCallback(
    (id: string) => {
      api<{ ok: true }>(`/api/projects/${id}`, { method: "DELETE" })
        .then(() => {
          let nextActiveId: string | undefined
          setState((prev) => {
            if (!prev || prev.projects.length <= 1) return prev
            const nextProjects = prev.projects.filter((p) => p.id !== id)
            if (activeProjectId === id) nextActiveId = nextProjects[0]?.id
            return { ...prev, projects: nextProjects }
          })
          if (nextActiveId) setActiveProjectId(nextActiveId)
        })
        .catch((err) => setSaveError(err instanceof Error ? err.message : "Failed to delete project"))
    },
    [activeProjectId],
  )

  const addDoc = useCallback(async (file: File, label: DocLabel) => {
    const form = new FormData()
    form.append("file", file)
    form.append("label", label)
    const doc = await api<DocRef>("/api/docs", { method: "POST", body: form })
    setState((prev) =>
      prev && !prev.docs.some((d) => d.id === doc.id) ? { ...prev, docs: [doc, ...prev.docs] } : prev,
    )
    return doc
  }, [])

  // AI : the server already persisted the run (run engine) — just mirror it locally.
  const addRun = useCallback((r: PipelineRun) => {
    setState((prev) => (prev ? { ...prev, runs: [r, ...prev.runs] } : prev))
  }, [])

  const updateRunNotes = useCallback(async (runId: PipelineRun["id"], notes: string | undefined) => {
    await api("/api/runs/" + runId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: notes ?? null }),
    })
    setState((prev) => {
      if (!prev) return prev
      const i = prev.runs.findIndex((r) => r.id === runId)
      if (i < 0) return prev
      const next = notes?.trim() ? notes.trim() : undefined
      if (prev.runs[i].notes === next) return prev
      const runs = [...prev.runs]
      runs[i] = { ...runs[i], notes: next }
      return { ...prev, runs }
    })
  }, [])

  const runs = state?.runs ?? []
  const billing = useMemo(() => billingSeries(runs), [runs])

  if (loadError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 bg-background px-6 text-center">
        <p className="font-mono text-xs text-destructive">{loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(null)
            refresh().catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load store"))
          }}
          className="font-mono text-[11px] text-muted-foreground underline"
        >
          retry
        </button>
      </div>
    )
  }

  if (!state || !project) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="font-mono text-xs text-muted-foreground">loading store…</p>
      </div>
    )
  }

  const value: StoreState = {
    projects,
    activeProjectId: project.id,
    setActiveProjectId,
    addProject,
    cloneFromTemplate,
    cloneProject: cloneProjectById,
    resyncExamples,
    renameProject,
    deleteProject,
    project,
    models: project.models,
    setModels: (m) =>
      patchProject({ models: m, modules: syncAutoQuoteSteps(project.modules, m) }),
    modules: migrateProjectModules(project).modules,
    setModules: (m) => patchProject({ modules: syncAutoQuoteSteps(m, project.models) }),
    strategies: project.strategies,
    setStrategies: (s) => patchProject({ strategies: s }),
    model,
    setModel,
    docs: state.docs,
    addDoc,
    runs,
    addRun,
    updateRunNotes,
    billing,
    billingAccount,
    refreshBilling,
    refresh,
    prefetchProject,
    projectLoading,
    saveError,
    clearSaveError,
  }

  return (
    <>
      {saveError && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-[11px] text-destructive"
        >
          <span>Save failed: {saveError}</span>
          <button type="button" onClick={clearSaveError} className="shrink-0 underline">
            dismiss
          </button>
        </div>
      )}
      <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
    </>
  )
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

export { uid }
export type { Project, ProjectId }
