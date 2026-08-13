// AI : vanilla store matching useStore() names — React/CLI/MCP subscribe; persist is a port.

import { createHash } from "node:crypto"
import { uid } from "@/lib/id"
import { UNNAMED_PROJECT_NAME } from "@/lib/project-assistant-types"
import { findQuote } from "@/lib/quotes"
import { stripBuiltinTypeAliases, stripSharedModels, withBuiltinTypeAliases, withSharedModels } from "@/lib/structure"
import { syncManagedPipelineSteps } from "@/lib/structure-parse-steps"
import { DEFAULT_MODEL, DocLabel, InputType, ModuleKind } from "@/lib/types"
import type {
  DocId,
  DocRef,
  ModuleId,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  StructureModel,
  TypeAlias,
} from "@/lib/types"
import {
  attachRealtimePort,
  overlayOptimisticProjects,
  overlayOptimisticRuns,
  type RealtimePort,
  type TeamRealtimeHandlers,
} from "@/lib/core/realtime"
import { toQuoteView, toValidationView, type QuoteView, type ValidationView } from "@/lib/core/view"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type {
  AddDocContentInput,
  EgressPort,
  LinkQuotesInput,
  PersistPort,
  ProjectCreateOpts,
  ProjectPatch,
  SessionChatTurn,
  SessionSnapshot,
} from "@/lib/core/types"

export type SpineSessionOpts = {
  persist?: PersistPort
  egress?: EgressPort
  now?: () => number
}

export function emptySessionSnapshot(): SessionSnapshot {
  return {
    projects: [],
    docs: [],
    docContents: {},
    runs: [],
    activeProjectId: "",
    model: DEFAULT_MODEL,
    inferenceInputDocIds: {},
    pendingCreates: [],
    deletedProjectIds: [],
    chat: [],
    pendingProposal: null,
  }
}

function blankProject(now: number): Project {
  const id = uid<ProjectId>("p_")
  return {
    id,
    name: UNNAMED_PROJECT_NAME,
    kind: "blank",
    createdAt: now,
    lastOpenedAt: now,
    models: [],
    modules: [
      {
        id: `mod_blank_in_${id}` as ModuleId,
        kind: ModuleKind.Input,
        label: "Input",
        note: "Pipeline input document",
        inputType: InputType.Text,
        cached: true,
        avgMs: 80,
        avgCostCents: 0,
      },
      {
        id: `mod_blank_out_${id}` as ModuleId,
        kind: ModuleKind.Output,
        label: "Output",
        note: "",
        cached: true,
        avgMs: 40,
        avgCostCents: 0,
      },
    ],
    strategies: [],
  }
}

function hashContent(content: string): DocId {
  return (`sha_${createHash("sha256").update(content).digest("hex").slice(0, 16)}`) as DocId
}

function nextNumberedCloneName(baseName: string, existingNames: Iterable<string>): string {
  const names = new Set(existingNames)
  let n = 1
  while (names.has(`${baseName} ${n}`)) n += 1
  return `${baseName} ${n}`
}

export class SpineSession {
  // AI : TODO (cli-parity vs useStore) — missing methods: cloneFromTemplate, resyncExamples,
  // AI :   addDoc(File), setDocProjects, addRun, updateRunNotes, updateRunTest, hydrateRunDetail,
  // AI :   startRun / runTest, flushPendingSave (Supabase PUT), refreshBilling / refreshEarnings,
  // AI :   setStrategies, persist original bytes, prefetchProject.
  private snap: SessionSnapshot
  private readonly listeners = new Set<() => void>()
  private readonly persist: PersistPort | undefined
  readonly egress: EgressPort | undefined
  private readonly now: () => number
  private realtimeStop: (() => void) | undefined

  constructor(opts: SpineSessionOpts = {}) {
    this.persist = opts.persist
    this.egress = opts.egress
    this.now = opts.now ?? Date.now
    this.snap = { ...emptySessionSnapshot(), ...(opts.persist?.load() ?? {}) }
  }

  getSnapshot(): SessionSnapshot {
    return this.snap
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get projects(): Project[] {
    return this.snap.projects
  }

  get activeProjectId(): string {
    return this.snap.activeProjectId
  }

  get project(): Project | undefined {
    return this.snap.projects.find((p) => p.id === this.snap.activeProjectId) ?? this.snap.projects[0]
  }

  get models(): StructureModel[] {
    return withSharedModels(this.project?.models ?? [])
  }

  get typeAliases(): TypeAlias[] {
    return withBuiltinTypeAliases(this.project?.typeAliases ?? [])
  }

  get modules(): PipelineModule[] {
    return this.project?.modules ?? []
  }

  get documentation(): string {
    return this.project?.documentation ?? ""
  }

  get docs(): DocRef[] {
    return this.snap.docs
  }

  get runs(): PipelineRun[] {
    return this.snap.runs
  }

  get model(): string {
    return this.snap.model
  }

  get chat(): SessionChatTurn[] {
    return this.snap.chat
  }

  get pendingProposal(): ProjectProposal | null {
    return this.snap.pendingProposal
  }

  private commit(next: SessionSnapshot): void {
    this.snap = next
    this.persist?.save(next)
    for (const listener of this.listeners) listener()
  }

  private requireProject(): Project {
    const project = this.project
    if (!project) throw new Error("no active project")
    return project
  }

  setActiveProjectId(id: string): void {
    if (id && !this.snap.projects.some((p) => p.id === id)) return
    this.commit({
      ...this.snap,
      activeProjectId: id,
      projects: this.snap.projects.map((p) => (p.id === id ? { ...p, lastOpenedAt: this.now() } : p)),
    })
  }

  openProject(id: ProjectId | string): void {
    this.setActiveProjectId(id)
  }

  addProject(opts?: ProjectCreateOpts): Project {
    const open = opts?.open !== false
    const fresh = blankProject(this.now())
    const pendingCreates = [...this.snap.pendingCreates.filter((p) => p.id !== fresh.id), fresh]
    const deletedProjectIds = this.snap.deletedProjectIds.filter((id) => id !== fresh.id)
    const projects = overlayOptimisticProjects(
      [...this.snap.projects, fresh],
      pendingCreates,
      deletedProjectIds,
    )
    this.commit({
      ...this.snap,
      projects,
      pendingCreates,
      deletedProjectIds,
      activeProjectId: open ? fresh.id : this.snap.activeProjectId,
    })
    return fresh
  }

  cloneProject(projectId: string, opts?: ProjectCreateOpts): Project {
    const source = this.snap.projects.find((p) => p.id === projectId)
    if (!source) throw new Error(`unknown project ${projectId}`)
    const open = opts?.open !== false
    const id = uid<ProjectId>("p_")
    const now = this.now()
    const { teamReadOnly: _ro, teamProjectOwnerId: _owner, ...body } = source
    const fresh: Project = {
      ...structuredClone(body),
      id,
      name: nextNumberedCloneName(source.name, this.snap.projects.map((p) => p.name)),
      createdAt: now,
      lastOpenedAt: now,
      teamId: undefined,
    }
    const pendingCreates = [...this.snap.pendingCreates, fresh]
    this.commit({
      ...this.snap,
      projects: overlayOptimisticProjects([...this.snap.projects, fresh], pendingCreates, this.snap.deletedProjectIds),
      pendingCreates,
      activeProjectId: open ? fresh.id : this.snap.activeProjectId,
    })
    return fresh
  }

  // AI : load a seed/disk project into the session without going through blankProject.
  ingestProject(source: Project, opts?: ProjectCreateOpts): Project {
    const open = opts?.open !== false
    const id = uid<ProjectId>("p_")
    const now = this.now()
    const { teamReadOnly: _ro, teamProjectOwnerId: _owner, ...body } = source
    const fresh: Project = {
      ...structuredClone(body),
      id,
      createdAt: now,
      lastOpenedAt: now,
      teamId: undefined,
    }
    const pendingCreates = [...this.snap.pendingCreates, fresh]
    this.commit({
      ...this.snap,
      projects: overlayOptimisticProjects([...this.snap.projects, fresh], pendingCreates, this.snap.deletedProjectIds),
      pendingCreates,
      activeProjectId: open ? fresh.id : this.snap.activeProjectId,
    })
    return fresh
  }

  renameProject(id: string, name: string): void {
    const trimmed = name.trim()
    if (!trimmed) return
    this.commit({
      ...this.snap,
      projects: this.snap.projects.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
      pendingCreates: this.snap.pendingCreates.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
    })
  }

  deleteProject(id: string): void {
    const deletedProjectIds = this.snap.deletedProjectIds.includes(id)
      ? this.snap.deletedProjectIds
      : [...this.snap.deletedProjectIds, id]
    const projects = this.snap.projects.filter((p) => p.id !== id)
    const pendingCreates = this.snap.pendingCreates.filter((p) => p.id !== id)
    const activeProjectId = this.snap.activeProjectId === id ? (projects[0]?.id ?? "") : this.snap.activeProjectId
    this.commit({ ...this.snap, projects, pendingCreates, deletedProjectIds, activeProjectId })
  }

  patchProject(patch: Partial<Project>): void {
    const current = this.requireProject()
    if (current.teamReadOnly) return
    const next = { ...current, ...patch }
    this.commit({
      ...this.snap,
      projects: this.snap.projects.map((p) => (p.id === current.id ? next : p)),
      pendingCreates: this.snap.pendingCreates.map((p) => (p.id === current.id ? next : p)),
    })
  }

  setModels(m: StructureModel[] | ((prev: StructureModel[]) => StructureModel[])): void {
    const prev = stripSharedModels(this.project?.models ?? [])
    const raw = typeof m === "function" ? m(withSharedModels(prev)) : m
    this.patchProject({ models: stripSharedModels(raw) })
  }

  setTypeAliases(t: TypeAlias[] | ((prev: TypeAlias[]) => TypeAlias[])): void {
    const prev = stripBuiltinTypeAliases(this.project?.typeAliases ?? [])
    const raw = typeof t === "function" ? t(withBuiltinTypeAliases(prev)) : t
    this.patchProject({ typeAliases: stripBuiltinTypeAliases(raw) })
  }

  setModules(m: PipelineModule[]): void {
    const project = this.requireProject()
    this.patchProject({ modules: syncManagedPipelineSteps(m, project.models, this.snap.model) })
  }

  applyProjectChanges(changes: ProjectPatch): void {
    const project = this.requireProject()
    if (!changes.models && !changes.modules && !changes.typeAliases && changes.documentation === undefined && !changes.name) {
      return
    }
    const nextModels = changes.models ? stripSharedModels(changes.models) : project.models
    const modelsForSync = withSharedModels(nextModels)
    const nextModules = changes.modules
      ? syncManagedPipelineSteps(changes.modules, modelsForSync, this.snap.model)
      : changes.models
        ? syncManagedPipelineSteps(project.modules, modelsForSync, this.snap.model)
        : undefined
    this.patchProject({
      ...(changes.models ? { models: nextModels } : {}),
      ...(changes.typeAliases ? { typeAliases: stripBuiltinTypeAliases(changes.typeAliases) } : {}),
      ...(nextModules !== undefined ? { modules: nextModules } : {}),
      ...(changes.documentation !== undefined ? { documentation: changes.documentation || undefined } : {}),
      ...(changes.name ? { name: changes.name } : {}),
    })
  }

  setDocumentation(text: string): void {
    this.patchProject({ documentation: text || undefined })
  }

  setModel(m: string): void {
    this.commit({ ...this.snap, model: m })
  }

  setInferenceInputDocIds(docs: Partial<Record<ModuleId, DocId | DocId[]>>): void {
    // AI : TODO (cli-parity) — Inference tab assigns docs per Input step then startRun; ids are stored unused.
    this.commit({ ...this.snap, inferenceInputDocIds: docs })
  }

  // AI : TODO (cli-parity) — React addDoc POSTs /api/docs (content-hash + Storage); this is local-only text.
  addDocContent(input: AddDocContentInput): DocRef {
    const id = hashContent(input.content)
    const existing = this.snap.docs.find((d) => d.id === id)
    const doc: DocRef = existing ?? {
      id,
      name: input.name,
      type: input.type,
      label: input.label,
      sizeKb: Math.max(1, Math.round(input.content.length / 1024)),
      uploadedAt: this.now(),
      preview: input.content.slice(0, 160),
    }
    const docs = existing ? this.snap.docs : [...this.snap.docs, doc]
    this.commit({
      ...this.snap,
      docs,
      docContents: { ...this.snap.docContents, [id]: input.content },
    })
    return doc
  }

  removeDoc(docId: DocId): void {
    const { [docId]: _removed, ...docContents } = this.snap.docContents
    this.commit({
      ...this.snap,
      docs: this.snap.docs.filter((d) => d.id !== docId),
      docContents,
    })
  }

  // AI : locality:local — offsets into source already on this machine; never egress.
  linkQuotes(input: LinkQuotesInput): QuoteView {
    if (this.egress) {
      // AI : local capability — touching egress here would fail the no-network suite.
    }
    return toQuoteView(findQuote(input.quote, input.sourceText, input.docId))
  }

  validation(): ValidationView {
    return toValidationView(this.snap)
  }

  ingestRemoteProjects(remote: Project[]): void {
    const created = new Map(this.snap.pendingCreates.map((p) => [p.id, p] as const))
    for (const id of [...created.keys()]) {
      if (remote.some((p) => p.id === id)) created.delete(id)
    }
    const projects = overlayOptimisticProjects(remote, created, this.snap.deletedProjectIds)
    const activeStillVisible = projects.some((p) => p.id === this.snap.activeProjectId)
    this.commit({
      ...this.snap,
      projects,
      pendingCreates: [...created.values()],
      activeProjectId: activeStillVisible ? this.snap.activeProjectId : (projects[0]?.id ?? ""),
    })
  }

  ingestRemoteRuns(remote: PipelineRun[]): void {
    // AI : TODO (cli-parity) — no addRun / updateRunNotes / updateRunTest; Logging hydrates step traces.
    this.commit({ ...this.snap, runs: overlayOptimisticRuns(remote) })
  }
  appendChat(turn: SessionChatTurn): void {
    this.commit({ ...this.snap, chat: [...this.snap.chat, turn] })
  }

  setPendingProposal(proposal: ProjectProposal | null): void {
    this.commit({ ...this.snap, pendingProposal: proposal })
  }

  // AI : same delta apply as project-assistant.tsx — local; hosted run actions stay with the caller.
  // AI : TODO (cli-parity) — do not execute proposedActions (run_inference / run_test); React does after confirm.
  applyProposal(proposal: ProjectProposal): void {
    const project = this.requireProject()
    if (proposal.changed.name && proposal.projectName) {
      this.renameProject(project.id, proposal.projectName)
    }
    if (proposal.changed.models || proposal.changed.modules || proposal.changed.typeAliases) {
      this.applyProjectChanges({
        ...(proposal.changed.models ? { models: proposal.models } : {}),
        ...(proposal.changed.modules ? { modules: proposal.modules } : {}),
        ...(proposal.changed.typeAliases ? { typeAliases: proposal.typeAliases } : {}),
      })
    }
    if (proposal.changed.documentation) {
      this.setDocumentation(proposal.documentation)
    }
    if (proposal.changed.docs) {
      for (const spec of proposal.docs) {
        this.addDocContent({
          name: spec.name,
          type: spec.type,
          content: spec.content,
          label: spec.label ?? DocLabel.Inference,
        })
      }
    }
    this.commit({ ...this.snap, pendingProposal: null })
  }

  applyPendingProposal(): boolean {
    const proposal = this.snap.pendingProposal
    if (!proposal) return false
    this.applyProposal(proposal)
    return true
  }

  rejectPendingProposal(): void {
    this.commit({ ...this.snap, pendingProposal: null })
  }

  attachRealtime(port: RealtimePort, handlers?: Partial<TeamRealtimeHandlers>, debounceMs = 0): () => void {
    // AI : TODO (cli-parity) — React useTeamRealtime watches projects/docs/runs/team_members; CLI never connects.
    this.realtimeStop?.()
    const stop = attachRealtimePort(port, {
      onProjectsChanged: handlers?.onProjectsChanged ?? (() => undefined),
      onRunsChanged: handlers?.onRunsChanged ?? (() => undefined),
      onMembershipChanged: handlers?.onMembershipChanged ?? (() => undefined),
    }, debounceMs)
    this.realtimeStop = stop
    return () => {
      stop()
      if (this.realtimeStop === stop) this.realtimeStop = undefined
    }
  }
}

export function createSpineSession(opts?: SpineSessionOpts): SpineSession {
  return new SpineSession(opts)
}

export function createMemoryPersist(initial?: SessionSnapshot): PersistPort {
  let snap = initial ?? null
  return {
    load: () => snap,
    save: (next) => {
      snap = next
    },
  }
}
