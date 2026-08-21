import type { SupabaseClient } from "@supabase/supabase-js";
import { storeErrorMessage } from "./errors";
import { logger } from "./server_logger";
import {
  EXT_MIME,
  ORIGINAL_DOC_EXTS,
  type OriginalDocBytes,
  type OriginalDocExt,
  type OriginalDocMeta,
} from "./store";
import type { DocId } from "./types";
import type { user_id_string } from "./require_auth";

export const DOC_ORIGINALS_BUCKET = "doc-originals";
const origLog = logger("docs:original-bytes");
// AI : original bytes are document.blob (mime from InputType). Storage bucket is the
// AI :   blob store behind the column; the type is still one document row, not a parallel File universe.

export function originalStoragePath(userId: user_id_string, docId: DocId, ext: OriginalDocExt): string {
  return `${userId}/${docId}.${ext}`;
}

function isMissingBucketError(error: unknown): boolean {
  const msg = storeErrorMessage(error, "").toLowerCase();
  return msg.includes("bucket") && (msg.includes("not found") || msg.includes("does not exist"));
}

async function ensureOriginalsBucket(db: SupabaseClient): Promise<{ error: unknown }> {
  origLog.warn(`Storage bucket doc-originals missing — creating it`);
  const { error } = await db.storage.createBucket(DOC_ORIGINALS_BUCKET, {
    public: false,
    fileSizeLimit: 25 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    // AI : TODO (media-view-A-storage) — audio/* video/* model/gltf-binary + size limit for clips/CAD.
  });
  if (!error) {
    origLog.info(`created Storage bucket doc-originals`);
    return { error: null };
  }
  const msg = storeErrorMessage(error, "").toLowerCase();
  if (msg.includes("already exists") || msg.includes("duplicate")) {
    origLog.info(`Storage bucket doc-originals already exists`);
    return { error: null };
  }
  origLog.error(`could not create Storage bucket doc-originals`, { error: storeErrorMessage(error) });
  return { error };
}

export async function uploadOriginalDocObject(
  db: SupabaseClient,
  userId: user_id_string,
  docId: DocId,
  bytes: Uint8Array,
  ext: OriginalDocExt,
): Promise<{ error: unknown }> {
  const path = originalStoragePath(userId, docId, ext);
  const body = Buffer.from(bytes);
  const opts = { contentType: EXT_MIME[ext], upsert: true as const };
  origLog.debug(`uploading original bytes to Storage`, {
    bucket: DOC_ORIGINALS_BUCKET,
    path,
    ext,
    bytes: body.length,
  });
  const first = await db.storage.from(DOC_ORIGINALS_BUCKET).upload(path, body, opts);
  if (!first.error) {
    origLog.info(`original bytes uploaded to Storage`, {
      bucket: DOC_ORIGINALS_BUCKET,
      path,
      ext,
      bytes: body.length,
    });
    return { error: null };
  }
  origLog.warn(`Storage upload failed`, {
    bucket: DOC_ORIGINALS_BUCKET,
    path,
    error: storeErrorMessage(first.error),
  });
  if (!isMissingBucketError(first.error)) return { error: first.error };
  const created = await ensureOriginalsBucket(db);
  if (created.error) return created;
  const retry = await db.storage.from(DOC_ORIGINALS_BUCKET).upload(path, body, opts);
  if (retry.error) {
    origLog.error(`Storage upload retry failed after creating bucket`, {
      bucket: DOC_ORIGINALS_BUCKET,
      path,
      error: storeErrorMessage(retry.error),
    });
    return { error: retry.error };
  }
  origLog.info(`original bytes uploaded to Storage (after creating bucket)`, {
    bucket: DOC_ORIGINALS_BUCKET,
    path,
    ext,
    bytes: body.length,
  });
  return { error: null };
}

export async function findOriginalDocObject(
  db: SupabaseClient,
  userIds: user_id_string[],
  docId: DocId,
): Promise<(OriginalDocMeta & { path: string }) | undefined> {
  let lastError: string | undefined;
  for (const userId of userIds) {
    for (const ext of ORIGINAL_DOC_EXTS) {
      const path = originalStoragePath(userId, docId, ext);
      const { error } = await db.storage.from(DOC_ORIGINALS_BUCKET).createSignedUrl(path, 30);
      if (error) {
        lastError = storeErrorMessage(error);
        continue;
      }
      origLog.debug(`Storage object found`, { bucket: DOC_ORIGINALS_BUCKET, path, ext });
      return { path, mime: EXT_MIME[ext], ext, source: "storage" };
    }
  }
  origLog.debug(`Storage object not found`, {
    bucket: DOC_ORIGINALS_BUCKET,
    docId,
    ownersChecked: userIds.length,
    lastError: lastError ?? "(none)",
  });
  return undefined;
}

export async function downloadOriginalDocObject(
  db: SupabaseClient,
  userIds: user_id_string[],
  docId: DocId,
): Promise<OriginalDocBytes | undefined> {
  const found = await findOriginalDocObject(db, userIds, docId);
  if (!found) return undefined;
  const { data, error } = await db.storage.from(DOC_ORIGINALS_BUCKET).download(found.path);
  if (error || !data) {
    origLog.error(`Storage object exists but download failed`, {
      bucket: DOC_ORIGINALS_BUCKET,
      path: found.path,
      error: error ? storeErrorMessage(error) : "empty body",
    });
    return undefined;
  }
  return {
    bytes: new Uint8Array(await data.arrayBuffer()),
    mime: found.mime,
    ext: found.ext,
    source: "storage",
  };
}

export async function removeOriginalDocObject(
  db: SupabaseClient,
  userId: user_id_string,
  docId: DocId,
): Promise<{ error: unknown }> {
  const paths = ORIGINAL_DOC_EXTS.map((ext) => originalStoragePath(userId, docId, ext));
  const { error } = await db.storage.from(DOC_ORIGINALS_BUCKET).remove(paths);
  return { error };
}

export async function removeAllOriginalDocObjectsForUser(
  db: SupabaseClient,
  userId: user_id_string,
): Promise<void> {
  const { data, error } = await db.storage.from(DOC_ORIGINALS_BUCKET).list(userId, { limit: 1000 });
  if (error || !data?.length) return;
  await db.storage.from(DOC_ORIGINALS_BUCKET).remove(data.map((file) => `${userId}/${file.name}`));
}
