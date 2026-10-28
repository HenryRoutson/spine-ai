// AI : Session-scoped document management for shared-link public runs.
// AI : Per-session uploads + default overlay; local FS in dev, Upstash across Vercel instances.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { Redis } from "@upstash/redis";
import { dataDir } from "./config";
import {
  EXT_MIME,
  hashContent,
  ORIGINAL_DOC_EXTS,
  overlayStore,
  parseOriginalDocExt,
  saveOriginalDocBytes,
  type Store,
} from "./store";
import { shouldSaveOriginalBytes } from "./doc_upload_parse";
import { DocLabel } from "./types";
import { InputType, type DocId, type DocRef, type ModuleId, type SharedLinkId } from "./types";
import type { SharedLinkDefaultDoc } from "@/lib/shared-link-types";
import { upstashConfigured } from "@/lib/rate_limit_config";

// AI : per-session caps — limits storage exhaustion on public shared-link uploads.
export const MAX_SHARED_SESSION_DOCS = 30;
export const MAX_SHARED_SESSION_BYTES = 100 * 1024 * 1024;

export const SHARED_SESSION_ID_RE = /^[a-f0-9]{32}$/;
export const SHARED_DOC_ID_RE = /^sha_[a-f0-9]{16}$/;
export const SHARED_RUN_SESSION_COOKIE = "shared_run_session";

export function parseSharedSessionId(raw: string | undefined | null): string | undefined {
  if (!raw || !SHARED_SESSION_ID_RE.test(raw)) return undefined;
  return raw;
}

export function parseSharedDocId(raw: string): DocId | null {
  if (!SHARED_DOC_ID_RE.test(raw)) return null;
  return raw as DocId;
}

function pathWithinRoot(root: string, target: string): boolean {
  const rel = relative(resolve(root), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function safeJoinUnder(root: string, ...segments: string[]): string | null {
  const joined = resolve(root, ...segments);
  return pathWithinRoot(root, joined) ? joined : null;
}

// AI : SECURITY — default-doc filenames come from user uploads (doc.name). Strip path separators and
// AI : parent refs so `${moduleId}_${filename}` can never escape defaultDocsDir. Write and read must
// AI : call this identically so the on-disk key stays consistent.
export function defaultDocStorageKey(moduleId: string, filename: string): string {
  const safe = (s: string) => s.replace(/[\\/]/g, "_").replace(/\.{2,}/g, "_").replace(/^\.+/, "_");
  return `${safe(moduleId)}_${safe(filename)}`;
}

function linksDir(): string {
  return join(dataDir(), "shared_links");
}

function sessionDocsDir(linkId: SharedLinkId, sessionId: string): string {
  if (!parseSharedSessionId(sessionId)) throw new Error("invalid shared session id");
  const root = join(linksDir(), "docs", linkId, "sessions");
  const dir = safeJoinUnder(root, sessionId);
  if (!dir) throw new Error("invalid shared session path");
  return dir;
}

function defaultDocsDir(linkId: SharedLinkId): string {
  return join(linksDir(), "docs", linkId, "defaults");
}

type SessionDocMeta = {
  id: DocId;
  name: string;
  type: InputType;
  label: DocLabel;
  moduleId: ModuleId;
  bytes?: number;
};

type SessionOriginalBlob = { ext: string; b64: string };

type SessionRedisState = {
  docs: SessionDocMeta[];
  content: Record<string, string>;
  bytes: number;
};

const SESSION_TTL_SEC = 172_800;

let cachedSessionRedis: Redis | undefined

function sessionRedis(): Redis | null {
  if (!upstashConfigured()) return null
  cachedSessionRedis ??= Redis.fromEnv()
  return cachedSessionRedis
}

function sessionRedisKey(linkId: SharedLinkId, sessionId: string): string {
  return `shared_session:${linkId}:${sessionId}`;
}

function originalRedisKey(linkId: SharedLinkId, sessionId: string, docId: DocId): string {
  return `shared_session_orig:${linkId}:${sessionId}:${docId}`;
}

async function saveRedisOriginal(
  linkId: SharedLinkId,
  sessionId: string,
  docId: DocId,
  bytes: Uint8Array,
  ext: string,
): Promise<void> {
  if (!upstashConfigured()) return;
  const safe = parseOriginalDocExt(ext);
  if (!safe) return;
  const redis = sessionRedis();
  if (!redis) return;
  try {
    await redis.set(
      originalRedisKey(linkId, sessionId, docId),
      { ext: safe, b64: Buffer.from(bytes).toString("base64") } satisfies SessionOriginalBlob,
      { ex: SESSION_TTL_SEC },
    );
  } catch {
    // AI : oversized originals stay on instance /tmp; same-instance file GET still works.
  }
}

async function loadRedisOriginal(
  linkId: SharedLinkId,
  sessionId: string,
  docId: DocId,
): Promise<{ ext: string; bytes: Uint8Array } | null> {
  const redis = sessionRedis();
  if (!redis) return null;
  const row = await redis.get<SessionOriginalBlob>(originalRedisKey(linkId, sessionId, docId));
  if (!row?.b64 || !row.ext) return null;
  return { ext: row.ext, bytes: new Uint8Array(Buffer.from(row.b64, "base64")) };
}

async function deleteRedisOriginal(linkId: SharedLinkId, sessionId: string, docId: DocId): Promise<void> {
  if (!upstashConfigured()) return;
  const redis = sessionRedis();
  if (!redis) return;
  await redis.del(originalRedisKey(linkId, sessionId, docId));
}

async function loadRedisSession(linkId: SharedLinkId, sessionId: string): Promise<SessionRedisState | null> {
  const redis = sessionRedis();
  if (!redis) return null;
  return (await redis.get<SessionRedisState>(sessionRedisKey(linkId, sessionId))) ?? null;
}

async function saveRedisSession(
  linkId: SharedLinkId,
  sessionId: string,
  state: SessionRedisState,
): Promise<void> {
  const redis = sessionRedis();
  if (!redis) {
    if (process.env.VERCEL) {
      throw new Error("Shared session uploads require UPSTASH_REDIS_REST_URL/TOKEN on Vercel");
    }
    return;
  }
  await redis.set(sessionRedisKey(linkId, sessionId), state, { ex: SESSION_TTL_SEC });
}

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

export async function sessionUploadUsage(
  linkId: SharedLinkId,
  sessionId: string,
): Promise<{ count: number; bytes: number; redis: SessionRedisState | null }> {
  const redis = await loadRedisSession(linkId, sessionId);
  if (redis) return { count: redis.docs.length, bytes: redis.bytes, redis };
  const dir = sessionDocsDir(linkId, sessionId);
  if (!existsSync(dir)) return { count: 0, bytes: 0, redis: null };
  const docs = readSessionDocs(linkId, sessionId);
  let bytes = 0;
  for (const meta of docs) bytes += sessionDocDiskBytes(dir, meta);
  return { count: docs.length, bytes, redis: null };
}

function sessionDocDiskBytes(dir: string, meta: SessionDocMeta): number {
  if (typeof meta.bytes === "number") return meta.bytes;
  for (const ext of ORIGINAL_DOC_EXTS) {
    const origPath = join(dir, `${meta.id}.${ext}`);
    if (existsSync(origPath)) return readFileSync(origPath).byteLength;
  }
  const textPath = join(dir, `${meta.id}.txt`);
  return existsSync(textPath) ? readFileSync(textPath).byteLength : 0;
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
      type: fromInline.type ?? InputType.Text,
      name: filename,
    };
  }
  const storageKey = defaultDocStorageKey(moduleId, filename);
  const textPath = join(defaultDocsDir(linkId), storageKey);
  if (!existsSync(textPath)) return null;
  const metaPath = `${textPath}.meta.json`;
  const meta = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, "utf8")) as { type: InputType; filename: string })
    : { type: InputType.Text, filename };
  return { content: readFileSync(textPath, "utf8"), type: meta.type, name: meta.filename ?? filename };
}

export async function saveSessionUpload(
  linkId: SharedLinkId,
  sessionId: string,
  moduleId: ModuleId,
  file: File,
  content: string,
  type: InputType,
  bytes?: Uint8Array,
  append = false,
  knownRedis?: SessionRedisState | null,
): Promise<DocRef> {
  if (!parseSharedSessionId(sessionId)) throw new Error("invalid shared session id");
  const id = hashContent(`${linkId}:${sessionId}:${file.name}:${content.slice(0, 64)}`);
  const doc: DocRef = {
    id,
    name: file.name,
    type,
    label: DocLabel.Inference,
    sizeKb: Math.max(1, Math.round(content.length / 1024)),
    uploadedAt: Date.now(),
    preview: content.slice(0, 180),
  };
  const dir = sessionDocsDir(linkId, sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.txt`), content, "utf8");
  writeFileSync(join(dir, `${id}.meta.json`), JSON.stringify({ ...doc, moduleId }));
  const origBytes = bytes ?? ((type === "pdf" || type === "image") ? new Uint8Array(await file.arrayBuffer()) : undefined);
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  if (origBytes && (shouldSaveOriginalBytes(type) || type === "pdf" || type === "image")) {
    writeFileSync(join(dir, `${id}.${ext}`), origBytes);
    saveOriginalDocBytes(id, origBytes, ext);
    await saveRedisOriginal(linkId, sessionId, id, origBytes, ext);
  }
  const prevRedis = knownRedis !== undefined ? knownRedis : await loadRedisSession(linkId, sessionId);
  const sessionDocs = prevRedis?.docs ?? readSessionDocs(linkId, sessionId);
  const forModule = sessionDocs.filter((d) => d.moduleId === moduleId);
  const otherModules = sessionDocs.filter((d) => d.moduleId !== moduleId);
  const addedBytes = origBytes?.byteLength ?? Buffer.byteLength(content, "utf8");
  const nextForModule = append
    ? [...forModule, { id, name: doc.name, type, label: DocLabel.Inference, moduleId, bytes: addedBytes }]
    : [{ id, name: doc.name, type, label: DocLabel.Inference, moduleId, bytes: addedBytes }];
  const nextDocs = [...otherModules, ...nextForModule];
  writeSessionDocs(linkId, sessionId, nextDocs);
  const nextContent = { ...(prevRedis?.content ?? {}), [id]: content };
  if (!append) {
    for (const old of forModule) {
      if (old.id !== id) {
        delete nextContent[old.id];
        await deleteRedisOriginal(linkId, sessionId, old.id);
      }
    }
  }
  await saveRedisSession(linkId, sessionId, {
    docs: nextDocs,
    content: nextContent,
    bytes: nextDocs.reduce((n, d) => n + (d.bytes ?? 0), 0),
  });
  return doc;
}

export async function sessionDocsForModule(
  linkId: SharedLinkId,
  sessionId: string,
  moduleId: ModuleId,
): Promise<DocRef[]> {
  const redis = await loadRedisSession(linkId, sessionId);
  const docs = redis?.docs ?? readSessionDocs(linkId, sessionId);
  return docs
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

export async function sessionDocContent(
  linkId: SharedLinkId,
  sessionId: string,
  docId: DocId,
): Promise<string | undefined> {
  if (!parseSharedDocId(docId)) return undefined;
  const redis = await loadRedisSession(linkId, sessionId);
  if (redis && Object.prototype.hasOwnProperty.call(redis.content, docId)) {
    return redis.content[docId];
  }
  const root = sessionDocsDir(linkId, sessionId);
  const path = safeJoinUnder(root, `${docId}.txt`);
  if (!path || !existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

export function defaultDocIdForLink(
  linkId: SharedLinkId,
  moduleId: ModuleId,
  filename: string,
): DocId {
  return hashContent(`shared_default:${linkId}:${moduleId}:${filename}`);
}

export async function resolveSharedDocParserText(
  linkId: SharedLinkId,
  docId: DocId,
  sessionId: string | undefined,
  defaultDocs: SharedLinkDefaultDoc[],
): Promise<string | undefined> {
  if (!parseSharedDocId(docId)) return undefined;
  const safeSessionId = parseSharedSessionId(sessionId);
  if (safeSessionId) {
    const sessionText = await sessionDocContent(linkId, safeSessionId, docId);
    if (sessionText !== undefined) return sessionText;
  }
  for (const def of defaultDocs) {
    if (defaultDocIdForLink(linkId, def.moduleId, def.filename) !== docId) continue;
    return loadDefaultDocContent(linkId, def.moduleId, def.filename, defaultDocs)?.content;
  }
  return undefined;
}

export type SharedOriginalDocFile = { mime: string; path?: string; bytes?: Uint8Array };

function originalFileInDir(dir: string, baseName: string): SharedOriginalDocFile | null {
  for (const ext of ORIGINAL_DOC_EXTS) {
    const path = safeJoinUnder(dir, `${baseName}.${ext}`);
    if (!path || !existsSync(path)) continue;
    return { path, mime: EXT_MIME[ext] };
  }
  return null;
}

function sharedOriginalInDir(dir: string, baseName: string): SharedOriginalDocFile | null {
  if (!parseSharedDocId(baseName)) return null;
  return originalFileInDir(dir, baseName);
}

export async function resolveSharedDocOriginalFile(
  linkId: SharedLinkId,
  docId: DocId,
  sessionId: string | undefined,
  defaultDocs: SharedLinkDefaultDoc[],
): Promise<SharedOriginalDocFile | null> {
  if (!parseSharedDocId(docId)) return null;
  const safeSessionId = parseSharedSessionId(sessionId);
  if (safeSessionId) {
    try {
      const redisOrig = await loadRedisOriginal(linkId, safeSessionId, docId);
      if (redisOrig) {
        const safeExt = parseOriginalDocExt(redisOrig.ext);
        if (safeExt) return { mime: EXT_MIME[safeExt], bytes: redisOrig.bytes };
      }
      const sessionFile = sharedOriginalInDir(sessionDocsDir(linkId, safeSessionId), docId);
      if (sessionFile) return sessionFile;
    } catch {
      return null;
    }
  }
  for (const def of defaultDocs) {
    if (defaultDocIdForLink(linkId, def.moduleId, def.filename) !== docId) continue;
    const defaultFile = originalFileInDir(defaultDocsDir(linkId), defaultDocStorageKey(def.moduleId, def.filename));
    if (defaultFile) return defaultFile;
  }
  return null;
}

// AI : overlay session + default docs onto the sharer's store for runPipeline.
export async function overlayStoreForSharedRun(
  base: Store,
  linkId: SharedLinkId,
  sessionId: string,
  defaultDocs: SharedLinkDefaultDoc[],
): Promise<Store> {
  if (!parseSharedSessionId(sessionId)) throw new Error("invalid shared session id");
  const extraDocs = new Map<DocId, DocRef>();
  const extraContent = new Map<DocId, string>();

  for (const def of defaultDocs) {
    const loaded = loadDefaultDocContent(linkId, def.moduleId, def.filename, defaultDocs);
    if (!loaded) continue;
    const id = defaultDocIdForLink(linkId, def.moduleId, def.filename);
    extraDocs.set(id, {
      id,
      name: loaded.name,
      type: loaded.type,
      label: DocLabel.Inference,
      sizeKb: Math.max(1, Math.round(loaded.content.length / 1024)),
      uploadedAt: Date.now(),
      preview: loaded.content.slice(0, 180),
    });
    extraContent.set(id, loaded.content);
  }

  const redis = await loadRedisSession(linkId, sessionId);
  const sessionDocs = redis?.docs ?? readSessionDocs(linkId, sessionId);
  for (const meta of sessionDocs) {
    const content = redis ? redis.content[meta.id] : await sessionDocContent(linkId, sessionId, meta.id);
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

  return overlayStore(base, extraDocs, extraContent);
}
