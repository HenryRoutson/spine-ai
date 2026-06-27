"use client"

// AI : TODO refactor — optional split: persistence, billing refresh, project CRUD into separate hooks.
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
import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { uid } from "@/lib/id"
import type {
  BillingPoint,
  DocId,
  DocLabel,
  DocRef,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  Strategy,
  StructureModel,
} from "@/lib/types"
import { DEFAULT_MODEL } from "@/lib/types"
import { billingSeries } from "@/lib/billing"
import { apiJson, apiPut, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { migrateProjectModules, syncAutoQuoteSteps } from "@/lib/quote-steps"
import { stripSharedModels, withSharedModels } from "@/lib/structure"

export type BillingAccountView = {
  balanceCents: number
  totalBilledCents: number
  subscribed: boolean
  minRunBalanceCents: number
  topupOptionsCents: number[]
  subCentsPerMonth: number
  billingCapCents: number
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
  addDoc: (file: File, label: DocLabel, projectId?: string) => Promise<DocRef>
  // runs / logs
  runs: PipelineRun[]
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  // AI : survives Inference tab unmount — doc ids only, resolved against hydrated docs on restore.
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId | DocId[]>>) => void
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [billingAccount, setBillingAccount] = useState<BillingAccountView | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string>("")
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const [projectLoading, setProjectLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [inferenceInputsByProject, setInferenceInputsByProject] = useState<
    Record<string, Partial<Record<ModuleId, DocId | DocId[]>>>
  >({})
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)
  const prefetchCache = useRef(new Map<string, PrefetchEntry>())

  const clearSaveError = useCallback(() => setSaveError(null), [])

  const persistProject = useCallback(async (id: string, body: string) => {
    const result = await apiPut(API_ROUTES.project(id), body)
    if (!result.ok) {
      setSaveError(result.error)
      return
    }
    setSaveError(null)
  }, [])

  const refreshBilling = useCallback(async () => {
    setBillingAccount(await apiJson<BillingAccountView>(API_ROUTES.billing))
  }, [])

  const fetchState = useCallback(async (projectId: string) => {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    return apiJson<ServerState>(`${API_ROUTES.state}${q}`)
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
    // AI : always gate the main shell on project switch — prefetched data still needs applyState.
    if (hydratedRef.current && activeProjectId) setProjectLoading(true)

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

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

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
    apiJson<{ creditedCents: number }>(API_ROUTES.billingConfirm, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ sessionId }),
    })
      .then(({ creditedCents }) => refreshBilling().then(() => creditedCents))
      .catch(console.error)
      .finally(clean)
  }, [refreshBilling])

  const projects = state?.projects ?? []
  const migratedProjects = useMemo(
    () => projects.map((p) => migrateProjectModules(p)),
    [projects],
  )
  const project = useMemo(
    () => migratedProjects.find((p) => p.id === activeProjectId) ?? migratedProjects[0],
    [migratedProjects, activeProjectId],
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
    apiJson<Project>(API_ROUTES.projects, { method: "POST" })
      .then((fresh) => {
        setState((prev) => (prev ? { ...prev, projects: [...prev.projects, fresh] } : prev))
        setActiveProjectId(fresh.id)
      })
      .catch((err) => setSaveError(err instanceof Error ? err.message : "Failed to create project"))
  }, [])

  const postNewProject = useCallback((body: { templateId?: string; cloneFrom?: string }) => {
    return apiJson<Project>(API_ROUTES.projects, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
      .then((fresh) => {
        setState((prev) => (prev ? { ...prev, projects: [...prev.projects, fresh] } : prev))
        setActiveProjectId(fresh.id)
        return fresh
      })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Failed to create project")
        throw err
      })
  }, [])

  const cloneFromTemplate = useCallback(
    (templateId: string) => postNewProject({ templateId }),
    [postNewProject],
  )

  const cloneProjectById = useCallback(
    (cloneFrom: string) => postNewProject({ cloneFrom }),
    [postNewProject],
  )

  const resyncExamples = useCallback(() => {
    return apiJson<{ updated: number }>(API_ROUTES.projectsResyncExamples, { method: "POST" })
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
      apiJson<{ ok: true }>(API_ROUTES.project(id), { method: "DELETE" })
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

  const addDoc = useCallback(async (file: File, label: DocLabel, projectId?: string) => {
    const blocked = confidentialUploadWarning(file.name)
    if (blocked) throw new Error(blocked)

    const form = new FormData()
    form.append("file", file)
    form.append("label", label)
    if (projectId) form.append("projectId", projectId)
    const doc = await apiJson<DocRef>(API_ROUTES.docs, { method: "POST", body: form })
    setState((prev) => {
      if (!prev) return prev
      const hasDoc = prev.docs.some((d) => d.id === doc.id)
      const nextDocs = hasDoc ? prev.docs : [doc, ...prev.docs]
      const pid = projectId ?? activeProjectId
      if (!pid) return hasDoc ? prev : { ...prev, docs: nextDocs }
      const names = prev.projects.find((p) => p.id === pid)?.seedDocNames ?? []
      if (names.includes(doc.name)) return hasDoc ? prev : { ...prev, docs: nextDocs }
      const nextProjects = prev.projects.map((p) =>
        p.id === pid ? { ...p, seedDocNames: [...(p.seedDocNames ?? []), doc.name] } : p,
      )
      return { ...prev, docs: nextDocs, projects: nextProjects }
    })
    return doc
  }, [activeProjectId])

  // AI : the server already persisted the run (run engine) — just mirror it locally.
  const addRun = useCallback((r: PipelineRun) => {
    setState((prev) => {
      if (!prev || prev.runs.some((x) => x.id === r.id)) return prev
      return { ...prev, runs: [r, ...prev.runs] }
    })
  }, [])

  const setInferenceInputDocIds = useCallback(
    (projectId: string, docs: Partial<Record<ModuleId, DocId | DocId[]>>) => {
      setInferenceInputsByProject((prev) => ({ ...prev, [projectId]: docs }))
    },
    [],
  )

  const updateRunNotes = useCallback(async (runId: PipelineRun["id"], notes: string | undefined) => {
    await apiJson(API_ROUTES.run(runId), {
      method: "PATCH",
      headers: JSON_HEADERS,
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
    setModels: (m) => {
      const models = stripSharedModels(m)
      patchProject({
        models,
        modules: syncAutoQuoteSteps(project.modules, withSharedModels(models)),
      })
    },
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
    inferenceInputDocIds: inferenceInputsByProject[project.id] ?? {},
    setInferenceInputDocIds: (docs) => setInferenceInputDocIds(project.id, docs),
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
