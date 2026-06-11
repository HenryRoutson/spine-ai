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

export type BillingAccountView = {
  balanceCents: number
  totalBilledCents: number
  subscribed: boolean
  useCostCents: number
  topupCents: number
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
  // billing (computed from real run history; seeded series until runs exist)
  billing: BillingPoint[]
  billingAccount: BillingAccountView | null
  refreshBilling: () => Promise<void>
  refresh: () => Promise<void>
}

const StoreContext = createContext<StoreState | null>(null)

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `${url} → ${res.status}`)
  return res.json() as Promise<T>
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ServerState | null>(null)
  const [billingAccount, setBillingAccount] = useState<BillingAccountView | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string>("")
  const [model, setModel] = useState<string>(DEFAULT_MODEL)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refreshBilling = useCallback(async () => {
    setBillingAccount(await api<BillingAccountView>("/api/billing"))
  }, [])

  const refresh = useCallback(async (projectId = activeProjectId) => {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
    const data = await api<ServerState>(`/api/state${q}`)
    setState(data)
    // AI : first load (or stale id) — pin to the first project so the selector stays in sync.
    if (!projectId || !data.projects.some((p) => p.id === projectId))
      setActiveProjectId(data.projects[0]?.id ?? "")
    refreshBilling().catch(console.error) // AI : billing failure must not block pipeline UI
  }, [activeProjectId, refreshBilling])

  useEffect(() => {
    refresh().catch(console.error)
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
            fetch(`/api/projects/${id}`, { method: "PUT", body }).catch(console.error)
          }, 500)
        }
        return { ...prev, projects: nextProjects }
      })
    },
    [activeProjectId],
  )

  const addProject = useCallback(() => {
    api<Project>("/api/projects", { method: "POST" })
      .then((fresh) => {
        setState((prev) => (prev ? { ...prev, projects: [...prev.projects, fresh] } : prev))
        setActiveProjectId(fresh.id)
      })
      .catch(console.error)
  }, [])

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

  const runs = state?.runs ?? []
  const billing = useMemo(() => billingSeries(runs), [runs])

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
    project,
    models: project.models,
    setModels: (m) => patchProject({ models: m }),
    modules: project.modules,
    setModules: (m) => patchProject({ modules: m }),
    strategies: project.strategies,
    setStrategies: (s) => patchProject({ strategies: s }),
    model,
    setModel,
    docs: state.docs,
    addDoc,
    runs,
    addRun,
    billing,
    billingAccount,
    refreshBilling,
    refresh,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

export { uid }
export type { Project, ProjectId }
