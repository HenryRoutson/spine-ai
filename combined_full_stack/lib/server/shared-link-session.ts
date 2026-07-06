// AI : Session-scoped document management for shared-link public runs.
// AI : Per-session uploads + default doc overlay for runPipeline; storage is local FS + Supabase blob.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./config";
import { hashContent, saveOriginalDocBytes, type Store } from "./store";
import { shouldSaveOriginalBytes } from "./doc_upload_parse";
import { DocLabel } from "./types";
import { InputType, type DocId, type DocRef, type ModuleId, type SharedLinkId } from "./types";
import type { SharedLinkDefaultDoc } from "@/lib/shared-link-types";

// AI : per-session caps — limits storage exhaustion on public shared-link uploads.
export const MAX_SHARED_SESSION_DOCS = 30;
export const MAX_SHARED_SESSION_BYTES = 100 * 1024 * 1024;

function linksDir(): string {
  return join(dataDir(), "shared_links");
}

function sessionDocsDir(linkId: SharedLinkId, sessionId: string): string {
  return join(linksDir(), "docs", linkId, "sessions", sessionId);
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
): Promise<DocRef> {
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
  const existing = readSessionDocs(linkId, sessionId).filter((d) => d.moduleId !== moduleId);
  existing.push({ id, name: doc.name, type, label: DocLabel.Inference, moduleId });
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
  defaultDocs: SharedLinkDefaultDoc[],
  inputModules: { id: ModuleId }[],
): Store {
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
