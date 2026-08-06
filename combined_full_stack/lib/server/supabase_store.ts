import type { SupabaseClient } from "@supabase/supabase-js";
import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
// AI : TODO refactor (prod) — add original doc bytes via Supabase Storage (see store.ts saveOriginalDocBytes).
// AI : TODO bug (prod) — user-uploaded PDF/image bytes lost on redeploy; GET /api/docs/[id]/file 404s.
// AI : adopted from backend_with_users/ — implements the same Store contract, so
// AI : runPipeline & co accept this store unchanged. Session JWT + explicit user_id
// AI : on writes keep rows scoped to the signed-in user.
import { hashContent, type Store } from "./store";
import type { user_id_string } from "./require_auth";
import { storeErrorMessage } from "./errors";
import { listTeamsForUser } from "./teams";
import { migrateProjectModules } from "./validity";
import { stripSharedModels } from "./builtin_models";
import { buildDocRef, docRefFromDbRow, type DocDbRow, userDocDbRow } from "./doc_ref";
import {
  clearPlatformSeedDocState,
  ingestPlatformSeedDocRows,
  type PlatformSeedDocState,
} from "./platform_seed_docs";
import { allBundledSeedDocNames } from "./seed_docs_platform";
import type {
  FileContentHash,
  ParserCacheKey,
  ParserCacheRow,
  ParserKind,
  VisionCacheKey,
  VisionCacheRow,
} from "./doc_text_cache";
import {
  createParserVisionCacheIndex,
  indexParserRow,
  indexVisionRow,
  parserCacheGetByDoc,
  parserCacheGetByFileHash,
  purgeParserVisionCacheForDoc,
  visionCacheGet,
  visionCachesForDoc,
} from "./parser_vision_cache_index";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineRun,
  Project,
  ProjectId,
  RunFingerprint,
  RunTestReport,
} from "./types";

interface RunRow {
  project_id: string;
  started_at: number;
  data: PipelineRun;
  fingerprint?: string | null;
}

interface VisionCacheDbRow {
  cache_key: string;
  doc_id: string;
  model: string;
  prompt: string;
  purpose: string;
  content: string;
  created_at: number;
}

interface ParserCacheDbRow {
  cache_key: string;
  file_hash: string;
  doc_id: string;
  parser: string;
  content: string;
  created_at: number;
}

// AI : Supabase twin of JsonStore. The Store contract is synchronous, so: load everything
// AI : for the signed-in user once in init(), serve reads from memory, and queue
// AI : write-behind upserts that flush() awaits (routes flush before responding).
// AI : docs.content = built-in parser text; doc_vision_cache = OpenRouter vision OCR (separate table).
export class SupabaseStore implements Store {
  private state = {
    projects: [] as Project[],
    docs: [] as DocRef[],
    contents: new Map<DocId, string>(),
    runs: [] as PipelineRun[],
    runProjects: {} as Record<string, ProjectId>,
  };
  private cacheIndex = createParserVisionCacheIndex();
  // AI : defer db calls to flush() so rebindDb always supplies a fresh JWT (same as project upserts).
  private pendingRest: Array<() => PromiseLike<{ error: unknown }>> = [];
  // AI : row payloads only — upserts run in flush() with this request's db (not at saveProject time).
  private pendingProjectUpserts = new Map<ProjectId, Record<string, unknown>>();
  private flushTail: Promise<void> = Promise.resolve();
  private projectIdsAtInit = new Set<ProjectId>();
  private createdProjectIds = new Set<ProjectId>();
  private hasFingerprintColumn = false;
  private hasProjectTeamIdColumn = false;
  private hasVisionCacheTable = false;
  private hasParserCacheTable = false;
  private platformSeedDocsLoaded = false;
  private platformSeedDocIds = new Set<DocId>();

  private platformSeedDocState(): PlatformSeedDocState {
    return {
      docs: this.state.docs,
      contents: this.state.contents,
      platformSeedDocIds: this.platformSeedDocIds,
    };
  }

  constructor(
    private db: SupabaseClient,
    private scopedUserId: user_id_string,
  ) {}

  // AI : cached stores keep memory warm across requests — rebind so RLS uses this request's JWT.
  rebindDb(db: SupabaseClient): void {
    this.db = db;
  }

  private queueRest(op: () => PromiseLike<{ error: unknown }>): void {
    this.pendingRest.push(op);
  }

  private withUserId<T extends Record<string, unknown>>(row: T): T {
    return { ...row, user_id: this.scopedUserId };
  }

  // AI : shared team projects persist on the owner's row — not the viewer's scoped user id.
  private projectPersistUserId(p: Pick<Project, "teamProjectOwnerId">): user_id_string {
    return p.teamProjectOwnerId ?? this.scopedUserId;
  }

  private projectDataForStorage(p: Project): Project {
    const { teamReadOnly, teamProjectOwnerId, ...rest } = p;
    return rest;
  }

  // AI : drop a never-persisted / already-gone row from memory — DELETE matching 0 is success.
  private dropLocalProject(id: ProjectId): void {
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
    this.pendingProjectUpserts.delete(id);
    this.projectIdsAtInit.delete(id);
    this.createdProjectIds.delete(id);
  }

  // AI : 0-row DELETE is ok (ghost after failed create, or concurrent delete); RLS deny looks the same only with a stale JWT — rebindDb prevents that.
  private queueProjectDelete(id: ProjectId, ownerId: user_id_string): void {
    this.queueRest(async () => {
      const { error } = await this.db
        .from("projects")
        .delete()
        .eq("user_id", ownerId)
        .eq("id", id)
        .select("id");
      if (error) return { error };
      return { error: null };
    });
  }

  async init(): Promise<void> {
    const docsQ = this.db.from("docs").select("*").order("uploaded_at", { ascending: false }).eq("user_id", this.scopedUserId);
    const projectsWithTeam = await this.db.from("projects").select("data, team_id, user_id").eq("user_id", this.scopedUserId);
    let projects;
    if (projectsWithTeam.error?.message?.includes("team_id")) {
      this.hasProjectTeamIdColumn = false;
      projects = await this.db.from("projects").select("data, user_id").eq("user_id", this.scopedUserId);
      if (projects.error) throw projects.error;
    } else {
      if (projectsWithTeam.error) throw projectsWithTeam.error;
      this.hasProjectTeamIdColumn = true;
      projects = projectsWithTeam;
    }

    const docs = await docsQ;
    if (docs.error) throw docs.error;

    const ownedProjects = (projects.data ?? []).map((row) => {
      const data = row.data as Project;
      const teamId = this.hasProjectTeamIdColumn
        ? ((row as { team_id?: string }).team_id as Project["teamId"]) ?? data.teamId
        : data.teamId;
      return teamId ? { ...data, teamId } : data;
    });

    let sharedTeamProjects: Project[] = [];
    if (this.hasProjectTeamIdColumn) {
      try {
        const teams = await listTeamsForUser(this.scopedUserId);
        const roleByTeamId = new Map(teams.map((t) => [t.id, t.role]));
        const teamIds = [...roleByTeamId.keys()];
        if (teamIds.length) {
          const shared = await this.db
            .from("projects")
            .select("data, team_id, user_id")
            .in("team_id", teamIds)
            .neq("user_id", this.scopedUserId);
          if (!shared.error) {
            sharedTeamProjects = (shared.data ?? []).map((row) => {
              const data = row.data as Project;
              const teamId = (row.team_id as Project["teamId"]) ?? data.teamId;
              const role = teamId ? roleByTeamId.get(teamId) : undefined;
              const canEdit = role === "owner" || role === "admin";
              return {
                ...data,
                ...(teamId ? { teamId } : {}),
                teamProjectOwnerId: row.user_id as user_id_string,
                teamReadOnly: !canEdit,
              };
            });
          }
        }
      } catch {
        // AI : teams tables may not exist yet — owned projects still load.
      }
    }

    this.state.projects = [...ownedProjects, ...sharedTeamProjects];
    this.projectIdsAtInit = new Set(this.state.projects.map((p) => p.id));

    const docRows: DocDbRow[] = [...((docs.data ?? []) as DocDbRow[])];
    const sharedOwnerIds = [
      ...new Set(
        sharedTeamProjects
          .map((p) => p.teamProjectOwnerId)
          .filter((id): id is user_id_string => !!id),
      ),
    ];
    if (sharedOwnerIds.length) {
      const sharedDocs = await this.db
        .from("docs")
        .select("*")
        .in("user_id", sharedOwnerIds)
        .order("uploaded_at", { ascending: false });
      if (!sharedDocs.error) {
        const seen = new Set(docRows.map((row) => row.id));
        for (const row of (sharedDocs.data ?? []) as DocDbRow[]) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            docRows.push(row);
          }
        }
      }
      // AI : TODO — load owner runs for shared team projects so members see shared run history.
    }

    let runRows: RunRow[] = [];
    let runsWithFpQ = this.db
      .from("runs")
      .select("project_id, started_at, data, fingerprint")
      .order("started_at", { ascending: false });
    runsWithFpQ = runsWithFpQ.eq("user_id", this.scopedUserId);
    const runsWithFp = await runsWithFpQ;
    if (runsWithFp.error?.message?.includes("fingerprint")) {
      this.hasFingerprintColumn = false;
      let runsLegacyQ = this.db
        .from("runs")
        .select("project_id, started_at, data")
        .order("started_at", { ascending: false });
      runsLegacyQ = runsLegacyQ.eq("user_id", this.scopedUserId);
      const runsLegacy = await runsLegacyQ;
      if (runsLegacy.error) throw runsLegacy.error;
      runRows = (runsLegacy.data ?? []) as RunRow[];
    } else {
      if (runsWithFp.error) throw runsWithFp.error;
      this.hasFingerprintColumn = true;
      runRows = (runsWithFp.data ?? []) as RunRow[];
    }

    for (const row of docRows) {
      const doc = docRefFromDbRow(row);
      this.state.docs.push(doc);
      this.state.contents.set(doc.id, row.content);
    }

    const seedDocs = await this.db.from("seed_docs").select("*");
    if (!seedDocs.error) {
      this.platformSeedDocsLoaded = true;
      ingestPlatformSeedDocRows(this.platformSeedDocState(), (seedDocs.data ?? []) as DocDbRow[]);
    }

    for (const row of runRows) {
      const run = row.data as PipelineRun;
      const fingerprint = (row.fingerprint ?? run.fingerprint) as RunFingerprint | undefined;
      if (fingerprint) run.fingerprint = fingerprint;
      this.state.runs.push(run);
      this.state.runProjects[run.id] = row.project_id as ProjectId;
      if (this.hasFingerprintColumn && fingerprint && !row.fingerprint) {
        this.queueRest(() => this.db.from("runs").update({ fingerprint }).eq("id", run.id));
      }
    }

    const vision = await this.db.from("doc_vision_cache").select("*").eq("user_id", this.scopedUserId);
    if (vision.error) {
      this.hasVisionCacheTable = !isMissingSchemaError(vision.error);
      if (!isMissingSchemaError(vision.error)) throw vision.error;
    } else {
      this.hasVisionCacheTable = true;
      for (const row of (vision.data ?? []) as VisionCacheDbRow[]) {
        indexVisionRow(this.cacheIndex, {
          key: row.cache_key as VisionCacheKey,
          docId: row.doc_id as DocId,
          model: row.model as VisionCacheRow["model"],
          prompt: row.prompt ?? "",
          purpose: row.purpose ?? "",
          content: row.content,
          createdAt: row.created_at,
        });
      }
    }

    const parser = await this.db.from("doc_parser_cache").select("*").eq("user_id", this.scopedUserId);
    if (parser.error) {
      this.hasParserCacheTable = !isMissingSchemaError(parser.error);
      if (!isMissingSchemaError(parser.error)) throw parser.error;
    } else {
      this.hasParserCacheTable = true;
      for (const row of (parser.data ?? []) as ParserCacheDbRow[]) {
        indexParserRow(this.cacheIndex, {
          key: row.cache_key as ParserCacheKey,
          fileHash: row.file_hash as FileContentHash,
          docId: row.doc_id as DocId,
          parser: row.parser as ParserKind,
          content: row.content,
          createdAt: row.created_at,
        });
      }
    }
  }

  private runRow(projectId: ProjectId, run: PipelineRun): Record<string, unknown> {
    const row: Record<string, unknown> = {
      id: run.id,
      project_id: projectId,
      started_at: run.startedAt,
      data: run,
    };
    if (this.hasFingerprintColumn) row.fingerprint = run.fingerprint ?? null;
    return row;
  }

  projects(): Project[] {
    return this.state.projects;
  }

  project(id: ProjectId): Project | undefined {
    return this.state.projects.find((p) => p.id === id);
  }

  saveProject(p: Project): void {
    const migrated = migrateProjectModules(p);
    const existing = this.state.projects.find((x) => x.id === migrated.id);
    const toPersist = {
      ...migrated,
      models: stripSharedModels(migrated.models),
      teamProjectOwnerId: migrated.teamProjectOwnerId ?? existing?.teamProjectOwnerId,
      teamReadOnly: migrated.teamReadOnly ?? existing?.teamReadOnly,
    };
    const i = this.state.projects.findIndex((x) => x.id === toPersist.id);
    if (i === -1) {
      this.state.projects.push(toPersist);
      this.createdProjectIds.add(toPersist.id);
    } else this.state.projects[i] = toPersist;
    // AI : new creates always persist under the signed-in user — clones must not inherit teamProjectOwnerId.
    const ownerId =
      this.createdProjectIds.has(toPersist.id) && !this.projectIdsAtInit.has(toPersist.id)
        ? this.scopedUserId
        : this.projectPersistUserId(toPersist);
    // AI : read-only team viewers may sync in memory — never upsert the owner's row under their JWT.
    const skipPersist = ownerId !== this.scopedUserId && toPersist.teamReadOnly === true;
    if (!skipPersist) {
      const projectRow: Record<string, unknown> = {
        id: toPersist.id,
        user_id: ownerId,
        data: this.projectDataForStorage(toPersist),
      };
      if (this.hasProjectTeamIdColumn) projectRow.team_id = toPersist.teamId ?? null;
      this.pendingProjectUpserts.set(toPersist.id, projectRow);
    }
  }

  deleteProject(id: ProjectId): boolean {
    const i = this.state.projects.findIndex((p) => p.id === id);
    if (i === -1) return false;
    const ownerId = this.projectPersistUserId(this.state.projects[i]!);
    const wasOnlyLocal = this.createdProjectIds.has(id) && !this.projectIdsAtInit.has(id);
    this.state.projects.splice(i, 1);
    this.pendingProjectUpserts.delete(id);
    this.projectIdsAtInit.delete(id);
    this.createdProjectIds.delete(id);
    const runIds = new Set(
      Object.entries(this.state.runProjects)
        .filter(([, pid]) => pid === id)
        .map(([rid]) => rid),
    );
    this.state.runs = this.state.runs.filter((r) => !runIds.has(r.id));
    for (const rid of runIds) delete this.state.runProjects[rid];
    // AI : never-persisted create (failed flush) — nothing to delete in Supabase.
    if (!wasOnlyLocal) this.queueProjectDelete(id, ownerId);
    if (runIds.size) {
      this.queueRest(() =>
        this.db.from("runs").delete().eq("user_id", this.scopedUserId).eq("project_id", id),
      );
    }
    return true;
  }

  docs(): DocRef[] {
    return this.state.docs;
  }

  usesPlatformSeedDocs(): boolean {
    return this.platformSeedDocsLoaded;
  }

  docContent(id: DocId): string | undefined {
    return this.state.contents.get(id);
  }

  parserCacheGetByFileHash(fileHash: FileContentHash, parser: ParserKind): ParserCacheRow | undefined {
    return parserCacheGetByFileHash(this.cacheIndex, fileHash, parser);
  }

  parserCacheGetByDoc(docId: DocId): ParserCacheRow | undefined {
    return parserCacheGetByDoc(this.cacheIndex, docId);
  }

  parserCacheSet(row: Omit<ParserCacheRow, "createdAt"> & { createdAt?: number }): void {
    const payload: ParserCacheRow = { ...row, createdAt: row.createdAt ?? Date.now() };
    indexParserRow(this.cacheIndex, payload);
    if (!this.hasParserCacheTable) return;
    this.queueRest(() =>
      this.db.from("doc_parser_cache").upsert(
        {
          cache_key: row.key,
          file_hash: row.fileHash,
          doc_id: row.docId,
          parser: row.parser,
          content: row.content,
          created_at: payload.createdAt,
        },
        { onConflict: "user_id,cache_key" },
      ),
    );
  }

  visionCacheGet(key: VisionCacheKey): VisionCacheRow | undefined {
    return visionCacheGet(this.cacheIndex, key);
  }

  visionCacheSet(row: Omit<VisionCacheRow, "createdAt"> & { createdAt?: number }): void {
    const payload: VisionCacheRow = { ...row, createdAt: row.createdAt ?? Date.now() };
    indexVisionRow(this.cacheIndex, payload);
    if (!this.hasVisionCacheTable) return;
    this.queueRest(() =>
      this.db.from("doc_vision_cache").upsert(
        {
          cache_key: row.key,
          doc_id: row.docId,
          model: row.model,
          prompt: row.prompt,
          purpose: row.purpose,
          content: row.content,
          created_at: payload.createdAt,
        },
        { onConflict: "user_id,cache_key" },
      ),
    );
  }

  visionCachesForDoc(docId: DocId): VisionCacheRow[] {
    return visionCachesForDoc(this.cacheIndex, docId);
  }

  repointDocName(id: DocId, name: string): boolean {
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i === -1 || this.state.docs[i]!.name === name) return false;
    const prev = this.state.docs[i]!;
    const doc = { ...prev, name };
    this.state.docs[i] = doc;
    const content = this.state.contents.get(id);
    if (content !== undefined && !this.platformSeedDocIds.has(id)) {
      this.queueRest(() =>
        this.db.from("docs").upsert(userDocDbRow(this.scopedUserId, doc, content), {
          onConflict: "user_id,id",
        }),
      );
    }
    return true;
  }

  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef {
    const id = hashContent(content);
    const now = Date.now();
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i >= 0) {
      // AI : content-addressed reuse — bump uploadedAt + filename so docsForProject picks this edit.
      const doc = buildDocRef({ id, name, type, label, content, uploadedAt: now });
      this.state.docs = [doc, ...this.state.docs.filter((_, j) => j !== i)];
      this.state.contents.set(id, content);
      this.queueRest(() =>
        this.db.from("docs").upsert(userDocDbRow(this.scopedUserId, doc, content), {
          onConflict: "user_id,id",
        }),
      );
      return doc;
    }
    const doc = buildDocRef({ id, name, type, label, content, uploadedAt: now });
    this.state.docs = [doc, ...this.state.docs];
    this.state.contents.set(id, content);
    this.queueRest(() =>
      this.db.from("docs").upsert(userDocDbRow(this.scopedUserId, doc, content), {
        onConflict: "user_id,id",
      }),
    );
    return doc;
  }

  removeDoc(id: DocId): boolean {
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i === -1) return false;
    const platformOnly = this.platformSeedDocIds.has(id);
    this.state.docs.splice(i, 1);
    this.state.contents.delete(id);
    purgeParserVisionCacheForDoc(this.cacheIndex, id);
    if (!platformOnly) {
      this.queueRest(() => this.db.from("docs").delete().eq("id", id));
    } else {
      this.platformSeedDocIds.delete(id);
    }
    if (this.hasParserCacheTable) {
      this.queueRest(() => this.db.from("doc_parser_cache").delete().eq("doc_id", id));
    }
    if (this.hasVisionCacheTable) {
      this.queueRest(() => this.db.from("doc_vision_cache").delete().eq("doc_id", id));
    }
    return true;
  }

  // AI : resync-examples — reload public.seed_docs after admin upsert from git.
  async refreshPlatformSeedDocsFromDb(): Promise<number> {
    clearPlatformSeedDocState(this.platformSeedDocState());
    this.platformSeedDocsLoaded = false;

    const seedDocs = await this.db.from("seed_docs").select("*");
    if (seedDocs.error) return 0;

    this.platformSeedDocsLoaded = true;
    return ingestPlatformSeedDocRows(this.platformSeedDocState(), (seedDocs.data ?? []) as DocDbRow[]);
  }

  // AI : legacy per-user bundled rows shadow seed_docs in memory until purged from public.docs.
  purgeStaleUserBundledDocsFromMemory(): number {
    const bundled = allBundledSeedDocNames();
    let removed = 0;
    for (let i = this.state.docs.length - 1; i >= 0; i--) {
      const doc = this.state.docs[i]!;
      if (!bundled.has(doc.name) || this.platformSeedDocIds.has(doc.id)) continue;
      this.state.docs.splice(i, 1);
      this.state.contents.delete(doc.id);
      removed += 1;
    }
    return removed;
  }

  runs(projectId?: ProjectId): PipelineRun[] {
    if (!projectId) return this.state.runs;
    return this.state.runs.filter((r) => this.state.runProjects[r.id] === projectId);
  }

  findRunByFingerprint(projectId: ProjectId, fingerprint: RunFingerprint): PipelineRun | undefined {
    return this.runs(projectId).find((r) => r.status === "ok" && r.fingerprint === fingerprint);
  }

  addRun(projectId: ProjectId, run: PipelineRun): void {
    // AI : TODO — persist shared-project runs under teamProjectOwnerId so owners see member runs.
    this.state.runProjects[run.id] = projectId;
    this.state.runs = [run, ...this.state.runs];
    this.queueRest(() =>
      this.db.from("runs").upsert(this.withUserId(this.runRow(projectId, run)), { onConflict: "user_id,id" }),
    );
  }

  updateRunNotes(runId: PipelineRun["id"], notes: string | undefined): boolean {
    const i = this.state.runs.findIndex((r) => r.id === runId);
    if (i < 0) return false;
    const next = notes?.trim() ? notes.trim() : undefined;
    const prev = this.state.runs[i].notes;
    if (prev === next) return true;
    return this.patchRun(i, { notes: next });
  }

  updateRunTest(runId: PipelineRun["id"], test: RunTestReport | undefined): boolean {
    const i = this.state.runs.findIndex((r) => r.id === runId);
    if (i < 0) return false;
    return this.patchRun(i, { test });
  }

  // AI : shared upsert for post-run field patches (notes, test report).
  private patchRun(i: number, patch: Partial<PipelineRun>): boolean {
    const run = { ...this.state.runs[i], ...patch };
    this.state.runs[i] = run;
    const projectId = this.state.runProjects[run.id];
    this.queueRest(() =>
      this.db.from("runs").upsert(this.withUserId(this.runRow(projectId, run)), { onConflict: "user_id,id" }),
    );
    return true;
  }

  // AI : drop project upserts when another request deleted the row after this store loaded.
  private async dropConcurrentlyDeletedProjects(): Promise<void> {
    if (this.pendingProjectUpserts.size === 0) return;
    const { data, error } = await this.db.from("projects").select("id").eq("user_id", this.scopedUserId);
    if (error) return;
    const dbIds = new Set((data ?? []).map((row) => row.id as ProjectId));
    for (const id of [...this.pendingProjectUpserts.keys()]) {
      if (this.createdProjectIds.has(id)) continue;
      if (this.projectIdsAtInit.has(id) && !dbIds.has(id)) {
        this.pendingProjectUpserts.delete(id);
        this.state.projects = this.state.projects.filter((p) => p.id !== id);
      }
    }
  }

  // AI : await all queued writes; routes call this once before (or right after) responding.
  async flush(): Promise<void> {
    const run = this.flushTail.then(() => this.flushNow());
    this.flushTail = run.catch(() => undefined);
    await run;
  }

  // AI : warm store may flush long after route auth — revalidate JWT so RLS upserts see auth.uid().
  private async ensureFreshWriteAuth(): Promise<void> {
    const { data, error } = await this.db.auth.getUser();
    if (error || !data.user) throw new Error(AUTH_SIGN_IN_REQUIRED);
  }

  private async flushNow(): Promise<void> {
    await this.ensureFreshWriteAuth();
    const onlyNewProjects =
      this.pendingProjectUpserts.size > 0 &&
      [...this.pendingProjectUpserts.keys()].every((id) => this.createdProjectIds.has(id));
    if (!onlyNewProjects) await this.dropConcurrentlyDeletedProjects();
    const flushingCreatedIds = [...this.pendingProjectUpserts.keys()].filter((id) =>
      this.createdProjectIds.has(id),
    );
    const pendingProjectRows = [...this.pendingProjectUpserts.values()];
    this.pendingProjectUpserts.clear();
    const projectUpserts = pendingProjectRows.map((row) =>
      this.db.from("projects").upsert(row, { onConflict: "user_id,id" }),
    );
    const pendingRestOps = this.pendingRest;
    this.pendingRest = [];
    const results = await Promise.all([
      ...projectUpserts,
      ...pendingRestOps.map((op) => op()),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) {
      // AI : drop only creates that never landed — keep ones that upserted before a later pendingRest error.
      for (const id of flushingCreatedIds) {
        const { data } = await this.db
          .from("projects")
          .select("id")
          .eq("user_id", this.scopedUserId)
          .eq("id", id)
          .maybeSingle();
        if (data) {
          this.createdProjectIds.delete(id);
          this.projectIdsAtInit.add(id);
        } else {
          this.dropLocalProject(id);
        }
      }
      throw failed.error;
    }
    for (const id of flushingCreatedIds) {
      this.createdProjectIds.delete(id);
      this.projectIdsAtInit.add(id);
    }
  }
}

// AI : schema.sql may not be applied yet — detect missing tables and fall back to local JSON.
export function isMissingSchemaError(error: unknown): boolean {
  const msg = storeErrorMessage(error, String(error));
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  return (
    code === "PGRST205" ||
    msg.includes("schema cache") ||
    msg.includes("Could not find the table") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

// AI : a ready store for one signed-in user — zero projects is valid (client shows the
// AI : no-projects page), so nothing is auto-created here anymore.
export async function openUserStore(db: SupabaseClient, userId: user_id_string): Promise<SupabaseStore> {
  const s = new SupabaseStore(db, userId);
  await s.init();
  return s;
}
