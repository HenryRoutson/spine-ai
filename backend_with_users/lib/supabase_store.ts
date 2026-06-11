import type { SupabaseClient } from "@supabase/supabase-js";
// AI : import (not clone) the backend contract — the whole point is that runPipeline & co
// AI : accept this store unchanged.
import { hashContent, type Store } from "../../backend/lib/store.js";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineRun,
  Project,
  ProjectId,
} from "../../backend/lib/types.js";

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
// AI : for the signed-in user once in init() (RLS scopes the rows — zero user_id handling
// AI : here), serve reads from memory, and queue write-behind upserts that flush() awaits.
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
    this.pending.push(this.db.from("projects").upsert({ id: p.id, data: p }));
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
      this.db.from("docs").upsert({
        id,
        name,
        type,
        label,
        size_kb: doc.sizeKb,
        uploaded_at: doc.uploadedAt,
        preview: doc.preview,
        content,
      }),
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
      this.db.from("runs").upsert({ id: run.id, project_id: projectId, started_at: run.startedAt, data: run }),
    );
  }

  // AI : await all queued writes; call once per request/script before exiting.
  async flush(): Promise<void> {
    const results = await Promise.all(this.pending);
    this.pending = [];
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
  }
}

// AI : convenience mirroring backend openStore() — a ready store for one signed-in user.
export async function openUserStore(db: SupabaseClient): Promise<SupabaseStore> {
  const s = new SupabaseStore(db);
  await s.init();
  return s;
}
