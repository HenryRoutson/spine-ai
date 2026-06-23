import type { SupabaseClient } from "@supabase/supabase-js";
// AI : adopted from backend_with_users/ — implements the same Store contract, so
// AI : runPipeline & co accept this store unchanged. RLS scopes every row to the
// AI : signed-in user behind `db`; no user_id handling anywhere in app code.
import { ensureSeeded, hashContent, type Store } from "./store";
import { storeErrorMessage } from "./errors";
import { migrateProjectModules } from "./validity";
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
  content: string;
}

// AI : Supabase twin of JsonStore. The Store contract is synchronous, so: load everything
// AI : for the signed-in user once in init(), serve reads from memory, and queue
// AI : write-behind upserts that flush() awaits (routes flush before responding).
export class SupabaseStore implements Store {
  private state = {
    projects: [] as Project[],
    docs: [] as DocRef[],
    contents: new Map<DocId, string>(),
    runs: [] as PipelineRun[],
    runProjects: {} as Record<string, ProjectId>,
  };
  private pending: PromiseLike<{ error: unknown }>[] = [];
  // AI : 002_run_fingerprint.sql may not be applied yet — fingerprint still lives in runs.data jsonb.
  private hasFingerprintColumn = false;

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
    this.pending.push(this.db.from("docs").delete().eq("id", id));
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

// AI : a ready store for one signed-in user — first sign-in gets the seed projects + docs,
// AI : mirroring what JsonStore.init() does for the anonymous local store.
export async function openUserStore(db: SupabaseClient): Promise<SupabaseStore> {
  const s = new SupabaseStore(db);
  await s.init();
  // AI : only seed empty stores — ensureSeeded on every request was rewriting projects (syncProjectFromSeed) and busting run fingerprints.
  if (s.projects().length === 0) {
    await ensureSeeded(s);
    await s.flush();
  }
  return s;
}
