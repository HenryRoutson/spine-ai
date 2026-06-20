import type { SupabaseClient } from "@supabase/supabase-js";
// AI : adopted from backend_with_users/ — implements the same Store contract, so
// AI : runPipeline & co accept this store unchanged. RLS scopes every row to the
// AI : signed-in user behind `db`; no user_id handling anywhere in app code.
import { ensureSeeded, hashContent, type Store } from "./store";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineRun,
  Project,
  ProjectId,
} from "./types";

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

  constructor(private db: SupabaseClient) {}

  async init(): Promise<void> {
    const [projects, docs, runs] = await Promise.all([
      this.db.from("projects").select("data"),
      this.db.from("docs").select("*").order("uploaded_at", { ascending: false }),
      this.db.from("runs").select("project_id, data").order("started_at", { ascending: false }),
    ]);
    for (const r of [projects, docs, runs]) if (r.error) throw r.error;
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
    for (const row of runs.data ?? []) {
      const run = row.data as PipelineRun;
      this.state.runs.push(run);
      this.state.runProjects[run.id] = row.project_id as ProjectId;
    }
  }

  projects(): Project[] {
    return this.state.projects;
  }

  project(id: ProjectId): Project | undefined {
    return this.state.projects.find((p) => p.id === id);
  }

  saveProject(p: Project): void {
    const i = this.state.projects.findIndex((x) => x.id === p.id);
    if (i === -1) this.state.projects.push(p);
    else this.state.projects[i] = p;
    this.pending.push(
      this.db.from("projects").upsert({ id: p.id, data: p }, { onConflict: "user_id,id" }),
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

  runs(projectId?: ProjectId): PipelineRun[] {
    if (!projectId) return this.state.runs;
    return this.state.runs.filter((r) => this.state.runProjects[r.id] === projectId);
  }

  addRun(projectId: ProjectId, run: PipelineRun): void {
    this.state.runProjects[run.id] = projectId;
    this.state.runs = [run, ...this.state.runs];
    this.pending.push(
      this.db.from("runs").upsert(
        { id: run.id, project_id: projectId, started_at: run.startedAt, data: run },
        { onConflict: "user_id,id" },
      ),
    );
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
  const msg = storeErrorMessage(error);
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

function storeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return String(err);
}

// AI : a ready store for one signed-in user — first sign-in gets the seed projects + docs,
// AI : mirroring what JsonStore.init() does for the anonymous local store.
export async function openUserStore(db: SupabaseClient): Promise<SupabaseStore> {
  const s = new SupabaseStore(db);
  await s.init();
  await ensureSeeded(s);
  await s.flush();
  return s;
}
