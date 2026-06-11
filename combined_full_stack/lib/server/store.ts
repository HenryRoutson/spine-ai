import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import { pdfToText } from "./pdf_to_text";
import { allProjectSeeds, blankProject, type SeedDocSpec } from "./seed";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineRun,
  Project,
  ProjectId,
} from "./types";

// AI : content hash == doc id, so identical uploads dedupe to one ref (Documents tab).
export function hashContent(content: string): DocId {
  return ("sha_" + createHash("sha256").update(content).digest("hex").slice(0, 16)) as DocId;
}

function docsDir(): string {
  return join(dataDir(), "docs");
}

// AI : original PDF bytes live beside the extracted text (data/docs/<hash>.pdf) so the
// AI : doc viewer can render the real file — the extracted text stays the canonical content.
export function savePdfBytes(id: DocId, bytes: Uint8Array): void {
  mkdirSync(docsDir(), { recursive: true });
  writeFileSync(join(docsDir(), `${id}.pdf`), bytes);
}

// AI : lazy backfill — docs ingested before originals were kept (existing store.json,
// AI : per-user Supabase seeds) resolve by hashing each seed PDF's extracted text once
// AI : and copying the matching original into place.
export async function pdfFilePath(id: DocId): Promise<string | undefined> {
  const path = join(docsDir(), `${id}.pdf`);
  if (existsSync(path)) return path;
  for (const seed of allProjectSeeds()) {
    for (const spec of seed.docSpecs) {
      if (spec.type !== "pdf" || hashContent(await pdfToText(spec.path)) !== id) continue;
      mkdirSync(docsDir(), { recursive: true });
      copyFileSync(spec.path, path);
      return path;
    }
  }
  return undefined;
}

interface Persisted {
  projects: Project[];
  docs: DocRef[];
  runs: PipelineRun[];
  runProjects: Record<string, ProjectId>; // runId → owning project
}

// AI : the ONE storage interface — JsonStore (local JSON) and SupabaseStore (per-user, RLS)
// AI : both implement it, so runPipeline & co never know which one they're on.
// AI : reads/writes are sync; flush() awaits any write-behind persistence (no-op for JSON).
export interface Store {
  projects(): Project[];
  project(id: ProjectId): Project | undefined;
  saveProject(p: Project): void;
  docs(): DocRef[];
  docContent(id: DocId): string | undefined;
  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef;
  runs(projectId?: ProjectId): PipelineRun[];
  addRun(projectId: ProjectId, run: PipelineRun): void;
  flush(): Promise<void>;
}

// AI : keep persisted projects aligned with seeds/*.json label/note tweaks (no module reorder).
function syncProjectFromSeed(existing: Project, seed: Project): Project {
  let next = existing
  if (!existing.seedDocNames?.length && seed.seedDocNames?.length)
    next = { ...next, seedDocNames: seed.seedDocNames }
  const modules = next.modules.map((m) => {
    const sm = seed.modules.find((s) => s.id === m.id)
    if (!sm || (m.label === sm.label && m.note === sm.note)) return m
    return { ...m, label: sm.label, note: sm.note }
  })
  return modules.some((m, i) => m !== next.modules[i]) ? { ...next, modules } : next
}

// AI : idempotent — upsert every seeds/*.json project (+ ingest its source docs) that the
// AI : store doesn't have yet. Shared by JsonStore.init() and per-user first-sign-in seeding.
export async function ensureSeeded(store: Store): Promise<void> {
  for (const seed of allProjectSeeds()) {
    const existing = store.project(seed.project.id);
    if (!existing) {
      store.saveProject(structuredClone(seed.project));
      for (const spec of seed.docSpecs) store.addDoc(spec.name, spec.type, await seedDocContent(spec), spec.label);
      continue;
    }
    // AI : backfill seedDocNames + module labels from seeds/*.json on existing projects.
    const synced = syncProjectFromSeed(existing, seed.project);
    if (synced !== existing) store.saveProject(synced);
  }
}

export class JsonStore implements Store {
  private dir = dataDir();
  private storeFile = join(this.dir, "store.json");
  private docsDir = docsDir();
  private state: Persisted = { projects: [], docs: [], runs: [], runProjects: {} };

  // AI : idempotent — load from disk, then upsert any seed project the store doesn't have yet
  // AI : (so newly authored seeds/*.json land in existing stores too) + ingest its real docs.
  async init(): Promise<void> {
    mkdirSync(this.docsDir, { recursive: true });
    const fresh = !existsSync(this.storeFile);
    if (!fresh) {
      this.state = JSON.parse(readFileSync(this.storeFile, "utf8")) as Persisted;
      this.state.runProjects ??= {};
    }
    await ensureSeeded(this);
    if (fresh) {
      this.state.projects.push(blankProject("p_blank" as ProjectId));
      this.persist();
    }
  }

  // AI : JSON writes are synchronous per mutation — nothing left to await.
  async flush(): Promise<void> {}

  private persist(): void {
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
    this.persist();
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
    this.persist();
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
    this.persist();
  }
}

// AI : only PDFs need parsing — json/text seed docs are stored verbatim.
async function seedDocContent(spec: SeedDocSpec): Promise<string> {
  return spec.type === "pdf" ? pdfToText(spec.path) : readFileSync(spec.path, "utf8");
}

// AI : convenience — an initialised store for scripts/tests.
export async function openStore(): Promise<JsonStore> {
  const s = new JsonStore();
  await s.init();
  return s;
}
