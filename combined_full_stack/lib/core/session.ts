// AI : vanilla store matching useStore() names — React/CLI/MCP subscribe; persist is a port.
// AI : GUI useStore delegates project mutations via gui-session-bridge (docs/parity.md §8.5).

import { hashContent } from "@/lib/content-hash"
import { uid } from "@/lib/id"
import { UNNAMED_PROJECT_NAME, AUTHORED_PROJECT_KIND } from "@/lib/project-assistant-types"
import { findQuote } from "@/lib/quotes"
import { withBuiltinTypeAliases, withSharedModels } from "@/lib/structure"
import { DEFAULT_MODEL, DocLabel, InputType, ModuleKind, RunSource } from "@/lib/types"
import type {
  DocId,
  DocRef,
  ModuleId,
  PipelineFunction,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  RunTestReport,
  Strategy,
  StructureModel,
  TypeAlias,
  pipeline_function_id,
} from "@/lib/types"
import { addPipelineFunction, switchActiveFunction } from "@/lib/pipeline-functions"
import {
  attachRealtimePort,
  overlayOptimisticProjects,
  overlayOptimisticRuns,
  reseedCreatedFromLocal,
  type RealtimePort,
  type TeamRealtimeHandlers,
} from "@/lib/core/realtime"
import { toQuoteView, toValidationView, type QuoteView, type ValidationView } from "@/lib/core/view"
import {
  deleteProjectSnapshot,
  modelsPatchWithSync,
  modulesPatchWithSync,
  patchProjectInList,
  projectPatchFromChanges,
  renamedProjects,
  typeAliasesPatch,
  withProjectDocumentation,
} from "@/lib/core/project-ops"
import {
  inferenceInputIssueMessage,
  issuesForSavedInferenceAssignment,
} from "@/lib/inference-validity"
import { orderedInputModules } from "@/lib/inference-input-core"
import { projectsWithDocAvailability } from "@/lib/project-docs"
import { sharedLinkPublicPath } from "@/lib/hosted-site"
import type { ProjectProposal } from "@/lib/project-assistant-types"
import type {
  AddDocContentInput,
  BillingAccountView,
  CacheEntryView,
  EarningsAccountView,
  EgressPort,
  LinkQuotesInput,
  ModelOptionView,
  PersistPort,
  ProjectCreateOpts,
  ProjectPatch,
  SessionChatTurn,
  SessionSnapshot,
  AssistantInFlight,
} from "@/lib/core/types"
import { chatForActiveProject } from "@/lib/core/types"

export type SpineSessionOpts = {
  persist?: PersistPort
  egress?: EgressPort
  now?: () => number
}

export const ASSISTANT_IN_FLIGHT_STALE_MS = 5 * 60 * 1000

export function migrateSessionChat(raw: Partial<SessionSnapshot>): {
  chat: SessionChatTurn[]
  chatByProjectId: Record<string, SessionChatTurn[]>
} {
  const byId: Record<string, SessionChatTurn[]> = { ...(raw.chatByProjectId ?? {}) }
  const projectIds = [
    ...new Set(
      [...(raw.projects ?? []), ...(raw.pendingCreates ?? [])]
        .map((p) => p.id)
        .filter(Boolean),
    ),
  ]
  // AI : never copy orphan global chat onto a project — leftover invoice history was leaking onto a new blank.
  for (const id of projectIds) {
    if (!byId[id]) byId[id] = []
  }
  const chat = (raw.activeProjectId && byId[raw.activeProjectId]) || []
  return { chat, chatByProjectId: byId }
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
    chatByProjectId: {},
    pendingProposal: null,
    assistantInFlight: null,
    modelOptions: [],
    billingRuns: [],
    billingAccount: null,
    earningsAccount: null,
    cacheEntries: [],
    saveError: null,
    shareLinkIds: [],
    hostedApiIds: [],
    docProjectIds: {},
  }
}

function keepInferenceAssignment(
  assignment: Partial<Record<ModuleId, DocId | DocId[]>>,
  keep: Set<string>,
): Partial<Record<ModuleId, DocId | DocId[]>> {
  const out: Partial<Record<ModuleId, DocId | DocId[]>> = {}
  for (const [moduleId, value] of Object.entries(assignment)) {
    if (Array.isArray(value)) {
      const next = value.filter((id) => keep.has(id))
      if (next.length) out[moduleId as ModuleId] = next
    } else if (value && keep.has(value)) {
      out[moduleId as ModuleId] = value
    }
  }
  return out
}

// AI : TODO (arch-blank-project) — twins seed.blankProject; one factory (session/seed only differ on id/strategies).
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


function nextNumberedCloneName(baseName: string, existingNames: Iterable<string>): string {
  const names = new Set(existingNames)
  let n = 1
  while (names.has(`${baseName} ${n}`)) n += 1
  return `${baseName} ${n}`
}

function nextChatForNewProject(
  snap: SessionSnapshot,
  projectId: string,
  open: boolean,
): Pick<SessionSnapshot, "chat" | "chatByProjectId" | "activeProjectId"> {
  return {
    chatByProjectId: { ...snap.chatByProjectId, [projectId]: [] },
    activeProjectId: open ? projectId : snap.activeProjectId,
    chat: open ? [] : snap.chat,
  }
}

export class SpineSession {
  // AI : MCP session_action + named tools wrap public methods (see mcp_tool/spine-session-bar-a.ts).
  // AI :   Host-bound stays GUI-only: CodeHost, human-review, chatbot, Stripe, run cancel. Share/schedule mint via HTTP.
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
    const loaded = opts.persist?.load() ?? {}
    this.snap = { ...emptySessionSnapshot(), ...loaded, ...migrateSessionChat(loaded) }
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
    return chatForActiveProject(this.snap)
  }

  get pendingProposal(): ProjectProposal | null {
    return this.snap.pendingProposal
  }

  get assistantInFlight(): AssistantInFlight | null {
    const job = this.snap.assistantInFlight
    if (!job) return null
    if (this.now() - job.startedAt > ASSISTANT_IN_FLIGHT_STALE_MS) return null
    return job
  }

  private commit(next: SessionSnapshot, opts?: { persist?: boolean }): void {
    this.snap = next
    if (opts?.persist !== false) this.persist?.save(next)
    for (const listener of this.listeners) listener()
  }

  // AI : GUI HTTP hydrate — replace snap without echoing debounced PUT.
  hydrateSnapshot(next: SessionSnapshot): void {
    this.commit(next, { persist: false })
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
      chat: this.snap.chatByProjectId?.[id] ?? [],
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
      ...nextChatForNewProject(this.snap, fresh.id, open),
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
      ...nextChatForNewProject(this.snap, id, open),
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
      ...nextChatForNewProject(this.snap, id, open),
    })
    return fresh
  }

  cloneFromTemplate(source: Project, opts?: ProjectCreateOpts): Project {
    return this.ingestProject(source, opts)
  }

  renameProject(id: string, name: string): void {
    const next = renamedProjects(this.snap.projects, id, name)
    if (!next) return
    this.commit({
      ...this.snap,
      projects: next,
      pendingCreates: this.snap.pendingCreates.map((p) => {
        const updated = next.find((q) => q.id === p.id)
        return updated ?? p
      }),
    })
  }

  deleteProject(id: string): void {
    this.commit(deleteProjectSnapshot(this.snap, id))
  }

  patchProject(patch: Partial<Project>): void {
    const current = this.requireProject()
    if (current.teamReadOnly) return
    const next = { ...current, ...patch }
    this.commit({
      ...this.snap,
      projects: patchProjectInList(this.snap.projects, current.id, next),
      pendingCreates: patchProjectInList(this.snap.pendingCreates, current.id, next),
    })
  }

  setModels(m: StructureModel[] | ((prev: StructureModel[]) => StructureModel[])): void {
    const project = this.project
    if (!project) return
    this.patchProject(modelsPatchWithSync(project, m, this.snap.model))
  }

  setTypeAliases(t: TypeAlias[] | ((prev: TypeAlias[]) => TypeAlias[])): void {
    const project = this.project
    if (!project) return
    this.patchProject(typeAliasesPatch(project, t))
  }

  setModules(m: PipelineModule[]): void {
    const project = this.requireProject()
    this.patchProject(modulesPatchWithSync(project, m, this.snap.model))
  }

  setActiveFunction(id: pipeline_function_id): void {
    const project = this.requireProject()
    this.patchProject(switchActiveFunction(project, id))
  }

  addPipelineFunction(name?: string): PipelineFunction {
    const project = this.requireProject()
    const patch = addPipelineFunction(project, name)
    this.patchProject(patch)
    return patch.functions![patch.functions!.length - 1]!
  }

  applyProjectChanges(changes: ProjectPatch): void {
    const project = this.requireProject()
    const patch = projectPatchFromChanges(project, changes, this.snap.model)
    if (!patch) return
    this.patchProject(patch)
  }

  setDocumentation(text: string): void {
    const project = this.project
    if (!project) return
    const next = withProjectDocumentation(project, text)
    if (next === project) return
    this.patchProject({ documentation: next.documentation })
  }

  setModel(m: string): void {
    this.commit({ ...this.snap, model: m })
  }

  setInferenceInputDocIds(docs: Partial<Record<ModuleId, DocId | DocId[]>>): void {
    this.commit({ ...this.snap, inferenceInputDocIds: docs })
  }

  addDoc(input: AddDocContentInput): DocRef {
    return this.addDocContent(input)
  }

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
    // AI : GUI upload links the filename to the open pipeline; MCP get_project scopes docs the same way.
    this.linkDocNameToActiveProject(doc.name)
    return doc
  }

  private linkDocNameToActiveProject(docName: string): void {
    const project = this.project
    if (!project) return
    if (project.seedDocNames?.includes(docName)) return
    this.patchProject({ seedDocNames: [...(project.seedDocNames ?? []), docName] })
  }

  // AI : GUI Documents delete — unlink seedDocNames on the open pipeline, drop bytes only if unused.
  removeDoc(docId: DocId): void {
    const doc = this.snap.docs.find((d) => d.id === docId)
    if (!doc) return
    const activeId = this.snap.activeProjectId
    const unlink = (list: Project[]) =>
      list.map((p) =>
        p.id === activeId
          ? { ...p, seedDocNames: (p.seedDocNames ?? []).filter((n) => n !== doc.name) }
          : p,
      )
    const projects = unlink(this.snap.projects)
    const pendingCreates = unlink(this.snap.pendingCreates)
    const stillLinked = projects.some((p) => p.seedDocNames?.includes(doc.name))
    const { [docId]: _removed, ...docContents } = this.snap.docContents
    const { [docId]: _ids, ...docProjectIds } = this.snap.docProjectIds
    this.commit({
      ...this.snap,
      projects,
      pendingCreates,
      docs: stillLinked ? this.snap.docs : this.snap.docs.filter((d) => d.id !== docId),
      docContents: stillLinked ? this.snap.docContents : docContents,
      docProjectIds: stillLinked ? this.snap.docProjectIds : docProjectIds,
    })
  }

  // AI : locality:local — offsets into source already on this machine; never egress.
  // AI : TODO (mcp-capability) — GUI quote-as-context; wrap as session_action quotes.link (CLI already has link-quotes).
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
    reseedCreatedFromLocal(created, this.snap.projects, remote, this.snap.deletedProjectIds)
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
    this.commit({ ...this.snap, runs: overlayOptimisticRuns(remote) })
  }
  appendChat(turn: SessionChatTurn): void {
    const id = this.snap.activeProjectId
    const existing = chatForActiveProject(this.snap)
    const nextTurns = [...existing, turn]
    this.commit({
      ...this.snap,
      chat: nextTurns,
      chatByProjectId: id ? { ...this.snap.chatByProjectId, [id]: nextTurns } : this.snap.chatByProjectId,
    })
  }

  setAssistantInFlight(job: AssistantInFlight | null): void {
    this.commit({ ...this.snap, assistantInFlight: job })
  }

  setPendingProposal(proposal: ProjectProposal | null): void {
    this.commit({ ...this.snap, pendingProposal: proposal })
  }

  // AI : same delta apply as project-assistant.tsx — local; proposedActions via executeProposedActions.
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

  setStrategies(s: Strategy[]): void {
    this.patchProject({ strategies: s })
  }

  // AI : GUI document↔project binding — MCP session_action documents.set-projects / CLI set-doc-projects.
  setDocProjects(docId: DocId, projectIds: ProjectId[]): void {
    const doc = this.snap.docs.find((d) => d.id === docId)
    if (!doc) return
    const projects = projectsWithDocAvailability(this.snap.projects, doc.name, projectIds)
    const pendingCreates = projectsWithDocAvailability(this.snap.pendingCreates, doc.name, projectIds)
    const stillLinked = projects.some((p) => p.seedDocNames?.includes(doc.name))
    const { [docId]: _removed, ...docContents } = this.snap.docContents
    const nextIds: Partial<Record<DocId, ProjectId[]>> = { ...this.snap.docProjectIds, [docId]: projectIds }
    if (!stillLinked) delete nextIds[docId]
    this.commit({
      ...this.snap,
      projects,
      pendingCreates,
      docs: stillLinked ? this.snap.docs : this.snap.docs.filter((d) => d.id !== docId),
      docContents: stillLinked ? this.snap.docContents : docContents,
      docProjectIds: nextIds,
    })
  }

  addRun(run: PipelineRun): void {
    const runs = [...this.snap.runs.filter((r) => r.id !== run.id), run]
    this.commit({ ...this.snap, runs })
  }

  updateRunNotes(runId: PipelineRun["id"], notes: string | undefined): void {
    this.commit({
      ...this.snap,
      runs: this.snap.runs.map((r) => (r.id === runId ? { ...r, notes } : r)),
    })
  }

  updateRunTest(runId: PipelineRun["id"], test: RunTestReport): void {
    this.commit({
      ...this.snap,
      runs: this.snap.runs.map((r) => (r.id === runId ? { ...r, test, source: r.source ?? RunSource.Testing } : r)),
    })
  }

  setModelOptions(options: ModelOptionView[]): void {
    this.commit({ ...this.snap, modelOptions: options })
  }

  setCacheEntries(entries: CacheEntryView[]): void {
    this.commit({ ...this.snap, cacheEntries: entries })
  }

  setShareLinkIds(ids: string[]): void {
    this.commit({ ...this.snap, shareLinkIds: ids })
  }

  setHostedApiIds(ids: string[]): void {
    this.commit({ ...this.snap, hostedApiIds: ids })
  }

  clearSaveError(): void {
    this.commit({ ...this.snap, saveError: null })
  }

  private async requestRemote(path: string, init?: RequestInit): Promise<Response> {
    if (!this.egress) throw new Error("remote action needs SPINE_API_URL (or --offline to fail closed)")
    return this.egress.request(path, init)
  }

  // AI : GUI Share/Schedule/Connect mint the same JSON the forms POST — MCP/CLI reuse this.
  private async requestJson<T extends Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.requestRemote(path, init)
    const body = (await res.json().catch(() => ({}))) as { error?: string } & T
    if (!res.ok) throw new Error(typeof body.error === "string" && body.error ? body.error : `HTTP ${res.status}`)
    return body
  }

  private jsonBody(method: string, body: unknown): RequestInit {
    return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
  }

  async listShareLinks(): Promise<{ ids: string[]; links: Array<{ id: string }> }> {
    const body = await this.requestJson<{ links?: Array<{ id: string }> }>("/api/shared-links")
    const links = body.links ?? []
    this.setShareLinkIds(links.map((l) => l.id))
    return { ids: this.getSnapshot().shareLinkIds, links }
  }

  async createShareLink(input: Record<string, unknown> = {}): Promise<{ url: string; link: { id: string } }> {
    const project = this.requireProject()
    const body = await this.requestJson<{ url?: string; link?: { id: string } }>(
      "/api/shared-links",
      this.jsonBody("POST", { projectId: project.id, ...input }),
    )
    if (!body.link?.id) throw new Error("createShareLink: API returned no link")
    const ids = this.getSnapshot().shareLinkIds
    if (!ids.includes(body.link.id)) this.setShareLinkIds([...ids, body.link.id])
    const url = body.url ?? sharedLinkPublicPath(body.link.id)
    return { url, link: body.link }
  }

  async listHostedApis(): Promise<{ ids: string[]; apis: Array<{ id: string }> }> {
    const body = await this.requestJson<{ apis?: Array<{ id: string }> }>("/api/hosted-apis")
    const apis = body.apis ?? []
    this.setHostedApiIds(apis.map((a) => a.id))
    return { ids: this.getSnapshot().hostedApiIds, apis }
  }

  async createHostedApi(input: Record<string, unknown> = {}): Promise<{
    apiKey?: string
    invokeUrl?: string
    progressUrl?: string
    api?: { id: string }
  }> {
    const project = this.requireProject()
    const body = await this.requestJson<{
      apiKey?: string
      invokeUrl?: string
      progressUrl?: string
      api?: { id: string }
    }>("/api/hosted-apis", this.jsonBody("POST", { projectId: project.id, ...input }))
    if (body.api?.id) {
      const ids = this.getSnapshot().hostedApiIds
      if (!ids.includes(body.api.id)) this.setHostedApiIds([...ids, body.api.id])
    }
    return body
  }

  async listSchedules(): Promise<{ schedules: unknown[]; runtime: unknown }> {
    const project = this.requireProject()
    return this.requestJson(`/api/schedules?projectId=${encodeURIComponent(project.id)}`)
  }

  async createSchedule(input: Record<string, unknown>): Promise<{ schedule: unknown; runtime: unknown }> {
    const project = this.requireProject()
    return this.requestJson("/api/schedules", this.jsonBody("POST", { projectId: project.id, ...input }))
  }

  async patchSchedule(id: string, input: Record<string, unknown>): Promise<{ schedule: unknown }> {
    return this.requestJson(`/api/schedules/${id}`, this.jsonBody("PATCH", input))
  }

  async deleteSchedule(id: string): Promise<{ ok: boolean }> {
    return this.requestJson(`/api/schedules/${id}`, { method: "DELETE" })
  }

  async runScheduleNow(id: string): Promise<{ jobId?: string }> {
    return this.requestJson(`/api/schedules/${id}/run`, { method: "POST" })
  }

  async publishMarketplaceListing(input: {
    title: string
    description?: string
    priceCents?: number
  }): Promise<{ listing: unknown }> {
    const project = this.requireProject()
    return this.requestJson(
      "/api/marketplace",
      this.jsonBody("POST", { projectId: project.id, title: input.title, description: input.description, priceCents: input.priceCents }),
    )
  }

  async startConnectSession(actionId: string): Promise<{
    sessionToken: string
    host: string
    provider: string
    actionId: string
  }> {
    const project = this.requireProject()
    const body = await this.requestJson<{
      sessionToken?: string
      host?: string
      provider?: string
      actionId?: string
    }>("/api/connect/session", this.jsonBody("POST", { actionId, projectId: project.id }))
    if (!body.sessionToken || !body.host || !body.provider) {
      throw new Error("startConnectSession: API returned no Nango session")
    }
    return {
      sessionToken: body.sessionToken,
      host: body.host,
      provider: body.provider,
      actionId: body.actionId ?? actionId,
    }
  }

  // AI : TODO (mcp-capability) — GUI Refresh example documents; wrap as session_action project.resync-examples.
  async resyncExamples(): Promise<number> {
    const res = await this.requestRemote("/api/projects/resync-examples", { method: "POST" })
    const body = (await res.json()) as { count?: number }
    return body.count ?? 0
  }

  // AI : GUI Logging load-run-detail — one GET; fail closed so wait_for_run cannot poll a stale run forever.
  async hydrateRunDetail(runId: PipelineRun["id"]): Promise<void> {
    const body = await this.requestJson<{ run?: PipelineRun }>(`/api/runs/${runId}`)
    if (!body.run) throw new Error("hydrateRunDetail: API returned no run")
    this.addRun(body.run)
  }

  async startRun(opts?: { source?: RunSource; testDocName?: string }): Promise<PipelineRun> {
    const project = this.requireProject()
    const source = opts?.source ?? RunSource.App
    const slotIssues = issuesForSavedInferenceAssignment(
      project,
      this.snap.docs,
      this.snap.inferenceInputDocIds,
      this.snap.docContents,
    )
    if (slotIssues.length) {
      throw new Error(inferenceInputIssueMessage(slotIssues, orderedInputModules(project.modules)))
    }
    const res = await this.requestRemote("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId: project.id,
        model: this.snap.model,
        source,
        inputDocsByModule: this.snap.inferenceInputDocIds,
        testDocName: opts?.testDocName,
      }),
    })
    if (!res.ok) throw new Error(`startRun failed: HTTP ${res.status}`)
    const body = (await res.json()) as { run?: PipelineRun; error?: string }
    if (!body.run) throw new Error(body.error ?? "startRun: API returned no run")
    this.addRun(body.run)
    return body.run
  }

  async runTest(testDocName?: string): Promise<PipelineRun> {
    return this.startRun({ source: RunSource.Testing, testDocName })
  }

  // AI : TODO (mcp-capability) — GUI Save / PUT project; wrap as MCP session push (flushPendingSave).
  async flushPendingSave(): Promise<void> {
    const project = this.project
    if (!project) return
    await this.requestRemote(`/api/projects/${project.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(project),
    })
  }

  async refreshBilling(): Promise<void> {
    const res = await this.requestRemote("/api/billing")
    const data = (await res.json()) as BillingAccountView
    this.commit({ ...this.snap, billingAccount: data })
  }

  async refreshEarnings(): Promise<void> {
    const res = await this.requestRemote("/api/earnings")
    const data = (await res.json()) as EarningsAccountView
    this.commit({ ...this.snap, earningsAccount: data })
  }

  // AI : TODO (mcp-capability) — GUI GET /api/state; wrap as MCP session pull so the agent can use the same project as a signed-in human.
  async pullRemoteState(): Promise<void> {
    const data = await this.requestJson<{
      projects?: Project[]
      docs?: DocRef[]
      runs?: PipelineRun[]
      modelOptions?: ModelOptionView[]
    }>("/api/state")
    if (data.projects) this.ingestRemoteProjects(data.projects)
    if (data.docs) {
      const keep = new Set(data.docs.map((d) => d.id))
      const inferenceInputDocIds = keepInferenceAssignment(this.snap.inferenceInputDocIds, keep)
      const docContents = Object.fromEntries(
        Object.entries(this.snap.docContents).filter(([id]) => keep.has(id as DocId)),
      )
      this.commit({ ...this.snap, docs: data.docs, inferenceInputDocIds, docContents })
    }
    if (data.runs) this.ingestRemoteRuns(data.runs)
    if (data.modelOptions) this.setModelOptions(data.modelOptions)
  }

  // AI : TODO (mcp-capability) — GUI Approve-to-run; wrap as MCP after apply_project_changes.
  async executeProposedActions(
    actions = this.snap.pendingProposal?.proposedActions ?? [],
  ): Promise<PipelineRun[]> {
    const out: PipelineRun[] = []
    for (const action of actions) {
      if (action.type === "run_inference") out.push(await this.startRun({ source: RunSource.Assistant }))
      if (action.type === "run_test") out.push(await this.runTest(action.testDocName))
    }
    return out
  }

  attachRealtime(port: RealtimePort, handlers?: Partial<TeamRealtimeHandlers>, debounceMs = 0): () => void {
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
