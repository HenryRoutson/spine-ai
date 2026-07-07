// AI : Session-scoped document management for shared-link public runs.
// AI : Per-session uploads + default doc overlay for runPipeline; storage is local FS + Supabase blob.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { dataDir } from "./config";
import { hashContent, saveOriginalDocBytes, type Store } from "./store";
import { shouldSaveOriginalBytes } from "./doc_upload_parse";
import { DocLabel } from "./types";
import { InputType, type DocId, type DocRef, type ModuleId, type SharedLinkId } from "./types";
import type { SharedLinkDefaultDoc } from "@/lib/shared-link-types";

// AI : per-session caps — limits storage exhaustion on public shared-link uploads.
export const MAX_SHARED_SESSION_DOCS = 30;
export const MAX_SHARED_SESSION_BYTES = 100 * 1024 * 1024;

export const SHARED_SESSION_ID_RE = /^[a-f0-9]{32}$/;
export const SHARED_DOC_ID_RE = /^sha_[a-f0-9]{16}$/;

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

export function sessionUploadCount(linkId: SharedLinkId, sessionId: string): number {
  return readSessionDocs(linkId, sessionId).length;
}

export function sessionUploadBytes(linkId: SharedLinkId, sessionId: string): number {
  const dir = sessionDocsDir(linkId, sessionId);
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const meta of readSessionDocs(linkId, sessionId)) {
    const textPath = join(dir, `${meta.id}.txt`);
    if (existsSync(textPath)) total += readFileSync(textPath).byteLength;
  }
  return total;
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
  const storageKey = `${moduleId}_${filename}`;
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
  if (bytes && shouldSaveOriginalBytes(type)) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    writeFileSync(join(dir, `${id}.${ext}`), bytes);
    saveOriginalDocBytes(id, bytes, ext);
  } else if (type === "pdf" || type === "image") {
    const fileBytes = bytes ?? new Uint8Array(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    writeFileSync(join(dir, `${id}.${ext}`), fileBytes);
    saveOriginalDocBytes(id, fileBytes, ext);
  }
  const sessionDocs = readSessionDocs(linkId, sessionId);
  const forModule = sessionDocs.filter((d) => d.moduleId === moduleId);
  const otherModules = sessionDocs.filter((d) => d.moduleId !== moduleId);
  const nextForModule = append
    ? [...forModule, { id, name: doc.name, type, label: DocLabel.Inference, moduleId }]
    : [{ id, name: doc.name, type, label: DocLabel.Inference, moduleId }];
  writeSessionDocs(linkId, sessionId, [...otherModules, ...nextForModule]);
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
  if (!parseSharedDocId(docId)) return undefined;
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

export function resolveSharedDocParserText(
  linkId: SharedLinkId,
  docId: DocId,
  sessionId: string | undefined,
  defaultDocs: SharedLinkDefaultDoc[],
): string | undefined {
  if (!parseSharedDocId(docId)) return undefined;
  const safeSessionId = parseSharedSessionId(sessionId);
  if (safeSessionId) {
    try {
      const sessionText = sessionDocContent(linkId, safeSessionId, docId);
      if (sessionText !== undefined) return sessionText;
    } catch {
      return undefined;
    }
  }
  for (const def of defaultDocs) {
    if (defaultDocIdForLink(linkId, def.moduleId, def.filename) !== docId) continue;
    return loadDefaultDocContent(linkId, def.moduleId, def.filename, defaultDocs)?.content;
  }
  return undefined;
}

const SHARED_ORIGINAL_EXTS = ["pdf", "png", "jpg", "jpeg", "webp"] as const;
const SHARED_ORIGINAL_MIME: Record<(typeof SHARED_ORIGINAL_EXTS)[number], string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export type SharedOriginalDocFile = { path: string; mime: string };

function sharedOriginalInDir(dir: string, baseName: string): SharedOriginalDocFile | null {
  if (!parseSharedDocId(baseName)) return null;
  for (const ext of SHARED_ORIGINAL_EXTS) {
    const path = safeJoinUnder(dir, `${baseName}.${ext}`);
    if (!path || !existsSync(path)) continue;
    return { path, mime: SHARED_ORIGINAL_MIME[ext] };
  }
  return null;
}

export function resolveSharedDocOriginalFile(
  linkId: SharedLinkId,
  docId: DocId,
  sessionId: string | undefined,
  defaultDocs: SharedLinkDefaultDoc[],
): SharedOriginalDocFile | null {
  if (!parseSharedDocId(docId)) return null;
  const safeSessionId = parseSharedSessionId(sessionId);
  if (safeSessionId) {
    try {
      const sessionFile = sharedOriginalInDir(sessionDocsDir(linkId, safeSessionId), docId);
      if (sessionFile) return sessionFile;
    } catch {
      return null;
    }
  }
  for (const def of defaultDocs) {
    if (defaultDocIdForLink(linkId, def.moduleId, def.filename) !== docId) continue;
    const storageKey = `${def.moduleId}_${def.filename}`;
    const defaultFile = sharedOriginalInDir(defaultDocsDir(linkId), storageKey);
    if (defaultFile) return defaultFile;
  }
  return null;
}

// AI : overlay session + default docs onto the sharer's store for runPipeline.
export function overlayStoreForSharedRun(
  base: Store,
  linkId: SharedLinkId,
  sessionId: string,
  defaultDocs: SharedLinkDefaultDoc[],
  inputModules: { id: ModuleId }[],
): Store {
  if (!parseSharedSessionId(sessionId)) throw new Error("invalid shared session id");
  const extraDocs = new Map<DocId, DocRef>();
  const extraContent = new Map<DocId, string>();

  for (const def of defaultDocs) {
    const loaded = loadDefaultDocContent(linkId, def.moduleId, def.filename, defaultDocs);
    if (!loaded) continue;
    const id = hashContent(`shared_default:${linkId}:${def.moduleId}:${def.filename}`);
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
    updateRunTest: (rid, test) => base.updateRunTest(rid, test),
    flush: () => base.flush(),
  };
}
