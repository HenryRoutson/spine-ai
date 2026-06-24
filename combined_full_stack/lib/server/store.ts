import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import {
  allProjectSeeds,
  blankProject,
  isUnavailableSeedDoc,
  readSeedDocContent,
  type SeedDocSpec,
} from "./seed";
import { computeInvalid, migrateProjectModules, syncAutoQuoteSteps } from "./validity";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  PipelineModule,
  PipelineRun,
  Project,
  ProjectId,
  RunFingerprint,
  RunId,
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
// AI : TODO bug (prod) — local disk only; SupabaseStore persists text in `docs` but not PDF
// AI : bytes, and on Vercel this lands in ephemeral /tmp. User uploads → GET /file 404.
// AI : Fix: Supabase Storage (or inline blob) + serve from there, not dataDir().
export function savePdfBytes(id: DocId, bytes: Uint8Array): void {
  mkdirSync(docsDir(), { recursive: true });
  writeFileSync(join(docsDir(), `${id}.pdf`), bytes);
}

// AI : lazy backfill — match seed PDFs via their .txt sidecar hash (no pdf-parse on serverless).
// AI : uploaded PDFs are not backfilled here — only bundled seed sidecars (see savePdfBytes TODO).
export async function pdfFilePath(id: DocId): Promise<string | undefined> {
  const path = join(docsDir(), `${id}.pdf`);
  if (existsSync(path)) return path;
  for (const seed of allProjectSeeds()) {
    for (const spec of seed.docSpecs) {
      // AI : match by extracted-text hash — seed docs may be typed "text" while still shipping a PDF sidecar.
      const txtSidecar = spec.path.replace(/\.pdf$/i, ".txt");
      if (!existsSync(txtSidecar)) continue;
      if (hashContent(readFileSync(txtSidecar, "utf8")) !== id) continue;
      const pdfPath = spec.path.endsWith(".pdf") ? spec.path : spec.path.replace(/\.txt$/i, ".pdf");
      if (!existsSync(pdfPath)) continue;
      mkdirSync(docsDir(), { recursive: true });
      copyFileSync(pdfPath, path);
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
  deleteProject(id: ProjectId): boolean;
  docs(): DocRef[];
  docContent(id: DocId): string | undefined;
  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef;
  removeDoc(id: DocId): boolean;
  runs(projectId?: ProjectId): PipelineRun[];
  findRunByFingerprint(projectId: ProjectId, fingerprint: RunFingerprint): PipelineRun | undefined;
  addRun(projectId: ProjectId, run: PipelineRun): void;
  updateRunNotes(runId: PipelineRun["id"], notes: string | undefined): boolean;
  flush(): Promise<void>;
}

// AI : keep persisted seed projects aligned with seeds/*.json — merge new modules (e.g. Link Quotes)
// AI : while preserving user cached/model/prompt overrides on steps they already had.
export function syncProjectFromSeed(existing: Project, seed: Project): Project {
  const seedDocNames = seed.seedDocNames?.length ? seed.seedDocNames : existing.seedDocNames;

  if (existing.id !== seed.id) {
    let next = existing;
    if (seedDocNames?.length && !existing.seedDocNames?.length)
      next = { ...next, seedDocNames };
    let modules = next.modules.map((m) => {
      const sm = seed.modules.find((s) => s.id === m.id);
      if (!sm || (m.label === sm.label && m.note === sm.note)) return m;
      return { ...m, label: sm.label, note: sm.note };
    });
    modules = syncAutoQuoteSteps(modules, next.models);
    const invalid = computeInvalid(modules, next.models);
    if (invalid.size > 0) {
      const seedIds = new Set(seed.modules.map((m) => m.id));
      const drop = [...invalid.keys()].filter((id) => !seedIds.has(id));
      if (drop.length) modules = modules.filter((m) => !drop.includes(m.id));
    }
    const changed =
      seedDocNames !== existing.seedDocNames ||
      modules.length !== next.modules.length ||
      modules.some((m, i) => m !== next.modules[i]);
    return changed ? { ...next, modules } : next;
  }

  // AI : seed-owned project — reset models + linear step graph from seeds/*.json; keep runtime overrides only.
  const models = structuredClone(seed.models);
  let modules = seed.modules.map((sm) => {
    const em = existing.modules.find((m) => m.id === sm.id);
    if (!em) return structuredClone(sm);
    return {
      ...sm,
      cached: em.cached,
      model: em.model ?? sm.model,
      prompt: em.prompt ?? sm.prompt,
      code: em.code ?? sm.code,
    };
  });
  modules = syncAutoQuoteSteps(modules, models);
  const migrated = migrateProjectModules({ ...existing, seedDocNames, models, modules });
  const same =
    existing.seedDocNames?.join() === migrated.seedDocNames?.join() &&
    JSON.stringify(existing.models) === JSON.stringify(migrated.models) &&
    JSON.stringify(existing.modules) === JSON.stringify(migrated.modules);
  return same ? existing : migrated;
}

// AI : pull latest seeds/*.json into built-in example project rows (same ids as templates).
export function resyncSeedOwnedProjects(store: Store): number {
  let updated = 0;
  for (const seed of allProjectSeeds()) {
    const existing = store.project(seed.project.id);
    if (!existing) continue;
    const synced = syncProjectFromSeed(existing, seed.project);
    if (synced !== existing) {
      store.saveProject(synced);
      updated += 1;
    }
  }
  return updated;
}

// AI : idempotent — upsert every seeds/*.json project (+ ingest its source docs) that the
// AI : store doesn't have yet. Shared by JsonStore.init() and per-user first-sign-in seeding.
export async function ensureSeeded(store: Store): Promise<void> {
  for (const seed of allProjectSeeds()) {
    const existing = store.project(seed.project.id);
    if (!existing) {
      store.saveProject(migrateProjectModules(structuredClone(seed.project)));
    } else {
      const synced = syncProjectFromSeed(existing, seed.project);
      if (synced !== existing) store.saveProject(synced);
    }
    for (const spec of seed.docSpecs) {
      try {
        await ingestSeedDoc(store, spec);
      } catch (err) {
        console.error(`seed doc failed (${spec.name}):`, err);
      }
    }
  }
  for (const p of store.projects()) {
    const migrated = migrateProjectModules(p);
    if (migrated !== p) store.saveProject(migrated);
  }
}

// AI : add missing seed docs; replace stale Vercel placeholder rows when real content is available.
async function ingestSeedDoc(store: Store, spec: SeedDocSpec): Promise<void> {
  const fresh = await readSeedDocContent(spec);
  const existing = store.docs().find((d) => d.name === spec.name);
  if (!existing) {
    store.addDoc(spec.name, spec.type, fresh, spec.label);
    return;
  }
  const content = store.docContent(existing.id);
  if (
    content &&
    isUnavailableSeedDoc(content, spec.name) &&
    !isUnavailableSeedDoc(fresh, spec.name)
  ) {
    store.removeDoc(existing.id);
    store.addDoc(spec.name, spec.type, fresh, spec.label);
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
    const migrated = migrateProjectModules(p);
    const i = this.state.projects.findIndex((x) => x.id === migrated.id);
    if (i === -1) this.state.projects.push(migrated);
    else this.state.projects[i] = migrated;
    this.persist();
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
    this.persist();
    return true;
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

  removeDoc(id: DocId): boolean {
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i === -1) return false;
    this.state.docs.splice(i, 1);
    const path = join(this.docsDir, `${id}.txt`);
    if (existsSync(path)) unlinkSync(path);
    this.persist();
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
    this.state.runs = [run, ...this.state.runs].slice(0, 100);
    const kept = new Set(this.state.runs.map((r) => r.id));
    for (const id of Object.keys(this.state.runProjects)) {
      if (!kept.has(id as RunId)) delete this.state.runProjects[id as RunId];
    }
    this.persist();
  }

  updateRunNotes(runId: PipelineRun["id"], notes: string | undefined): boolean {
    const i = this.state.runs.findIndex((r) => r.id === runId);
    if (i < 0) return false;
    const next = notes?.trim() ? notes.trim() : undefined;
    const prev = this.state.runs[i].notes;
    if (prev === next) return true;
    this.state.runs[i] = { ...this.state.runs[i], notes: next };
    this.persist();
    return true;
  }
}

// AI : convenience — an initialised store for scripts/tests.
export async function openStore(): Promise<JsonStore> {
  const s = new JsonStore();
  await s.init();
  return s;
}
