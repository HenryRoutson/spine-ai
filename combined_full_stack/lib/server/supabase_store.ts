import type { SupabaseClient } from "@supabase/supabase-js";
// AI : TODO refactor (prod) — add original doc bytes via Supabase Storage (see store.ts saveOriginalDocBytes).
// AI : TODO bug (prod) — user-uploaded PDF/image bytes lost on redeploy; GET /api/docs/[id]/file 404s.
// AI : adopted from backend_with_users/ — implements the same Store contract, so
// AI : runPipeline & co accept this store unchanged. Session JWT + explicit user_id
// AI : on writes keep rows scoped to the signed-in user.
import { hashContent, type Store } from "./store";
import type { user_id_string } from "./require_auth";
import { storeErrorMessage } from "./errors";
import { migrateProjectModules } from "./validity";
import { stripSharedModels } from "./builtin_models";
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

interface DocRow {
  id: string;
  name: string;
  type: string;
  label: string;
  size_kb: number;
  uploaded_at: number;
  preview: string;
  content: string; // AI : built-in parser text only — vision OCR lives in doc_vision_cache
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
  private pendingRest: PromiseLike<{ error: unknown }>[] = [];
  // AI : last upsert wins per project id — lets flush drop rows deleted by a concurrent request.
  private pendingProjectUpserts = new Map<ProjectId, PromiseLike<{ error: unknown }>>();
  private projectIdsAtInit = new Set<ProjectId>();
  private createdProjectIds = new Set<ProjectId>();
  private hasFingerprintColumn = false;
  private hasVisionCacheTable = false;
  private hasParserCacheTable = false;

  constructor(
    private db: SupabaseClient,
    private scopedUserId: user_id_string,
  ) {}

  private withUserId<T extends Record<string, unknown>>(row: T): T {
    return { ...row, user_id: this.scopedUserId };
  }

  // AI : Supabase DELETE with RLS deny returns 204 + 0 rows — treat that as failure.
  private queueProjectDelete(id: ProjectId): void {
    this.pendingRest.push(
      (async () => {
        const { data, error } = await this.db
          .from("projects")
          .delete()
          .eq("user_id", this.scopedUserId)
          .eq("id", id)
          .select("id");
        if (error) return { error };
        if (!data?.length) return { error: new Error(`DELETE projects/${id} matched 0 rows`) };
        return { error: null };
      })(),
    );
  }

  async init(): Promise<void> {
    let projectsQ = this.db.from("projects").select("data").eq("user_id", this.scopedUserId);
    let docsQ = this.db.from("docs").select("*").order("uploaded_at", { ascending: false }).eq("user_id", this.scopedUserId);
    const [projects, docs] = await Promise.all([projectsQ, docsQ]);
    for (const r of [projects, docs]) if (r.error) throw r.error;

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

    this.state.projects = (projects.data ?? []).map((row) => row.data as Project);
    this.projectIdsAtInit = new Set(this.state.projects.map((p) => p.id));
    for (const row of (docs.data ?? []) as DocRow[]) {
      this.state.docs.push({
        id: row.id as DocId,
        name: row.name,
        type: row.type as InputType,
        label: row.label as DocLabel,
        sizeKb: row.size_kb,
        uploadedAt: row.uploaded_at,
        preview: row.preview,
      });
      this.state.contents.set(row.id as DocId, row.content);
    }
    for (const row of runRows) {
      const run = row.data as PipelineRun;
      const fingerprint = (row.fingerprint ?? run.fingerprint) as RunFingerprint | undefined;
      if (fingerprint) run.fingerprint = fingerprint;
      this.state.runs.push(run);
      this.state.runProjects[run.id] = row.project_id as ProjectId;
      if (this.hasFingerprintColumn && fingerprint && !row.fingerprint) {
        this.pendingRest.push(
          this.db.from("runs").update({ fingerprint }).eq("id", run.id),
        );
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
    const toPersist = { ...migrated, models: stripSharedModels(migrated.models) };
    const i = this.state.projects.findIndex((x) => x.id === toPersist.id);
    if (i === -1) {
      this.state.projects.push(toPersist);
      this.createdProjectIds.add(toPersist.id);
    } else this.state.projects[i] = toPersist;
    this.pendingProjectUpserts.set(
      toPersist.id,
      this.db.from("projects").upsert(this.withUserId({ id: toPersist.id, data: toPersist }), {
        onConflict: "user_id,id",
      }),
    );
  }

  deleteProject(id: ProjectId): boolean {
    const i = this.state.projects.findIndex((p) => p.id === id);
    if (i === -1) return false;
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
    this.queueProjectDelete(id);
    if (runIds.size) {
      this.pendingRest.push(
        this.db.from("runs").delete().eq("user_id", this.scopedUserId).eq("project_id", id),
      );
    }
    return true;
  }

  docs(): DocRef[] {
    return this.state.docs;
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
    this.pendingRest.push(
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
    this.pendingRest.push(
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
    if (content !== undefined) {
      this.pendingRest.push(
        this.db.from("docs").upsert(
          this.withUserId({
            id,
            name,
            type: doc.type,
            label: doc.label,
            size_kb: doc.sizeKb,
            uploaded_at: doc.uploadedAt,
            preview: doc.preview,
            content,
          }),
          { onConflict: "user_id,id" },
        ),
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
      const doc: DocRef = {
        ...this.state.docs[i]!,
        name,
        type,
        label,
        sizeKb: Math.max(1, Math.round(content.length / 1024)),
        uploadedAt: now,
        preview: content.slice(0, 180),
      };
      this.state.docs = [doc, ...this.state.docs.filter((_, j) => j !== i)];
      this.state.contents.set(id, content);
      this.pendingRest.push(
        this.db.from("docs").upsert(
          this.withUserId({
            id,
            name,
            type,
            label,
            size_kb: doc.sizeKb,
            uploaded_at: doc.uploadedAt,
            preview: doc.preview,
            content,
          }),
          { onConflict: "user_id,id" },
        ),
      );
      return doc;
    }
    const doc: DocRef = {
      id,
      name,
      type,
      label,
      sizeKb: Math.max(1, Math.round(content.length / 1024)),
      uploadedAt: now,
      preview: content.slice(0, 180),
    };
    this.state.docs = [doc, ...this.state.docs];
    this.state.contents.set(id, content);
    this.pendingRest.push(
      this.db.from("docs").upsert(
        this.withUserId({
          id,
          name,
          type,
          label,
          size_kb: doc.sizeKb,
          uploaded_at: doc.uploadedAt,
          preview: doc.preview,
          content,
        }),
        { onConflict: "user_id,id" },
      ),
    );
    return doc;
  }

  removeDoc(id: DocId): boolean {
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i === -1) return false;
    this.state.docs.splice(i, 1);
    this.state.contents.delete(id);
    purgeParserVisionCacheForDoc(this.cacheIndex, id);
    this.pendingRest.push(this.db.from("docs").delete().eq("id", id));
    if (this.hasParserCacheTable) {
      this.pendingRest.push(this.db.from("doc_parser_cache").delete().eq("doc_id", id));
    }
    if (this.hasVisionCacheTable) {
      this.pendingRest.push(this.db.from("doc_vision_cache").delete().eq("doc_id", id));
    }
    return true;
  }

  runs(projectId?: ProjectId): PipelineRun[] {
    if (!projectId) return this.state.runs;
    return this.state.runs.filter((r) => this.state.runProjects[r.id] === projectId);
  }

  findRunByFingerprint(projectId: ProjectId, fingerprint: RunFingerprint): PipelineRun | undefined {
    return this.runs(projectId).find((r) => r.status === "ok" && r.fingerprint === fingerprint);
  }

  addRun(projectId: ProjectId, run: PipelineRun): void {
    this.state.runProjects[run.id] = projectId;
    this.state.runs = [run, ...this.state.runs];
    this.pendingRest.push(
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
    this.pendingRest.push(
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
    await this.dropConcurrentlyDeletedProjects();
    const projectUpserts = [...this.pendingProjectUpserts.values()];
    this.pendingProjectUpserts.clear();
    const results = await Promise.all([...projectUpserts, ...this.pendingRest]);
    this.pendingRest = [];
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
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
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

// AI : a ready store for one signed-in user — zero projects is valid (client shows the
// AI : no-projects page), so nothing is auto-created here anymore.
export async function openUserStore(db: SupabaseClient, userId: user_id_string): Promise<SupabaseStore> {
  const s = new SupabaseStore(db, userId);
  await s.init();
  return s;
}
