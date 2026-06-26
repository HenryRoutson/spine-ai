import type { SupabaseClient } from "@supabase/supabase-js";
// AI : adopted from backend_with_users/ — implements the same Store contract, so
// AI : runPipeline & co accept this store unchanged. RLS scopes every row to the
// AI : signed-in user behind `db`; no user_id handling anywhere in app code.
import { hashContent, type Store } from "./store";
import { blankProject } from "./seed";
import { uid } from "../id";
import { storeErrorMessage } from "./errors";
import { migrateProjectModules } from "./validity";
import type {
  FileContentHash,
  ParserCacheKey,
  ParserCacheRow,
  ParserKind,
  VisionCacheKey,
  VisionCacheRow,
} from "./doc_text_cache";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineRun,
  Project,
  ProjectId,
  RunFingerprint,
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
    parserCache: new Map<ParserCacheKey, ParserCacheRow>(),
    parserCacheByDoc: new Map<DocId, ParserCacheRow>(),
    parserCacheByFile: new Map<string, ParserCacheRow>(),
    visionCache: new Map<VisionCacheKey, VisionCacheRow>(),
    runs: [] as PipelineRun[],
    runProjects: {} as Record<string, ProjectId>,
  };
  private pending: PromiseLike<{ error: unknown }>[] = [];
  private hasFingerprintColumn = false;
  private hasVisionCacheTable = false;
  private hasParserCacheTable = false;

  constructor(private db: SupabaseClient) {}

  async init(): Promise<void> {
    const [projects, docs] = await Promise.all([
      this.db.from("projects").select("data"),
      this.db.from("docs").select("*").order("uploaded_at", { ascending: false }),
    ]);
    for (const r of [projects, docs]) if (r.error) throw r.error;

    let runRows: RunRow[] = [];
    const runsWithFp = await this.db
      .from("runs")
      .select("project_id, started_at, data, fingerprint")
      .order("started_at", { ascending: false });
    if (runsWithFp.error?.message?.includes("fingerprint")) {
      this.hasFingerprintColumn = false;
      const runsLegacy = await this.db
        .from("runs")
        .select("project_id, started_at, data")
        .order("started_at", { ascending: false });
      if (runsLegacy.error) throw runsLegacy.error;
      runRows = (runsLegacy.data ?? []) as RunRow[];
    } else {
      if (runsWithFp.error) throw runsWithFp.error;
      this.hasFingerprintColumn = true;
      runRows = (runsWithFp.data ?? []) as RunRow[];
    }

    this.state.projects = (projects.data ?? []).map((row) => row.data as Project);
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
        this.pending.push(
          this.db.from("runs").update({ fingerprint }).eq("id", run.id),
        );
      }
    }

    const vision = await this.db.from("doc_vision_cache").select("*");
    if (vision.error) {
      this.hasVisionCacheTable = !isMissingSchemaError(vision.error);
      if (!isMissingSchemaError(vision.error)) throw vision.error;
    } else {
      this.hasVisionCacheTable = true;
      for (const row of (vision.data ?? []) as VisionCacheDbRow[]) {
        this.indexVisionRow({
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

    const parser = await this.db.from("doc_parser_cache").select("*");
    if (parser.error) {
      this.hasParserCacheTable = !isMissingSchemaError(parser.error);
      if (!isMissingSchemaError(parser.error)) throw parser.error;
    } else {
      this.hasParserCacheTable = true;
      for (const row of (parser.data ?? []) as ParserCacheDbRow[]) {
        this.indexParserRow({
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

  private indexVisionRow(row: VisionCacheRow): void {
    this.state.visionCache.set(row.key, row);
  }

  private indexParserRow(row: ParserCacheRow): void {
    this.state.parserCache.set(row.key, row);
    this.state.parserCacheByDoc.set(row.docId, row);
    this.state.parserCacheByFile.set(`${row.parser}:${row.fileHash}`, row);
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
    const i = this.state.projects.findIndex((x) => x.id === migrated.id);
    if (i === -1) this.state.projects.push(migrated);
    else this.state.projects[i] = migrated;
    this.pending.push(
      this.db.from("projects").upsert({ id: migrated.id, data: migrated }, { onConflict: "user_id,id" }),
    );
  }

  deleteProject(id: ProjectId): boolean {
    if (this.state.projects.length <= 1) return false;
    const i = this.state.projects.findIndex((p) => p.id === id);
    if (i === -1) return false;
    this.state.projects.splice(i, 1);
    const runIds = new Set(
      Object.entries(this.state.runProjects)
        .filter(([, pid]) => pid === id)
        .map(([rid]) => rid),
    );
    this.state.runs = this.state.runs.filter((r) => !runIds.has(r.id));
    for (const rid of runIds) delete this.state.runProjects[rid];
    this.pending.push(this.db.from("projects").delete().eq("id", id));
    if (runIds.size)
      this.pending.push(this.db.from("runs").delete().eq("project_id", id));
    return true;
  }

  docs(): DocRef[] {
    return this.state.docs;
  }

  docContent(id: DocId): string | undefined {
    return this.state.contents.get(id);
  }

  parserCacheGetByFileHash(fileHash: FileContentHash, parser: ParserKind): ParserCacheRow | undefined {
    return this.state.parserCacheByFile.get(`${parser}:${fileHash}`);
  }

  parserCacheGetByDoc(docId: DocId): ParserCacheRow | undefined {
    return this.state.parserCacheByDoc.get(docId);
  }

  parserCacheSet(row: Omit<ParserCacheRow, "createdAt"> & { createdAt?: number }): void {
    const payload: ParserCacheRow = { ...row, createdAt: row.createdAt ?? Date.now() };
    this.indexParserRow(payload);
    if (!this.hasParserCacheTable) return;
    this.pending.push(
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
    return this.state.visionCache.get(key);
  }

  visionCacheSet(row: Omit<VisionCacheRow, "createdAt"> & { createdAt?: number }): void {
    const payload: VisionCacheRow = { ...row, createdAt: row.createdAt ?? Date.now() };
    this.indexVisionRow(payload);
    if (!this.hasVisionCacheTable) return;
    this.pending.push(
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
    return [...this.state.visionCache.values()]
      .filter((r) => r.docId === docId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef {
    const id = hashContent(content);
    const existing = this.state.docs.find((d) => d.id === id);
    if (existing) return existing;
    const doc: DocRef = {
      id,
      name,
      type,
      label,
      sizeKb: Math.max(1, Math.round(content.length / 1024)),
      uploadedAt: Date.now(),
      preview: content.slice(0, 180),
    };
    this.state.docs = [doc, ...this.state.docs];
    this.state.contents.set(id, content);
    this.pending.push(
      this.db.from("docs").upsert(
        {
          id,
          name,
          type,
          label,
          size_kb: doc.sizeKb,
          uploaded_at: doc.uploadedAt,
          preview: doc.preview,
          content,
        },
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
    for (const [key, row] of this.state.parserCache) {
      if (row.docId === id) {
        this.state.parserCache.delete(key);
        this.state.parserCacheByFile.delete(`${row.parser}:${row.fileHash}`);
      }
    }
    this.state.parserCacheByDoc.delete(id);
    for (const [key, row] of this.state.visionCache) {
      if (row.docId === id) this.state.visionCache.delete(key);
    }
    this.pending.push(this.db.from("docs").delete().eq("id", id));
    if (this.hasParserCacheTable) {
      this.pending.push(this.db.from("doc_parser_cache").delete().eq("doc_id", id));
    }
    if (this.hasVisionCacheTable) {
      this.pending.push(this.db.from("doc_vision_cache").delete().eq("doc_id", id));
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
    this.pending.push(
      this.db.from("runs").upsert(this.runRow(projectId, run), { onConflict: "user_id,id" }),
    );
  }

  updateRunNotes(runId: PipelineRun["id"], notes: string | undefined): boolean {
    const i = this.state.runs.findIndex((r) => r.id === runId);
    if (i < 0) return false;
    const next = notes?.trim() ? notes.trim() : undefined;
    const prev = this.state.runs[i].notes;
    if (prev === next) return true;
    const run = { ...this.state.runs[i], notes: next };
    this.state.runs[i] = run;
    const projectId = this.state.runProjects[runId];
    this.pending.push(
      this.db.from("runs").upsert(this.runRow(projectId, run), { onConflict: "user_id,id" }),
    );
    return true;
  }

  // AI : await all queued writes; routes call this once before (or right after) responding.
  async flush(): Promise<void> {
    const results = await Promise.all(this.pending);
    this.pending = [];
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

// AI : a ready store for one signed-in user — first sign-in gets a blank project + bundled docs.
export async function openUserStore(db: SupabaseClient): Promise<SupabaseStore> {
  const s = new SupabaseStore(db);
  await s.init();
  if (s.projects().length === 0) {
    s.saveProject(blankProject(uid<ProjectId>("p_")));
    await s.flush();
  }
  return s;
}
