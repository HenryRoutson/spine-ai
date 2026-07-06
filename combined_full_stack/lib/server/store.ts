import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import {
  allProjectSeeds,
  backfillSeedDocNames,
  blankProject,
  isSeedTemplateProject,
  isUnavailableSeedDoc,
  readSeedDocContent,
  unavailableSeedDocMessage,
  seedTemplateIds,
  userProjectsFrom,
  type SeedDocSpec,
} from "./seed";
import { isTestingFileName } from "../testing-files";
import { computeInvalid, migrateProjectModules, syncManagedPipelineSteps } from "./validity";
import { stripSharedModels } from "./builtin_models";
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
  RunTestReport,
} from "./types";
import {
  parserCacheKey,
  type FileContentHash,
  type ParserCacheRow,
  type ParserKind,
  type VisionCacheKey,
  type VisionCacheRow,
} from "./doc_text_cache";

function visionCacheDir(): string {
  return join(dataDir(), "vision_cache");
}

function parserCacheDir(): string {
  return join(dataDir(), "parser_cache");
}

// AI : content hash == doc id, so identical uploads dedupe to one ref (Documents tab).
export function hashContent(content: string): DocId {
  return ("sha_" + createHash("sha256").update(content).digest("hex").slice(0, 16)) as DocId;
}

function docsDir(): string {
  return join(dataDir(), "docs");
}

// AI : original file bytes live beside extracted text (data/docs/<hash>.<ext>) for PDF viewer + vision OCR.
// AI : TODO bug (prod) — local disk only; SupabaseStore persists text in `docs` but not file
// AI : bytes, and on Vercel this lands in ephemeral /tmp. User uploads → GET /file 404.
// AI : Fix: Supabase Storage (or inline blob) + serve from there, not dataDir().
const ORIGINAL_DOC_EXTS = ["pdf", "png", "jpg", "jpeg", "webp"] as const;
type OriginalDocExt = (typeof ORIGINAL_DOC_EXTS)[number];

const EXT_MIME: Record<OriginalDocExt, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function saveOriginalDocBytes(id: DocId, bytes: Uint8Array, ext: string): void {
  const safe = ext.toLowerCase().replace(/^\./, "") as OriginalDocExt;
  if (!ORIGINAL_DOC_EXTS.includes(safe)) return;
  mkdirSync(docsDir(), { recursive: true });
  writeFileSync(join(docsDir(), `${id}.${safe}`), bytes);
}

/** @deprecated use saveOriginalDocBytes */
export function savePdfBytes(id: DocId, bytes: Uint8Array): void {
  saveOriginalDocBytes(id, bytes, "pdf");
}

export type OriginalDocFile = { path: string; mime: string; ext: OriginalDocExt };

function copySeedPdfToDocsDir(id: DocId, pdfPath: string): OriginalDocFile {
  const dest = join(docsDir(), `${id}.pdf`);
  mkdirSync(docsDir(), { recursive: true });
  copyFileSync(pdfPath, dest);
  return { path: dest, mime: EXT_MIME.pdf, ext: "pdf" };
}

export async function originalDocFile(id: DocId, docName?: string): Promise<OriginalDocFile | undefined> {
  for (const ext of ORIGINAL_DOC_EXTS) {
    const path = join(docsDir(), `${id}.${ext}`);
    if (existsSync(path)) return { path, mime: EXT_MIME[ext], ext };
  }
  return backfillSeedOriginalDoc(id, docName);
}

async function backfillSeedOriginalDoc(id: DocId, docName?: string): Promise<OriginalDocFile | undefined> {
  for (const seed of allProjectSeeds()) {
    for (const spec of seed.docSpecs) {
      const txtSidecar = spec.path.replace(/\.pdf$/i, ".txt");
      if (existsSync(txtSidecar) && hashContent(readFileSync(txtSidecar, "utf8")) === id) {
        const pdfPath = spec.path.endsWith(".pdf") ? spec.path : spec.path.replace(/\.txt$/i, ".pdf");
        if (existsSync(pdfPath)) return copySeedPdfToDocsDir(id, pdfPath);
      }
      // AI : seed docs may be .md/.json — hash ingested text, not only a .txt sidecar path.
      try {
        const content = await readSeedDocContent(spec);
        if (hashContent(content) === id) {
          const pdfPath = spec.path.endsWith(".pdf")
            ? spec.path
            : spec.path.replace(/\.(txt|md|json)$/i, ".pdf");
          if (existsSync(pdfPath)) return copySeedPdfToDocsDir(id, pdfPath);
        }
      } catch {
        // skip missing seed files
      }
    }
  }

  // AI : match bundled PDF by stored doc name when hash backfill misses (re-uploaded seed filename).
  if (docName) {
    for (const seed of allProjectSeeds()) {
      for (const spec of seed.docSpecs) {
        if (spec.name !== docName) continue;
        const pdfPath = spec.path.endsWith(".pdf")
          ? spec.path
          : spec.path.replace(/\.(txt|md|json)$/i, ".pdf");
        if (existsSync(pdfPath)) return copySeedPdfToDocsDir(id, pdfPath);
      }
    }
  }
  return undefined;
}

// AI : lazy backfill — match seed PDFs via their .txt sidecar hash (no pdf-parse on serverless).
export async function pdfFilePath(id: DocId): Promise<string | undefined> {
  const file = await originalDocFile(id);
  return file?.ext === "pdf" ? file.path : undefined;
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
  /** AI : built-in parser text (PDF.js at upload, plain decode) — stored in docs.content / {id}.txt */
  docContent(id: DocId): string | undefined;
  parserCacheGetByFileHash(fileHash: FileContentHash, parser: ParserKind): ParserCacheRow | undefined;
  parserCacheGetByDoc(docId: DocId): ParserCacheRow | undefined;
  parserCacheSet(row: Omit<ParserCacheRow, "createdAt"> & { createdAt?: number }): void;
  visionCacheGet(key: VisionCacheKey): VisionCacheRow | undefined;
  visionCacheSet(row: Omit<VisionCacheRow, "createdAt"> & { createdAt?: number }): void;
  visionCachesForDoc(docId: DocId): VisionCacheRow[];
  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef;
  repointDocName(id: DocId, name: string): boolean;
  removeDoc(id: DocId): boolean;
  runs(projectId?: ProjectId): PipelineRun[];
  findRunByFingerprint(projectId: ProjectId, fingerprint: RunFingerprint): PipelineRun | undefined;
  addRun(projectId: ProjectId, run: PipelineRun): void;
  updateRunNotes(runId: PipelineRun["id"], notes: string | undefined): boolean;
  updateRunTest(runId: PipelineRun["id"], test: RunTestReport | undefined): boolean;
  flush(): Promise<void>;
}

// AI : pull models + module graph from a bundled template — keep per-step model/prompt overrides.
function mergeSeedPipelineIntoProject(existing: Project, seed: Project): Project {
  const seedDocNames = seed.seedDocNames?.length ? seed.seedDocNames : existing.seedDocNames;
  const expectedOutputs = seed.expectedOutputs ?? existing.expectedOutputs;
  const inferencePresets = seed.inferencePresets ?? existing.inferencePresets;
  const models = structuredClone(seed.models);
  let modules = seed.modules.map((sm) => {
    const em = existing.modules.find((m) => m.id === sm.id);
    if (!em) return structuredClone(sm);
    return {
      ...sm,
      cached: true,
      model: em.model ?? sm.model,
      prompt: em.prompt ?? sm.prompt,
      inputDescription: em.inputDescription ?? sm.inputDescription,
      useOcr: em.useOcr ?? sm.useOcr,
      note: em.note ?? sm.note,
    };
  });
  modules = syncManagedPipelineSteps(modules, models);
  return migrateProjectModules({ ...existing, seedDocNames, expectedOutputs, inferencePresets, models, modules });
}

// AI : keep persisted seed projects aligned with seeds/*.json — merge new modules (e.g. Link Quotes)
// AI : while preserving user model/prompt overrides on steps they already had.
export function syncProjectFromSeed(existing: Project, seed: Project): Project {
  const seedDocNames = seed.seedDocNames?.length ? seed.seedDocNames : existing.seedDocNames;

  if (existing.id !== seed.id) {
    const baseName = existing.name.replace(/ \d+$/, "");
    if (baseName === seed.name) {
      return mergeSeedPipelineIntoProject(existing, seed);
    }
    let next = existing;
    if (seedDocNames?.length && !existing.seedDocNames?.length)
      next = { ...next, seedDocNames };
    let modules = next.modules.map((m) => {
      const sm = seed.modules.find((s) => s.id === m.id);
      if (!sm || (m.label === sm.label && m.note === sm.note)) return m;
      return { ...m, label: sm.label, note: sm.note };
    });
    modules = syncManagedPipelineSteps(modules, next.models);
    const invalid = computeInvalid(modules, next.models, { typeAliases: next.typeAliases ?? [] });
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
  return mergeSeedPipelineIntoProject(existing, seed);
}

// AI : built-in templates live in seeds/*.json only — drop any legacy rows that were openable in-store.
// AI : zero projects is a valid state now — the client renders a no-projects page instead.
export function purgeSeedTemplateProjects(store: Store): number {
  const templateIds = seedTemplateIds();
  let removed = 0;
  for (const id of templateIds) {
    if (store.project(id) && store.deleteProject(id)) removed += 1;
  }
  return removed;
}

export { userProjectsFrom, isSeedTemplateProject };

// AI : idempotent — ingest bundled documents/ files into the global doc store (safe on every request).
// AI : refreshStale (explicit "Resync examples" only) also replaces bundled docs whose content
// AI : drifted from seeds — never on bootstrap, or user edits to example docs would revert.
export async function ensureSeedDocs(store: Store, opts?: { refreshStale?: boolean }): Promise<void> {
  for (const seed of allProjectSeeds()) {
    for (const spec of seed.docSpecs) {
      try {
        await ingestSeedDoc(store, spec, opts?.refreshStale ?? false);
      } catch (err) {
        console.error(`seed doc failed (${spec.name}):`, err);
      }
    }
  }
}

// AI : tie numbered clones to their template example docs when seedDocNames was never saved.
export function backfillAllProjectSeedDocNames(store: Store): number {
  let updated = 0;
  for (const p of store.projects()) {
    const filled = backfillSeedDocNames(p);
    if (filled !== p) {
      store.saveProject(filled);
      updated += 1;
    }
  }
  return updated;
}

// AI : register a user upload with the active project so inference/Documents stay scoped per pipeline.
export function linkDocToProject(store: Store, projectId: ProjectId, docName: string): void {
  const p = store.project(projectId);
  if (!p) return;
  const names = p.seedDocNames ?? [];
  if (names.includes(docName)) return;
  store.saveProject({ ...p, seedDocNames: [...names, docName] });
}

function docNameReferencedByProject(store: Store, docName: string, exceptProjectId?: ProjectId): boolean {
  return store.projects().some(
    (p) => p.id !== exceptProjectId && (p.seedDocNames?.includes(docName) ?? false),
  );
}

export function projectsForDocName(store: Store, docName: string): ProjectId[] {
  return store
    .projects()
    .filter((p) => p.seedDocNames?.includes(docName))
    .map((p) => p.id);
}

// AI : set which pipelines include this document; bytes are removed only when no project still references the filename.
export function setDocProjectAvailability(
  store: Store,
  docId: DocId,
  projectIds: ProjectId[],
): boolean {
  const doc = store.docs().find((d) => d.id === docId);
  if (!doc) return false;
  const want = new Set(projectIds);
  for (const p of store.projects()) {
    const names = p.seedDocNames ?? [];
    const has = names.includes(doc.name);
    const should = want.has(p.id);
    if (has === should) continue;
    store.saveProject({
      ...p,
      seedDocNames: should ? [...names, doc.name] : names.filter((n) => n !== doc.name),
    });
  }
  return true;
}

// AI : scoped pipelines unlink seedDocNames first; global bytes drop only when no project still references the filename.
export function deleteDocForProject(store: Store, projectId: ProjectId, docId: DocId): boolean {
  const doc = store.docs().find((d) => d.id === docId);
  if (!doc) return false;
  const project = store.project(projectId);
  if (!project) return false;

  const names = project.seedDocNames ?? [];
  if (!names.includes(doc.name)) return false;
  store.saveProject({ ...project, seedDocNames: names.filter((n) => n !== doc.name) });
  if (docNameReferencedByProject(store, doc.name, projectId)) return true;
  return store.removeDoc(docId);
}

// AI : numbered clones stay aligned with seeds/*.json (seedDocNames + module graph).
export function syncAllUserProjectsFromSeeds(store: Store): void {
  const seeds = allProjectSeeds();
  for (const p of store.projects()) {
    const seed = seeds.find(
      (s) =>
        s.project.id === p.id ||
        (!isSeedTemplateProject(p) && s.project.name === p.name.replace(/ \d+$/, "")),
    );
    const next = seed ? syncProjectFromSeed(p, seed.project) : migrateProjectModules(p);
    if (next !== p) store.saveProject(next);
  }
}

// AI : ingest bundled docs + migrate user projects — templates are cloned via POST /api/projects only.
export async function ensureSeeded(store: Store): Promise<void> {
  await ensureSeedDocs(store);
  purgeSeedTemplateProjects(store);
  backfillAllProjectSeedDocNames(store);
  syncAllUserProjectsFromSeeds(store);
}

// AI : add missing seed docs; replace stale Vercel placeholder rows when real content is available.
async function ingestSeedDoc(store: Store, spec: SeedDocSpec, refreshStale = false): Promise<void> {
  let fresh: string;
  try {
    fresh = await readSeedDocContent(spec);
  } catch (err) {
    // AI : deployment fallback — placeholder surfaces in inference instead of silently skipping the doc.
    console.error(`seed doc missing (${spec.name}):`, err);
    fresh = unavailableSeedDocMessage(spec.name);
  }
  const existingByName = store.docs().find((d) => d.name === spec.name);
  if (existingByName) {
    const content = store.docContent(existingByName.id);
    const placeholderFixed =
      content && isUnavailableSeedDoc(content, spec.name) && !isUnavailableSeedDoc(fresh, spec.name);
    const stale = refreshStale && content !== undefined && content !== fresh && !isUnavailableSeedDoc(fresh, spec.name);
    const bundledTestDrift =
      isTestingFileName(spec.name) &&
      content !== undefined &&
      content !== fresh &&
      !isUnavailableSeedDoc(fresh, spec.name);
    if (placeholderFixed || stale || bundledTestDrift) {
      store.removeDoc(existingByName.id);
      store.addDoc(spec.name, spec.type, fresh, spec.label);
    }
    return;
  }
  const existingByHash = store.docs().find((d) => d.id === hashContent(fresh));
  if (existingByHash) {
    // AI : seeds/*.json renamed a bundled example — same bytes, new filename for inputNameContains.
    store.repointDocName(existingByHash.id, spec.name);
    return;
  }
  store.addDoc(spec.name, spec.type, fresh, spec.label);
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
    if (fresh && this.state.projects.length === 0) {
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
      return doc;
    }
    writeFileSync(join(this.docsDir, `${id}.txt`), content, "utf8");
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
    const toPersist = { ...migrated, models: stripSharedModels(migrated.models) };
    const i = this.state.projects.findIndex((x) => x.id === toPersist.id);
    if (i === -1) this.state.projects.push(toPersist);
    else this.state.projects[i] = toPersist;
    this.persist();
  }

  deleteProject(id: ProjectId): boolean {
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

  // AI : TODO refactor — parser/vision cache mirrors supabase_store index; JsonStore uses filesystem backend.
  parserCacheGetByFileHash(fileHash: FileContentHash, parser: ParserKind): ParserCacheRow | undefined {
    const path = join(parserCacheDir(), `${parserCacheKey(fileHash, parser)}.json`);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as ParserCacheRow;
    } catch {
      return undefined;
    }
  }

  parserCacheGetByDoc(docId: DocId): ParserCacheRow | undefined {
    const dir = parserCacheDir();
    if (!existsSync(dir)) return undefined;
    let latest: ParserCacheRow | undefined;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const row = JSON.parse(readFileSync(join(dir, name), "utf8")) as ParserCacheRow;
        if (row.docId !== docId) continue;
        if (!latest || row.createdAt > latest.createdAt) latest = row;
      } catch {
        continue;
      }
    }
    return latest;
  }

  parserCacheSet(row: Omit<ParserCacheRow, "createdAt"> & { createdAt?: number }): void {
    mkdirSync(parserCacheDir(), { recursive: true });
    const payload: ParserCacheRow = { ...row, createdAt: row.createdAt ?? Date.now() };
    writeFileSync(join(parserCacheDir(), `${row.key}.json`), JSON.stringify(payload), "utf8");
  }

  visionCacheGet(key: VisionCacheKey): VisionCacheRow | undefined {
    const path = join(visionCacheDir(), `${key}.json`);
    if (!existsSync(path)) return undefined;
    try {
      return JSON.parse(readFileSync(path, "utf8")) as VisionCacheRow;
    } catch {
      return undefined;
    }
  }

  visionCacheSet(row: Omit<VisionCacheRow, "createdAt"> & { createdAt?: number }): void {
    mkdirSync(visionCacheDir(), { recursive: true });
    const payload: VisionCacheRow = { ...row, createdAt: row.createdAt ?? Date.now() };
    writeFileSync(join(visionCacheDir(), `${row.key}.json`), JSON.stringify(payload), "utf8");
  }

  visionCachesForDoc(docId: DocId): VisionCacheRow[] {
    const dir = visionCacheDir();
    if (!existsSync(dir)) return [];
    const out: VisionCacheRow[] = [];
    for (const name of readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const row = JSON.parse(readFileSync(join(dir, name), "utf8")) as VisionCacheRow;
        if (row.docId === docId) out.push(row);
      } catch {
        continue;
      }
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  }

  addDoc(name: string, type: InputType, content: string, label: DocLabel): DocRef {
    const doc = this.ingest(name, type, content, label);
    this.persist();
    return doc;
  }

  repointDocName(id: DocId, name: string): boolean {
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i === -1 || this.state.docs[i]!.name === name) return false;
    this.state.docs[i] = { ...this.state.docs[i]!, name };
    this.persist();
    return true;
  }

  removeDoc(id: DocId): boolean {
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i === -1) return false;
    this.state.docs.splice(i, 1);
    const path = join(this.docsDir, `${id}.txt`);
    if (existsSync(path)) unlinkSync(path);
    const pdir = parserCacheDir();
    if (existsSync(pdir)) {
      for (const name of readdirSync(pdir)) {
        if (!name.endsWith(".json")) continue;
        try {
          const row = JSON.parse(readFileSync(join(pdir, name), "utf8")) as ParserCacheRow;
          if (row.docId === id) unlinkSync(join(pdir, name));
        } catch {
          continue;
        }
      }
    }
    const vdir = visionCacheDir();
    if (existsSync(vdir)) {
      for (const name of readdirSync(vdir)) {
        if (!name.endsWith(".json")) continue;
        try {
          const row = JSON.parse(readFileSync(join(vdir, name), "utf8")) as VisionCacheRow;
          if (row.docId === id) unlinkSync(join(vdir, name));
        } catch {
          continue;
        }
      }
    }
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

  updateRunTest(runId: PipelineRun["id"], test: RunTestReport | undefined): boolean {
    const i = this.state.runs.findIndex((r) => r.id === runId);
    if (i < 0) return false;
    this.state.runs[i] = { ...this.state.runs[i], test };
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
