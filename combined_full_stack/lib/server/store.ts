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
  projectSeedDocNames,
  readSeedDocContent,
  unavailableSeedDocMessage,
  seedTemplateIds,
  userProjectsFrom,
  type SeedDocSpec,
} from "./seed";
import { migrateProjectModules, projectWithAuthoredModules, syncManagedPipelineSteps } from "./validity";
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
import { buildDocRef } from "./doc_ref";
import { logger } from "./server_logger";

const origLog = logger("docs:original-bytes");

function visionCacheDir(): string {
  return join(dataDir(), "vision_cache");
}

function parserCacheDir(): string {
  return join(dataDir(), "parser_cache");
}

// AI : content hash == doc id, so identical uploads dedupe to one ref (Documents tab).
// AI : TODO (arch-hash-content) — SpineSession has a private twin; session should import this.
export function hashContent(content: string): DocId {
  return ("sha_" + createHash("sha256").update(content).digest("hex").slice(0, 16)) as DocId;
}

function docsDir(): string {
  return join(dataDir(), "docs");
}

// AI : original PDF/image bytes — local disk for JsonStore / warm cache; Supabase Storage in prod.
// AI : TODO (media-view-A-storage) — add wav/mp3/mp4/webm/gltf/glb/stl (+ transcode sidecars). PDF+raster only today.
export const ORIGINAL_DOC_EXTS = ["pdf", "png", "jpg", "jpeg", "webp"] as const;
export type OriginalDocExt = (typeof ORIGINAL_DOC_EXTS)[number];

export const EXT_MIME: Record<OriginalDocExt, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export function parseOriginalDocExt(ext: string): OriginalDocExt | undefined {
  const safe = ext.toLowerCase().replace(/^\./, "");
  return (ORIGINAL_DOC_EXTS as readonly string[]).includes(safe) ? (safe as OriginalDocExt) : undefined;
}

export function saveOriginalDocBytes(id: DocId, bytes: Uint8Array, ext: string): void {
  const safe = parseOriginalDocExt(ext);
  if (!safe) return;
  mkdirSync(docsDir(), { recursive: true });
  writeFileSync(join(docsDir(), `${id}.${safe}`), bytes);
}

/** @deprecated use saveOriginalDocBytes */
export function savePdfBytes(id: DocId, bytes: Uint8Array): void {
  saveOriginalDocBytes(id, bytes, "pdf");
}

export type OriginalDocFile = { path: string; mime: string; ext: OriginalDocExt };
export type OriginalDocSource = "disk" | "storage";
export type OriginalDocMeta = { mime: string; ext: OriginalDocExt; source: OriginalDocSource };
export type OriginalDocBytes = OriginalDocMeta & { bytes: Uint8Array };

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
      if (!spec.path.toLowerCase().endsWith(".pdf")) continue;
      const txtSidecar = spec.path.replace(/\.pdf$/i, ".txt");
      if (existsSync(txtSidecar) && hashContent(readFileSync(txtSidecar, "utf8")) === id) {
        if (existsSync(spec.path)) return copySeedPdfToDocsDir(id, spec.path);
      }
      try {
        const content = await readSeedDocContent(spec);
        if (hashContent(content) === id && existsSync(spec.path)) return copySeedPdfToDocsDir(id, spec.path);
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
        if (spec.path.toLowerCase().endsWith(".pdf") && existsSync(spec.path)) return copySeedPdfToDocsDir(id, spec.path);
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

// AI : disk first (warm instance / JsonStore), then Supabase Storage for prod after redeploy.
export function persistOriginalDocBytes(store: Store, id: DocId, bytes: Uint8Array, ext: string): void {
  const parsed = parseOriginalDocExt(ext);
  if (!parsed) {
    origLog.warn(`skip original bytes — ext is not stored`, {
      docId: id,
      ext: ext || "(none)",
      storedExts: ORIGINAL_DOC_EXTS.join(","),
    });
    return;
  }
  saveOriginalDocBytes(id, bytes, parsed);
  if (store.persistOriginalDocBytes) {
    origLog.info(`queue original bytes → Supabase Storage bucket doc-originals`, {
      docId: id,
      ext: parsed,
      bytes: bytes.length,
    });
    store.persistOriginalDocBytes(id, bytes, parsed);
    return;
  }
  origLog.info(`original bytes disk-only (JsonStore — no Storage backend)`, {
    docId: id,
    ext: parsed,
    bytes: bytes.length,
  });
}

function logOriginalMiss(id: DocId, docName: string | undefined, hasStorageBackend: boolean): void {
  origLog.debug(`original bytes MISS — not on disk, not in bundled seeds, not in Storage bucket doc-originals`, {
    docId: id,
    docName,
    hasStorageBackend,
    hint: "re-upload the PDF/image",
  });
}

export async function originalDocMeta(
  store: Store,
  id: DocId,
  docName?: string,
): Promise<OriginalDocMeta | undefined> {
  const file = await originalDocFile(id, docName);
  if (file) {
    origLog.debug(`original bytes HIT local disk`, { docId: id, ext: file.ext, docName });
    return { mime: file.mime, ext: file.ext, source: "disk" };
  }
  const remote = await store.loadOriginalDocMeta?.(id);
  if (remote) {
    origLog.info(`original bytes HIT Supabase Storage`, { docId: id, ext: remote.ext, source: "storage" });
    return { ...remote, source: "storage" };
  }
  logOriginalMiss(id, docName, !!store.loadOriginalDocMeta);
  return undefined;
}

export async function resolveOriginalDocBytes(
  store: Store,
  id: DocId,
  docName?: string,
): Promise<OriginalDocBytes | undefined> {
  const file = await originalDocFile(id, docName);
  if (file) {
    origLog.debug(`original bytes HIT local disk`, { docId: id, ext: file.ext, docName });
    return { bytes: new Uint8Array(readFileSync(file.path)), mime: file.mime, ext: file.ext, source: "disk" };
  }
  const remote = await store.loadOriginalDocBytes?.(id);
  if (remote) {
    origLog.info(`original bytes HIT Supabase Storage`, {
      docId: id,
      ext: remote.ext,
      bytes: remote.bytes.length,
      source: "storage",
    });
    saveOriginalDocBytes(id, remote.bytes, remote.ext);
    return { ...remote, source: "storage" };
  }
  logOriginalMiss(id, docName, !!store.loadOriginalDocBytes);
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
// AI : TODO (arch-store-async) — Store is sync + write-behind RAM; make methods async so JsonStore vs
// AI :   SupabaseStore aren't both in-memory mirrors (see supabase_store.ts load-all TODO).
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
  /** AI : Supabase — bundled examples come from public.seed_docs, not per-user docs rows. */
  usesPlatformSeedDocs?(): boolean;
  /** AI : warm cache may lag another instance — re-read accessible projects from DB. */
  syncProjectsFromDb?(): Promise<void>;
  /** AI : warm cache miss — refetch this id (via sync) before API 404. */
  ensureProject?(id: ProjectId): Promise<Project | undefined>;
  /** AI : re-read runs visible via RLS (own + team-shared project pointers). */
  syncRunsFromDb?(): Promise<void>;
  /** AI : re-read docs visible via RLS (own + shared-owner pointers). */
  syncDocsFromDb?(): Promise<void>;
  /** AI : queue original PDF/image bytes to Supabase Storage (no-op on JsonStore). */
  persistOriginalDocBytes?(id: DocId, bytes: Uint8Array, ext: string): void;
  /** AI : fetch original bytes from Supabase Storage after local/seed miss. */
  loadOriginalDocBytes?(id: DocId): Promise<OriginalDocBytes | undefined>;
  /** AI : HEAD /file — existence + mime without downloading bytes. */
  loadOriginalDocMeta?(id: DocId): Promise<OriginalDocMeta | undefined>;
}

// AI : prefer memory, then DB sync on warm SupabaseStore — JsonStore has no lag.
export async function resolveStoreProject(store: Store, id: ProjectId): Promise<Project | undefined> {
  const hit = store.project(id);
  if (hit) return hit;
  return store.ensureProject?.(id);
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
    // AI : numbered clones are user-owned. Rewriting models/modules from the template on hydrate
    // AI : silently destroyed Vibe-approved pipelines (Approve appeared to stick, then reverted).
    let next = existing;
    if (seedDocNames?.length && !existing.seedDocNames?.length)
      next = { ...next, seedDocNames };
    return next;
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
  if (store.usesPlatformSeedDocs?.() && !opts?.refreshStale) return;
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

// AI : numbered clones keep seedDocNames when missing — never rewrite their pipeline from the template.
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
  const existingByName = store.docs().filter((d) => d.name === spec.name);
  if (existingByName.length) {
    const content = store.docContent(existingByName[0]!.id);
    // AI : metadata-only rows (ref without bytes) must re-ingest — otherwise GET /api/docs/:id/text 404s.
    const missingContent = typeof content !== "string";
    const placeholderFixed =
      content && isUnavailableSeedDoc(content, spec.name) && !isUnavailableSeedDoc(fresh, spec.name);
    const stale = refreshStale && content !== undefined && content !== fresh && !isUnavailableSeedDoc(fresh, spec.name);
    // AI : all seeds/*.json docs drift-sync on bootstrap — git is canonical for bundled examples.
    const bundledSeedDrift =
      content !== undefined &&
      content !== fresh &&
      !isUnavailableSeedDoc(fresh, spec.name);
    if (placeholderFixed || stale || bundledSeedDrift || missingContent) {
      for (const d of existingByName) store.removeDoc(d.id);
      store.addDoc(spec.name, spec.type, fresh, spec.label);
    }
    return;
  }
  const existingByHash = store.docs().find((d) => d.id === hashContent(fresh));
  if (existingByHash) {
    if (store.docs().some((d) => d.name === spec.name)) return;
    // AI : seeds/*.json renamed a bundled example — same bytes, new filename for inputNameContains.
    store.repointDocName(existingByHash.id, spec.name);
    return;
  }
  store.addDoc(spec.name, spec.type, fresh, spec.label);
}

// AI : before inference — platform seed_docs + git documents/ beat legacy per-user bundled copies.
export async function ensureBundledSeedDocsForProject(store: Store, project: Project): Promise<void> {
  await refreshBundledSeedDocsForRun(store, project);
  if (!store.usesPlatformSeedDocs?.()) return;
  const missing = projectSeedDocNames(project).filter((name) => !store.docs().some((d) => d.name === name));
  if (!missing.length) return;
  const { createAdminClient } = await import("./supabase_admin");
  const admin = await createAdminClient();
  if (!admin) return;
  const { syncPlatformSeeds } = await import("./seed_docs_platform");
  await syncPlatformSeeds(admin);
  const { SupabaseStore } = await import("./supabase_store");
  if (store instanceof SupabaseStore) await store.refreshPlatformSeedDocsFromDb();
}

export function snapshotDocNamesById(store: Store): Map<DocId, string> {
  const map = new Map<DocId, string>();
  for (const doc of store.docs()) map.set(doc.id, doc.name);
  return map;
}

function runInputDoc(store: Store, id: DocId): { docId: DocId; doc: DocRef } | undefined {
  if (typeof store.docContent(id) !== "string") return undefined;
  const doc = store.docs().find((d) => d.id === id);
  return doc ? { docId: id, doc } : undefined;
}

// AI : seed refresh may purge a user copy or rehash from git — keep the picker id working via name or content hash.
export async function resolveRunInputDoc(
  store: Store,
  requestedId: DocId,
  namesById: Map<DocId, string>,
  opts?: { scanBundledHashes?: boolean },
): Promise<{ docId: DocId; doc: DocRef } | undefined> {
  const direct = runInputDoc(store, requestedId);
  if (direct) return direct;

  const name = namesById.get(requestedId);
  if (name) {
    const match = store.docs().find((d) => d.name === name);
    if (match) {
      const hit = runInputDoc(store, match.id);
      if (hit) return hit;
    }
  }

  await recoverBundledSeedDoc(store, requestedId, name, opts?.scanBundledHashes !== false);
  const recovered = runInputDoc(store, requestedId);
  if (recovered) return recovered;
  if (!name) return undefined;
  const renamed = store.docs().find((d) => d.name === name);
  return renamed ? runInputDoc(store, renamed.id) : undefined;
}

async function recoverBundledSeedDoc(
  store: Store,
  requestedId: DocId,
  name: string | undefined,
  scanBundledHashes: boolean,
): Promise<void> {
  const { allUniqueSeedDocSpecs } = await import("./seed_docs_platform");
  const specs = allUniqueSeedDocSpecs();
  const named = name ? specs.filter((spec) => spec.name === name) : [];
  for (const spec of named) await ingestSeedDoc(store, spec, true);
  if (runInputDoc(store, requestedId)) return;
  if (name && store.docs().some((d) => d.name === name && typeof store.docContent(d.id) === "string")) return;
  if (!scanBundledHashes) return;

  for (const spec of specs) {
    if (named.some((s) => s.name === spec.name)) continue;
    let fresh: string;
    try {
      fresh = await readSeedDocContent(spec);
    } catch {
      continue;
    }
    if (hashContent(fresh) !== requestedId) continue;
    await ingestSeedDoc(store, spec, true);
    return;
  }
}

export async function refreshBundledSeedDocsForRun(store: Store, project: Project): Promise<void> {
  const names = new Set(projectSeedDocNames(project));
  if (!names.size) return;
  const platform = store as Store & {
    purgeStaleUserBundledDocsFromMemory?: () => number;
    refreshPlatformSeedDocsFromDb?: () => Promise<number>;
  };
  platform.purgeStaleUserBundledDocsFromMemory?.();
  await platform.refreshPlatformSeedDocsFromDb?.();
  const { allUniqueSeedDocSpecs } = await import("./seed_docs_platform");
  for (const spec of allUniqueSeedDocSpecs()) {
    if (!names.has(spec.name)) continue;
    await ingestSeedDoc(store, spec, true);
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
      this.state.projects = this.state.projects.map((p) => migrateProjectModules(p));
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
    const disk = {
      ...this.state,
      projects: this.state.projects.map((p) => projectWithAuthoredModules(p)),
    };
    writeFileSync(this.storeFile, JSON.stringify(disk, null, 2), "utf8");
  }

  private ingest(name: string, type: InputType, content: string, label: DocLabel): DocRef {
    const id = hashContent(content);
    const now = Date.now();
    const i = this.state.docs.findIndex((d) => d.id === id);
    if (i >= 0) {
      // AI : content-addressed reuse — bump uploadedAt + filename so docsForProject picks this edit.
      const path = join(this.docsDir, `${id}.txt`);
      if (!existsSync(path)) writeFileSync(path, content, "utf8");
      const doc = buildDocRef({ id, name, type, label, content, uploadedAt: now });
      this.state.docs = [doc, ...this.state.docs.filter((_, j) => j !== i)];
      return doc;
    }
    writeFileSync(join(this.docsDir, `${id}.txt`), content, "utf8");
    const doc = buildDocRef({ id, name, type, label, content, uploadedAt: now });
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

  // AI : TODO refactor / TODO (arch-parser-cache) — parser/vision cache mirrors supabase_store index; JsonStore should use parser_vision_cache_index + fs adapter.
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
