import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uid } from "@/lib/id";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { createClient } from "@/utils/supabase/server";
import { dataDir } from "./config";
import { createAdminClient } from "./supabase_admin";
import { hashContent, saveOriginalDocBytes, type Store } from "./store";
import { migrateProjectModules } from "./validity";
import { isMissingSchemaError } from "./supabase_store";
import { LOCAL_DEV_USER_ID, type user_id_string } from "./require_auth";
import { logger } from "./server_logger";
import type {
  DocId,
  DocLabel,
  DocRef,
  InputType,
  ModelId,
  ModuleId,
  PipelineModule,
  Project,
  ProjectId,
  SharedLinkFundingMode,
  SharedLinkId,
} from "./types";
import type { SharedLinkDefaultDoc, SharedLinkRecord } from "@/lib/shared-link-types";

export type { SharedLinkDefaultDoc, SharedLinkRecord };

const linkLog = logger("shared-links");

const SHARED_LINK_PREFIX = "pub_";

function isServerless(): boolean {
  return !!process.env.VERCEL;
}

// AI : service role bypasses RLS for cross-user runs; session/anon client covers owner + public read policies.
async function supabaseForSharedLinks(): Promise<SupabaseClient | null> {
  const admin = await createAdminClient();
  if (admin) return admin;
  if (!getSupabasePublicEnv()) return null;
  return createClient();
}

type StoredSharedLink = SharedLinkRecord & {
  ownerId: user_id_string;
  snapshot: Project;
};

type ProgressTokenEntry = {
  linkId: SharedLinkId;
  ownerId: user_id_string;
  jobId: string;
  token: string;
  createdAt: number;
};

function linksDir(): string {
  return join(dataDir(), "shared_links");
}

function linkFile(id: SharedLinkId): string {
  return join(linksDir(), `${id}.json`);
}

function linkDocsDir(id: SharedLinkId): string {
  return join(linksDir(), "docs", id);
}

function sessionDocsDir(linkId: SharedLinkId, sessionId: string): string {
  return join(linkDocsDir(linkId), "sessions", sessionId);
}

function defaultDocsDir(linkId: SharedLinkId): string {
  return join(linkDocsDir(linkId), "defaults");
}

function progressTokensFile(): string {
  return join(linksDir(), "progress_tokens.json");
}

function readProgressTokens(): ProgressTokenEntry[] {
  const path = progressTokensFile();
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as ProgressTokenEntry[];
}

function writeProgressTokens(entries: ProgressTokenEntry[]): void {
  mkdirSync(linksDir(), { recursive: true });
  writeFileSync(progressTokensFile(), JSON.stringify(entries, null, 2));
}

export function registerSharedProgressToken(
  linkId: SharedLinkId,
  ownerId: user_id_string,
  jobId: string,
): string {
  const token = randomBytes(24).toString("hex");
  const entries = readProgressTokens().filter((e) => Date.now() - e.createdAt < 86_400_000);
  entries.push({ linkId, ownerId, jobId, token, createdAt: Date.now() });
  writeProgressTokens(entries);
  return token;
}

export function verifySharedProgressToken(
  linkId: SharedLinkId,
  jobId: string,
  token: string,
): ProgressTokenEntry | null {
  return (
    readProgressTokens().find((e) => e.linkId === linkId && e.jobId === jobId && e.token === token) ??
    null
  );
}

export function newSharedLinkId(): SharedLinkId {
  return uid<SharedLinkId>(SHARED_LINK_PREFIX);
}

export function newSessionId(): string {
  return randomBytes(16).toString("hex");
}

function loadLocalLink(id: SharedLinkId): StoredSharedLink | null {
  const path = linkFile(id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StoredSharedLink;
}

function saveLocalLink(row: StoredSharedLink): void {
  mkdirSync(linksDir(), { recursive: true });
  writeFileSync(linkFile(row.id), JSON.stringify(row, null, 2));
}

async function loadSupabaseLink(id: SharedLinkId): Promise<StoredSharedLink | null> {
  const db = await supabaseForSharedLinks();
  if (!db) return loadLocalLink(id);
  const { data, error } = await db
    .from("shared_links")
    .select("*")
    .eq("id", id)
    .eq("revoked", false)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as SharedLinkId,
    ownerId: data.owner_id as user_id_string,
    projectId: data.project_id as ProjectId,
    name: (data.snapshot as Project).name,
    description: undefined,
    snapshot: migrateProjectModules(data.snapshot as Project),
    defaultModel: (data.default_model as ModelId | null) ?? undefined,
    fundingMode: data.funding_mode as SharedLinkFundingMode,
    viewerNameRequired: data.viewer_name_required,
    defaultDocs: (data.default_docs ?? []) as SharedLinkDefaultDoc[],
    runCount: data.run_count ?? 0,
    createdAt: data.created_at,
    revoked: data.revoked,
  };
}

export async function getSharedLink(id: SharedLinkId): Promise<StoredSharedLink | null> {
  // AI : Vercel /tmp is per-instance — metadata must come from Supabase, not local JSON.
  if (isServerless()) return loadSupabaseLink(id);
  const local = loadLocalLink(id);
  if (local && !local.revoked) return local;
  return loadSupabaseLink(id);
}

function listLocalLinksForOwner(ownerId: user_id_string): SharedLinkRecord[] {
  if (!existsSync(linksDir())) return [];
  return readdirSync(linksDir())
    .filter((f) => f.endsWith(".json") && f !== "progress_tokens.json")
    .map((f) => loadLocalLink(f.replace(".json", "") as SharedLinkId))
    .filter((r): r is StoredSharedLink => r != null && r.ownerId === ownerId && !r.revoked)
    .map(toPublicRecord);
}

export async function listSharedLinksForOwner(ownerId: user_id_string): Promise<SharedLinkRecord[]> {
  const db = await supabaseForSharedLinks();
  if (!db) return listLocalLinksForOwner(ownerId);
  const { data, error } = await db.from("shared_links").select("*").eq("owner_id", ownerId);
  if (error) {
    if (isMissingSchemaError(error)) return listLocalLinksForOwner(ownerId);
    throw error;
  }
  return (data ?? []).map((row) =>
    toPublicRecord({
      id: row.id as SharedLinkId,
      ownerId: row.owner_id as user_id_string,
      projectId: row.project_id as ProjectId,
      name: (row.snapshot as Project).name,
      description: undefined,
      snapshot: row.snapshot as Project,
      defaultModel: (row.default_model as ModelId | null) ?? undefined,
      fundingMode: row.funding_mode as SharedLinkFundingMode,
      viewerNameRequired: row.viewer_name_required,
      defaultDocs: (row.default_docs ?? []) as SharedLinkDefaultDoc[],
      runCount: row.run_count ?? 0,
      createdAt: row.created_at,
      revoked: row.revoked,
    }),
  );
}

function toPublicRecord(row: StoredSharedLink): SharedLinkRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    defaultModel: row.defaultModel,
    fundingMode: row.fundingMode,
    viewerNameRequired: row.viewerNameRequired,
    defaultDocs: row.defaultDocs,
    runCount: row.runCount,
    createdAt: row.createdAt,
    revoked: row.revoked,
  };
}

export type PublishSharedLinkInput = {
  ownerId: user_id_string;
  project: Project;
  defaultModel?: ModelId;
  fundingMode?: SharedLinkFundingMode;
  viewerNameRequired?: boolean;
  defaultDocsByModule: Partial<Record<ModuleId, DocId[]>>;
  store: Store;
};

export async function publishSharedLink(input: PublishSharedLinkInput): Promise<SharedLinkRecord> {
  const id = newSharedLinkId();
  const snapshot = migrateProjectModules(structuredClone(input.project));
  const defaultDocs: SharedLinkDefaultDoc[] = [];
  mkdirSync(defaultDocsDir(id), { recursive: true });

  for (const [moduleId, docIds] of Object.entries(input.defaultDocsByModule)) {
    for (const docId of docIds ?? []) {
      const doc = input.store.docs().find((d) => d.id === docId);
      const content = input.store.docContent(docId);
      if (!doc || content === undefined) continue;
      const storageKey = `${moduleId}_${doc.name}`;
      const dest = join(defaultDocsDir(id), storageKey);
      writeFileSync(dest, content, "utf8");
      const metaPath = `${dest}.meta.json`;
      writeFileSync(
        metaPath,
        JSON.stringify({ moduleId, filename: doc.name, type: doc.type, label: doc.label }),
      );
      const bytesPath = join(dataDir(), "docs", `${docId}`);
      for (const ext of ["pdf", "png", "jpg", "jpeg"]) {
        const src = `${bytesPath}.${ext}`;
        if (existsSync(src)) {
          writeFileSync(join(defaultDocsDir(id), `${storageKey}.${ext}`), readFileSync(src));
        }
      }
      defaultDocs.push({
        moduleId: moduleId as ModuleId,
        filename: doc.name,
        docId,
        content,
        type: doc.type,
      });
    }
  }

  const row: StoredSharedLink = {
    id,
    ownerId: input.ownerId,
    projectId: input.project.id,
    name: snapshot.name,
    description: undefined,
    snapshot,
    defaultModel: input.defaultModel,
    fundingMode: input.fundingMode ?? "sharer_pays",
    viewerNameRequired: input.viewerNameRequired ?? false,
    defaultDocs,
    runCount: 0,
    createdAt: Date.now(),
    revoked: false,
  };

  if (!isServerless()) saveLocalLink(row);
  const db = await supabaseForSharedLinks();
  if (!db) {
    if (isServerless()) {
      throw new Error("Supabase env required to publish shared links in production");
    }
    saveLocalLink(row);
    return toPublicRecord(row);
  }
  const { error } = await db.from("shared_links").upsert({
    id: row.id,
    owner_id: row.ownerId,
    project_id: row.projectId,
    snapshot: row.snapshot,
    default_docs: row.defaultDocs,
    default_model: row.defaultModel ?? null,
    funding_mode: row.fundingMode,
    viewer_name_required: row.viewerNameRequired,
    revoked: false,
    run_count: 0,
    created_at: row.createdAt,
  });
  if (error) {
    if (isServerless() || !isMissingSchemaError(error)) {
      throw new Error(`shared link persistence failed: ${error.message}`);
    }
    linkLog.warn(`supabase upsert failed — saved locally`, { error: error.message });
    saveLocalLink(row);
  }
  return toPublicRecord(row);
}

export async function revokeSharedLink(ownerId: user_id_string, id: SharedLinkId): Promise<boolean> {
  const link = await getSharedLink(id);
  if (!link || link.ownerId !== ownerId) return false;
  link.revoked = true;
  saveLocalLink(link);
  const db = await supabaseForSharedLinks();
  if (db) {
    await db.from("shared_links").update({ revoked: true }).eq("id", id).eq("owner_id", ownerId);
  }
  return true;
}

export async function incrementSharedLinkRunCount(id: SharedLinkId): Promise<void> {
  const link = loadLocalLink(id);
  if (link) {
    link.runCount += 1;
    saveLocalLink(link);
  }
  const admin = await createAdminClient();
  if (admin) {
    const { data } = await admin.from("shared_links").select("run_count").eq("id", id).maybeSingle();
    if (data) {
      await admin.from("shared_links").update({ run_count: (data.run_count ?? 0) + 1 }).eq("id", id);
    }
  }
}

type SessionDocMeta = {
  id: DocId;
  name: string;
  type: InputType;
  label: DocLabel;
  moduleId: ModuleId;
};

function sessionMetaPath(linkId: SharedLinkId, sessionId: string): string {
  return join(sessionDocsDir(linkId, sessionId), "meta.json");
}

function readSessionDocs(linkId: SharedLinkId, sessionId: string): SessionDocMeta[] {
  const path = sessionMetaPath(linkId, sessionId);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as SessionDocMeta[];
}

function writeSessionDocs(linkId: SharedLinkId, sessionId: string, docs: SessionDocMeta[]): void {
  mkdirSync(sessionDocsDir(linkId, sessionId), { recursive: true });
  writeFileSync(sessionMetaPath(linkId, sessionId), JSON.stringify(docs, null, 2));
}

export function loadDefaultDocContent(
  linkId: SharedLinkId,
  moduleId: ModuleId,
  filename: string,
  inlineDocs?: SharedLinkDefaultDoc[],
): { content: string; type: InputType; name: string } | null {
  const fromInline = inlineDocs?.find((d) => d.moduleId === moduleId && d.filename === filename);
  if (fromInline?.content != null) {
    return {
      content: fromInline.content,
      type: fromInline.type ?? "text",
      name: filename,
    };
  }
  const storageKey = `${moduleId}_${filename}`;
  const textPath = join(defaultDocsDir(linkId), storageKey);
  if (!existsSync(textPath)) return null;
  const metaPath = `${textPath}.meta.json`;
  const meta = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, "utf8")) as { type: InputType; filename: string })
    : { type: "text" as InputType, filename };
  return { content: readFileSync(textPath, "utf8"), type: meta.type, name: meta.filename ?? filename };
}

export async function saveSessionUpload(
  linkId: SharedLinkId,
  sessionId: string,
  moduleId: ModuleId,
  file: File,
  content: string,
  type: InputType,
): Promise<DocRef> {
  const id = hashContent(`${linkId}:${sessionId}:${file.name}:${content.slice(0, 64)}`);
  const doc: DocRef = {
    id,
    name: file.name,
    type,
    label: "inference",
    sizeKb: Math.max(1, Math.round(content.length / 1024)),
    uploadedAt: Date.now(),
    preview: content.slice(0, 180),
  };
  const dir = sessionDocsDir(linkId, sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.txt`), content, "utf8");
  writeFileSync(join(dir, `${id}.meta.json`), JSON.stringify({ ...doc, moduleId }));
  if (type === "pdf" || type === "image") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    writeFileSync(join(dir, `${id}.${ext}`), bytes);
    saveOriginalDocBytes(id, bytes, ext);
  }
  const existing = readSessionDocs(linkId, sessionId).filter((d) => d.moduleId !== moduleId);
  existing.push({ id, name: doc.name, type, label: "inference", moduleId });
  writeSessionDocs(linkId, sessionId, existing);
  return doc;
}

export function sessionDocsForModule(
  linkId: SharedLinkId,
  sessionId: string,
  moduleId: ModuleId,
): DocRef[] {
  return readSessionDocs(linkId, sessionId)
    .filter((d) => d.moduleId === moduleId)
    .map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      label: d.label,
      sizeKb: Math.max(1, 1),
      uploadedAt: Date.now(),
      preview: "",
    }));
}

export function sessionDocContent(linkId: SharedLinkId, sessionId: string, docId: DocId): string | undefined {
  const path = join(sessionDocsDir(linkId, sessionId), `${docId}.txt`);
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

// AI : overlay session + default docs onto the sharer's store for runPipeline.
export function overlayStoreForSharedRun(
  base: Store,
  linkId: SharedLinkId,
  sessionId: string,
  link: StoredSharedLink,
  inputModules: PipelineModule[],
): Store {
  const extraDocs = new Map<DocId, DocRef>();
  const extraContent = new Map<DocId, string>();

  for (const def of link.defaultDocs) {
    const loaded = loadDefaultDocContent(linkId, def.moduleId, def.filename, link.defaultDocs);
    if (!loaded) continue;
    const id = hashContent(`shared_default:${linkId}:${def.moduleId}:${def.filename}`);
    extraDocs.set(id, {
      id,
      name: loaded.name,
      type: loaded.type,
      label: "inference",
      sizeKb: Math.max(1, Math.round(loaded.content.length / 1024)),
      uploadedAt: Date.now(),
      preview: loaded.content.slice(0, 180),
    });
    extraContent.set(id, loaded.content);
  }

  for (const meta of readSessionDocs(linkId, sessionId)) {
    const content = sessionDocContent(linkId, sessionId, meta.id);
    if (content === undefined) continue;
    extraDocs.set(meta.id, {
      id: meta.id,
      name: meta.name,
      type: meta.type,
      label: meta.label,
      sizeKb: Math.max(1, Math.round(content.length / 1024)),
      uploadedAt: Date.now(),
      preview: content.slice(0, 180),
    });
    extraContent.set(meta.id, content);
  }

  return {
    projects: () => base.projects(),
    project: (id) => base.project(id),
    saveProject: (p) => base.saveProject(p),
    deleteProject: (id) => base.deleteProject(id),
    docs: () => [...extraDocs.values(), ...base.docs()],
    docContent: (id) => extraContent.get(id) ?? base.docContent(id),
    parserCacheGetByFileHash: (h, p) => base.parserCacheGetByFileHash(h, p),
    parserCacheGetByDoc: (id) => base.parserCacheGetByDoc(id),
    parserCacheSet: (row) => base.parserCacheSet(row),
    visionCacheGet: (key) => base.visionCacheGet(key),
    visionCacheSet: (row) => base.visionCacheSet(row),
    visionCachesForDoc: (id) => base.visionCachesForDoc(id),
    addDoc: (name, type, content, label) => {
      const id = hashContent(content);
      const doc: DocRef = {
        id,
        name,
        type,
        label,
        sizeKb: Math.max(1, Math.round(content.length / 1024)),
        uploadedAt: Date.now(),
        preview: content.slice(0, 180),
      };
      extraDocs.set(id, doc);
      extraContent.set(id, content);
      return doc;
    },
    repointDocName: (id, name) => {
      const extra = extraDocs.get(id);
      if (extra) {
        extraDocs.set(id, { ...extra, name });
        return true;
      }
      return base.repointDocName(id, name);
    },
    removeDoc: (id) => extraDocs.delete(id) || base.removeDoc(id),
    runs: (pid) => base.runs(pid),
    findRunByFingerprint: (pid, fp) => base.findRunByFingerprint(pid, fp),
    addRun: (pid, run) => base.addRun(pid, run),
    updateRunNotes: (rid, notes) => base.updateRunNotes(rid, notes),
    flush: () => base.flush(),
  };
}

export async function openStoreForUser(userId: user_id_string): Promise<Store> {
  if (userId === LOCAL_DEV_USER_ID) {
    const { openStore, ensureSeeded } = await import("./store");
    const store = await openStore();
    await ensureSeeded(store);
    return store;
  }
  const admin = await createAdminClient();
  if (!admin) {
    const { openStore, ensureSeeded } = await import("./store");
    const store = await openStore();
    await ensureSeeded(store);
    return store;
  }
  const { SupabaseStore } = await import("./supabase_store");
  const scoped = new SupabaseStore(admin, userId);
  await scoped.init();
  return scoped;
}

export function publicLinkView(link: StoredSharedLink) {
  return {
    id: link.id,
    name: link.name,
    description: link.description,
    defaultModel: link.defaultModel,
    fundingMode: link.fundingMode,
    viewerNameRequired: link.viewerNameRequired,
    defaultDocs: link.defaultDocs.map((d) => ({ moduleId: d.moduleId, filename: d.filename })),
    modules: link.snapshot.modules,
    models: link.snapshot.models,
  };
}

export function sessionTokenHash(sessionId: string, linkId: SharedLinkId): string {
  return createHash("sha256").update(`${linkId}:${sessionId}`).digest("hex").slice(0, 32);
}
