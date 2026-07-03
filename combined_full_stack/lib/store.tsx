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
  DocId,
  DocLabel,
  DocRef,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  RunTestReport,
  Strategy,
  StructureModel,
  StructureModelId,
  TypeAlias,
  TypeAliasId,
  InputType,
} from "@/lib/types"
import { DEFAULT_MODEL } from "@/lib/types"
import { apiJson, apiPut, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { migrateProjectModules, syncAutoQuoteSteps } from "@/lib/quote-steps"
import { stripSharedModels, withSharedModels } from "@/lib/structure"
import { mergeInferredStructuresForDoc, modelsChanged } from "@/lib/sync-doc-structures"
import { docTextContent, fetchDocText, invalidateDocText } from "@/lib/doc-text-cache"
import { mostRecentlyOpenedProject, resolveActiveProject } from "@/lib/project-active"
import { NoProjectsPage } from "@/components/no-projects-page"

export type BillingAccountView = {
  balanceCents: number
  totalBilledCents: number
  totalUsageCents: number
  freeCreditCents: number
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
  allRuns: PipelineRun[]
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
  deleteProject: (id: string) => Promise<void>
  project: Project
  // shortcuts that read/write the active project
  models: StructureModel[]
  setModels: (m: StructureModel[] | ((prev: StructureModel[]) => StructureModel[])) => void
  typeAliases: TypeAlias[]
  setTypeAliases: (t: TypeAlias[] | ((prev: TypeAlias[]) => TypeAlias[])) => void
  modules: PipelineModule[]
  setModules: (m: PipelineModule[]) => void
  // AI : atomic models+modules patch — avoids stale closure when assistant changes both at once
  applyProjectChanges: (changes: {
    models?: StructureModel[]
    modules?: PipelineModule[]
    typeAliases?: TypeAlias[]
  }) => void
  strategies: Strategy[]
  setStrategies: (s: Strategy[]) => void
  documentation: string
  setDocumentation: (text: string) => void
  // global model
  model: string
  setModel: (m: string) => void
  // documents — real upload through POST /api/docs (content-hash dedupe server-side)
  docs: DocRef[]
  addDoc: (file: File, label: DocLabel, projectId?: string) => Promise<DocRef>
  addDocContent: (
    name: string,
    type: InputType,
    content: string,
    label: DocLabel,
    projectId?: string,
  ) => Promise<DocRef>
  removeDoc: (docId: DocId, projectId?: string) => Promise<void>
  setDocProjects: (docId: DocId, projectIds: ProjectId[]) => Promise<void>
  // runs / logs
  runs: PipelineRun[]
  addRun: (r: PipelineRun) => void
  updateRunNotes: (runId: PipelineRun["id"], notes: string | undefined) => Promise<void>
  // AI : persist the Testing-tab verdict (expected vs actual per step) onto the run for Logging.
  updateRunTest: (runId: PipelineRun["id"], test: RunTestReport) => Promise<void>
  // AI : survives Inference tab unmount — doc ids only, resolved against hydrated docs on restore.
  inferenceInputDocIds: Partial<Record<ModuleId, DocId | DocId[]>>
  setInferenceInputDocIds: (docs: Partial<Record<ModuleId, DocId | DocId[]>>) => void
  // billing — run history for spend charts (project-scoped + account-wide)
  billingRuns: PipelineRun[]
  billingAccount: BillingAccountView | null
  refreshBilling: () => Promise<void>
  refresh: () => Promise<void>
  prefetchProject: (id: string) => void
  projectLoading: boolean
  saveError: string | null
  clearSaveError: () => void
  // AI : flush debounced project save immediately — call before startRun to avoid stale server state.
  flushPendingSave: () => Promise<void>
}

type PrefetchEntry = {
  promise: Promise<ServerState>
  data?: ServerState
}

// AI : shared pure computation for auto-inferring structures immediately after any doc upload.
function computeDocStructureSync(
  prev: ServerState,
  pid: string,
  doc: DocRef,
  content: string,
): { nextProjects: Project[]; changed: boolean } {
  const p = prev.projects.find((x) => x.id === pid)
  if (!p) return { nextProjects: prev.projects, changed: false }
  const merged = mergeInferredStructuresForDoc(
    p.models,
    doc,
    content,
    () => uid<StructureModelId>(),
  )
  if (!modelsChanged(p.models, merged)) return { nextProjects: prev.projects, changed: false }
  const models = stripSharedModels(merged)
  const modules = syncAutoQuoteSteps(
    migrateProjectModules(p).modules,
    withSharedModels(models),
  )
  return {
    nextProjects: prev.projects.map((x) => (x.id === pid ? { ...p, models, modules } : x)),
    changed: true,
  }
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
  const pendingSaveRef = useRef<{ id: string; body: string } | null>(null)
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
      setState((prev) => {
        // AI : keep in-flight lastOpenedAt when refetch races the open-stamp PUT
        const mergedProjects = data.projects.map((p) => {
          const local = prev?.projects.find((x) => x.id === p.id)
          if (!local?.lastOpenedAt) return p
          if (!p.lastOpenedAt || local.lastOpenedAt > p.lastOpenedAt) return { ...p, lastOpenedAt: local.lastOpenedAt }
          return p
        })
        return { ...data, projects: mergedProjects }
      })
      const resolved = resolveActiveProject(data.projects, projectId)
      const activeId = resolved?.id ?? ""
      if (!projectId || !data.projects.some((p) => p.id === projectId)) setActiveProjectId(activeId)
      refreshBilling().catch(console.error) // AI : billing failure must not block pipeline UI
    },
    [refreshBilling],
  )

  const stampProjectOpened = useCallback(
    (id: string) => {
      setState((prev) => {
        if (!prev) return prev
        const current = prev.projects.find((p) => p.id === id)
        if (!current) return prev
        const next = { ...current, lastOpenedAt: Date.now() }
        void persistProject(id, JSON.stringify(next))
        return { ...prev, projects: prev.projects.map((p) => (p.id === id ? next : p)) }
      })
    },
    [persistProject],
  )

  const selectActiveProject = useCallback(
    (id: string) => {
      if (id === activeProjectId) return
      stampProjectOpened(id)
      setActiveProjectId(id)
    },
    [activeProjectId, stampProjectOpened],
  )

  const refresh = useCallback(async (projectId = activeProjectId) => {
    applyState(await fetchState(projectId), projectId)
  }, [activeProjectId, applyState, fetchState])

  useEffect(() => {
    let alive = true
    const cached = activeProjectId ? prefetchCache.current.get(activeProjectId) : undefined
    const instant = !!cached?.data
    // AI : prefetched project data applies without blanking the main pane.
    if (hydratedRef.current && activeProjectId && !instant) setProjectLoading(true)

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
          pendingSaveRef.current = { id, body }
          saveTimer.current = setTimeout(() => {
            pendingSaveRef.current = null
            void persistProject(id, body)
          }, 500)
        }
        return { ...prev, projects: nextProjects }
      })
    },
    [activeProjectId, persistProject],
  )

  // AI : cancel the debounce and persist immediately — call before startRun to avoid stale server state.
  const flushPendingSave = useCallback(async () => {
    const pending = pendingSaveRef.current
    if (!pending) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = null
    pendingSaveRef.current = null
    await persistProject(pending.id, pending.body)
  }, [persistProject])

  const postNewProject = useCallback((body: { templateId?: string; cloneFrom?: string }) => {
    return apiJson<Project>(API_ROUTES.projects, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(body),
    })
      .then(async (fresh) => {
        selectActiveProject(fresh.id)
        // AI : clone may ingest/rename bundled seed docs server-side — reload docs + backfilled seedDocNames.
        await refresh(fresh.id)
        return fresh
      })
      .catch((err) => {
        setSaveError(err instanceof Error ? err.message : "Failed to create project")
        throw err
      })
  }, [refresh, selectActiveProject])

  const addProject = useCallback(() => {
    void postNewProject({}).catch((err) =>
      setSaveError(err instanceof Error ? err.message : "Failed to create project"),
    )
  }, [postNewProject])

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
    (id: string): Promise<void> =>
      apiJson<{ ok: true }>(API_ROUTES.project(id), { method: "DELETE" })
        .then(() => {
          // AI : deleting the last project is allowed — zero projects renders NoProjectsPage below.
          let nextActiveId: string | undefined
          let emptied = false
          setState((prev) => {
            if (!prev) return prev
            const nextProjects = prev.projects.filter((p) => p.id !== id)
            emptied = nextProjects.length === 0
            if (activeProjectId === id) nextActiveId = mostRecentlyOpenedProject(nextProjects)?.id
            return { ...prev, projects: nextProjects }
          })
          if (nextActiveId) selectActiveProject(nextActiveId)
          else if (emptied) setActiveProjectId("")
        })
        .catch((err) => {
          setSaveError(err instanceof Error ? err.message : "Failed to delete project")
          throw err
        }),
    [activeProjectId, selectActiveProject],
  )

  const addDoc = useCallback(async (file: File, label: DocLabel, projectId?: string) => {
    const blocked = confidentialUploadWarning(file.name)
    if (blocked) throw new Error(blocked)

    const form = new FormData()
    form.append("file", file)
    form.append("label", label)
    if (projectId) form.append("projectId", projectId)
    const doc = await apiJson<DocRef>(API_ROUTES.docs, { method: "POST", body: form })
    invalidateDocText(doc.id)
    const pid = projectId ?? activeProjectId

    setState((prev) => {
      if (!prev) return prev
      const hasDoc = prev.docs.some((d) => d.id === doc.id)
      const nextDocs = hasDoc ? prev.docs : [doc, ...prev.docs]
      if (!pid) return hasDoc ? prev : { ...prev, docs: nextDocs }
      const names = prev.projects.find((p) => p.id === pid)?.seedDocNames ?? []
      if (names.includes(doc.name)) return hasDoc ? prev : { ...prev, docs: nextDocs }
      const nextProjects = prev.projects.map((p) =>
        p.id === pid ? { ...p, seedDocNames: [...(p.seedDocNames ?? []), doc.name] } : p,
      )
      return { ...prev, docs: nextDocs, projects: nextProjects }
    })

    if (pid) {
      try {
        const data = await fetchDocText(doc.id)
        const content = docTextContent(data)
        setState((prev) => {
          if (!prev) return prev
          const { nextProjects, changed } = computeDocStructureSync(prev, pid, doc, content)
          if (!changed) return prev
          if (saveTimer.current) clearTimeout(saveTimer.current)
          const body = JSON.stringify(nextProjects.find((x) => x.id === pid))
          saveTimer.current = setTimeout(() => { void persistProject(pid, body!) }, 500)
          return { ...prev, projects: nextProjects }
        })
      } catch (err) {
        console.error("structure sync after upload failed", err)
      }
    }

    return doc
  }, [activeProjectId, persistProject])

  const addDocContent = useCallback(
    async (
      name: string,
      type: InputType,
      content: string,
      label: DocLabel,
      projectId?: string,
    ) => {
      const blocked = confidentialUploadWarning(name)
      if (blocked) throw new Error(blocked)

      const doc = await apiJson<DocRef>(API_ROUTES.docsContent, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name, type, content, label, projectId: projectId ?? activeProjectId }),
      })
      invalidateDocText(doc.id)
      const pid = projectId ?? activeProjectId

      setState((prev) => {
        if (!prev) return prev
        const hasDoc = prev.docs.some((d) => d.id === doc.id)
        const nextDocs = hasDoc ? prev.docs : [doc, ...prev.docs]
        if (!pid) return hasDoc ? prev : { ...prev, docs: nextDocs }
        const names = prev.projects.find((p) => p.id === pid)?.seedDocNames ?? []
        if (names.includes(doc.name)) return hasDoc ? prev : { ...prev, docs: nextDocs }
        const nextProjects = prev.projects.map((p) =>
          p.id === pid ? { ...p, seedDocNames: [...(p.seedDocNames ?? []), doc.name] } : p,
        )
        return { ...prev, docs: nextDocs, projects: nextProjects }
      })

      if (pid) {
        try {
          setState((prev) => {
            if (!prev) return prev
            const { nextProjects, changed } = computeDocStructureSync(prev, pid, doc, content)
            if (!changed) return prev
            if (saveTimer.current) clearTimeout(saveTimer.current)
            const body = JSON.stringify(nextProjects.find((x) => x.id === pid))
            saveTimer.current = setTimeout(() => { void persistProject(pid, body!) }, 500)
            return { ...prev, projects: nextProjects }
          })
        } catch (err) {
          console.error("structure sync after content upload failed", err)
        }
      }

      return doc
    },
    [activeProjectId, persistProject],
  )

  const removeDoc = useCallback(async (docId: DocId, projectId?: string) => {
    const pid = projectId ?? activeProjectId
    const q = pid ? `?projectId=${encodeURIComponent(pid)}` : ""
    await apiJson<{ ok: true }>(`${API_ROUTES.doc(docId)}${q}`, { method: "DELETE" })
    invalidateDocText(docId)
    setState((prev) => {
      if (!prev) return prev
      const doc = prev.docs.find((d) => d.id === docId)
      if (!doc) return prev
      const p = pid ? prev.projects.find((x) => x.id === pid) : undefined
      const names = p?.seedDocNames ?? []
      const unlinked = names.includes(doc.name)
      const nextProjects =
        unlinked && p
          ? prev.projects.map((x) =>
              x.id === pid ? { ...p, seedDocNames: names.filter((n) => n !== doc.name) } : x,
            )
          : prev.projects
      const stillLinked = prev.projects.some(
        (x) => x.id !== pid && (x.seedDocNames?.includes(doc.name) ?? false),
      )
      if (stillLinked) return { ...prev, projects: nextProjects }
      return {
        ...prev,
        docs: prev.docs.filter((d) => d.id !== docId),
        projects: nextProjects,
      }
    })
  }, [activeProjectId])

  const setDocProjects = useCallback(async (docId: DocId, projectIds: ProjectId[]) => {
    const { projectIds: saved } = await apiJson<{ projectIds: ProjectId[] }>(API_ROUTES.doc(docId), {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ projectIds }),
    })
    setState((prev) => {
      if (!prev) return prev
      const doc = prev.docs.find((d) => d.id === docId)
      if (!doc) return prev
      const want = new Set(saved)
      const nextProjects = prev.projects.map((p) => {
        const names = p.seedDocNames ?? []
        const has = names.includes(doc.name)
        const should = want.has(p.id)
        if (has === should) return p
        return {
          ...p,
          seedDocNames: should ? [...names, doc.name] : names.filter((n) => n !== doc.name),
        }
      })
      const stillLinked = nextProjects.some((p) => p.seedDocNames?.includes(doc.name))
      return {
        ...prev,
        projects: nextProjects,
        docs: stillLinked ? prev.docs : prev.docs.filter((d) => d.id !== docId),
      }
    })
  }, [])

  // AI : the server already persisted the run (run engine) — just mirror it locally.
  const addRun = useCallback((r: PipelineRun) => {
    setState((prev) => {
      if (!prev || prev.runs.some((x) => x.id === r.id)) return prev
      const allRuns = prev.allRuns.some((x) => x.id === r.id) ? prev.allRuns : [r, ...prev.allRuns]
      return { ...prev, runs: [r, ...prev.runs], allRuns }
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

  const updateRunTest = useCallback(async (runId: PipelineRun["id"], test: RunTestReport) => {
    await apiJson(API_ROUTES.run(runId), {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ test }),
    })
    setState((prev) => {
      if (!prev) return prev
      const i = prev.runs.findIndex((r) => r.id === runId)
      if (i < 0) return prev
      const runs = [...prev.runs]
      runs[i] = { ...runs[i], test }
      return { ...prev, runs }
    })
  }, [])

  const runs = state?.runs ?? []
  const billingRuns = state?.allRuns ?? state?.runs ?? []
  const modules = useMemo(
    () => (project ? migrateProjectModules(project).modules : []),
    [project],
  )

  const setModels = useCallback(
    (m: StructureModel[] | ((prev: StructureModel[]) => StructureModel[])) => {
      if (!project) return
      const prev = stripSharedModels(project.models)
      const raw = typeof m === "function" ? m(prev) : m
      const nextModels = stripSharedModels(raw)
      patchProject({
        models: nextModels,
        modules: syncAutoQuoteSteps(project.modules, withSharedModels(nextModels)),
      })
    },
    [patchProject, project],
  )

  const setTypeAliases = useCallback(
    (t: TypeAlias[] | ((prev: TypeAlias[]) => TypeAlias[])) => {
      const prev = project?.typeAliases ?? []
      const next = typeof t === "function" ? t(prev) : t
      patchProject({ typeAliases: next })
    },
    [patchProject, project],
  )

  const setModules = useCallback(
    (m: PipelineModule[]) => {
      if (!project) return
      patchProject({ modules: syncAutoQuoteSteps(m, project.models) })
    },
    [patchProject, project],
  )

  const applyProjectChanges = useCallback(
    (changes: {
      models?: StructureModel[]
      modules?: PipelineModule[]
      typeAliases?: TypeAlias[]
    }) => {
      if (!project || (!changes.models && !changes.modules && !changes.typeAliases)) return

      const nextModels = changes.models ? stripSharedModels(changes.models) : project.models
      const modelsForSync = withSharedModels(nextModels)
      const nextModules = changes.modules
        ? syncAutoQuoteSteps(changes.modules, modelsForSync)
        : changes.models
          ? syncAutoQuoteSteps(project.modules, modelsForSync)
          : undefined

      patchProject({
        ...(changes.models ? { models: nextModels } : {}),
        ...(changes.typeAliases ? { typeAliases: changes.typeAliases } : {}),
        ...(nextModules !== undefined ? { modules: nextModules } : {}),
      })
    },
    [patchProject, project],
  )

  const setStrategies = useCallback(
    (s: Strategy[]) => {
      patchProject({ strategies: s })
    },
    [patchProject],
  )

  const setDocumentation = useCallback(
    (text: string) => {
      patchProject({ documentation: text || undefined })
    },
    [patchProject],
  )

  const boundSetInferenceInputDocIds = useCallback(
    (docs: Partial<Record<ModuleId, DocId | DocId[]>>) => {
      if (!project) return
      setInferenceInputDocIds(project.id, docs)
    },
    [project, setInferenceInputDocIds],
  )

  const value = useMemo<StoreState | null>(() => {
    if (!state || !project) return null
    return {
      projects,
      activeProjectId: project.id,
      setActiveProjectId: selectActiveProject,
      addProject,
      cloneFromTemplate,
      cloneProject: cloneProjectById,
      resyncExamples,
      renameProject,
      deleteProject,
      project,
      models: project.models,
      setModels,
      typeAliases: project.typeAliases ?? [],
      setTypeAliases,
      modules,
      setModules,
      applyProjectChanges,
      strategies: project.strategies,
      setStrategies,
      documentation: project.documentation ?? "",
      setDocumentation,
      model,
      setModel,
      docs: state.docs,
      addDoc,
      addDocContent,
      removeDoc,
      setDocProjects,
      runs,
      addRun,
      updateRunNotes,
      updateRunTest,
      inferenceInputDocIds: inferenceInputsByProject[project.id] ?? {},
      setInferenceInputDocIds: boundSetInferenceInputDocIds,
      billingRuns,
      billingAccount,
      refreshBilling,
      refresh,
      prefetchProject,
      projectLoading,
      saveError,
      clearSaveError,
      flushPendingSave,
    }
  }, [
    state,
    projects,
    project,
    modules,
    setModels,
    setTypeAliases,
    setModules,
    applyProjectChanges,
    setStrategies,
    setDocumentation,
    model,
    addDoc,
    addDocContent,
    removeDoc,
    setDocProjects,
    runs,
    addRun,
    updateRunNotes,
    updateRunTest,
    inferenceInputsByProject,
    boundSetInferenceInputDocIds,
    billingRuns,
    billingAccount,
    refreshBilling,
    refresh,
    prefetchProject,
    projectLoading,
    saveError,
    clearSaveError,
    flushPendingSave,
    addProject,
    cloneFromTemplate,
    cloneProjectById,
    resyncExamples,
    renameProject,
    deleteProject,
    selectActiveProject,
  ])

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

  const saveErrorBanner = saveError ? (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 font-mono text-[11px] text-destructive"
    >
      <span>Save failed: {saveError}</span>
      <button type="button" onClick={clearSaveError} className="shrink-0 underline">
        dismiss
      </button>
    </div>
  ) : null

  // AI : zero projects is valid — replace the whole app shell (no sub tabs) with an empty-state page.
  if (state && migratedProjects.length === 0) {
    return (
      <>
        {saveErrorBanner}
        <NoProjectsPage onCreateBlank={addProject} onCloneTemplate={cloneFromTemplate} />
      </>
    )
  }

  if (!state || !project || !value) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="font-mono text-xs text-muted-foreground">loading store…</p>
      </div>
    )
  }

  return (
    <>
      {saveErrorBanner}
      <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
    </>
  )
}

export function useOptionalStore() {
  return useContext(StoreContext)
}

export function useStore() {
  const ctx = useOptionalStore()
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}

export { uid }
export type { Project, ProjectId }
