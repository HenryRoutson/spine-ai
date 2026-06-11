import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config.js";
import { pdfToText } from "./pdf_to_text.js";
import { blankProject, defaultProject, seedDocSpecs } from "./seed.js";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineRun,
  Project,
  ProjectId,
} from "./types.js";

// AI : content hash == doc id, so identical uploads dedupe to one ref (Documents tab).
export function hashContent(content: string): DocId {
  return ("sha_" + createHash("sha256").update(content).digest("hex").slice(0, 16)) as DocId;
}

interface Persisted {
  projects: Project[];
  docs: DocRef[];
  runs: PipelineRun[];
  runProjects: Record<string, ProjectId>; // runId → owning project
}

// AI : the ONE storage interface. JsonStore is the local-JSON prototype; swap the impl for
// AI : Supabase later (needed for sign-ins) without touching any call site.
export interface Store {
  projects(): Project[];
  project(id: ProjectId): Project | undefined;
  saveProject(p: Project): void;
  docs(): DocRef[];
  docContent(id: DocId): string | undefined;
  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef;
  runs(projectId?: ProjectId): PipelineRun[];
  addRun(projectId: ProjectId, run: PipelineRun): void;
}

export class JsonStore implements Store {
  private dir = dataDir();
  private storeFile = join(this.dir, "store.json");
  private docsDir = join(this.dir, "docs");
  private state: Persisted = { projects: [], docs: [], runs: [], runProjects: {} };

  // AI : idempotent — load from disk, else seed the default project + real docs (parses PDFs).
  async init(): Promise<void> {
    mkdirSync(this.docsDir, { recursive: true });
    if (existsSync(this.storeFile)) {
      this.state = JSON.parse(readFileSync(this.storeFile, "utf8")) as Persisted;
      this.state.runProjects ??= {};
      return;
    }
    this.state.projects = [defaultProject(), blankProject("p_blank" as ProjectId)];
    for (const spec of seedDocSpecs) {
      const content = await pdfToText(spec.pdfPath);
      this.ingest(spec.name, spec.type, content, spec.label);
    }
    this.flush();
  }

  private flush(): void {
    writeFileSync(this.storeFile, JSON.stringify(this.state, null, 2), "utf8");
  }

  private ingest(name: string, type: InputType, content: string, label: DocLabel): DocRef {
    const id = hashContent(content);
    const existing = this.state.docs.find((d) => d.id === id);
    if (existing) return existing;
    writeFileSync(join(this.docsDir, `${id}.txt`), content, "utf8");
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
    return doc;
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
    this.flush();
  }

  docs(): DocRef[] {
    return this.state.docs;
  }

  docContent(id: DocId): string | undefined {
    const path = join(this.docsDir, `${id}.txt`);
    return existsSync(path) ? readFileSync(path, "utf8") : undefined;
  }

  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef {
    const doc = this.ingest(name, type, content, label);
    this.flush();
    return doc;
  }

  runs(projectId?: ProjectId): PipelineRun[] {
    if (!projectId) return this.state.runs;
    return this.state.runs.filter((r) => this.state.runProjects[r.id] === projectId);
  }

  addRun(projectId: ProjectId, run: PipelineRun): void {
    // AI : TODO bug — runs are capped at 100 but runProjects entries for evicted runs are never
    // AI : pruned, so the map grows unbounded in store.json.
    this.state.runProjects[run.id] = projectId;
    this.state.runs = [run, ...this.state.runs].slice(0, 100);
    this.flush();
  }
}

// AI : convenience — an initialised store for scripts/tests.
export async function openStore(): Promise<JsonStore> {
  const s = new JsonStore();
  await s.init();
  return s;
}
