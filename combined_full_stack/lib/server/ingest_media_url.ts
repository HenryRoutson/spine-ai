import { blobDocContent } from "@/lib/server/doc_upload_parse";
import { persistOriginalDocBytes, EXT_MIME, parseOriginalDocExt, type Store } from "@/lib/server/store";
import { DocLabel, InputType, type DocId } from "@/lib/server/types";

export type IngestedClip = {
  doc_id: DocId;
  url: string;
  filename: string;
  mime: string;
};

function filenameFromUrl(url: string, fallback: string): string {
  try {
    const path = new URL(url).pathname;
    const base = path.split("/").filter(Boolean).pop();
    if (base && /\.[a-z0-9]+$/i.test(base)) return base;
  } catch {
    /* ignore */
  }
  return fallback;
}

function extForType(type: InputType, filename: string): string {
  const fromName = filename.split(".").pop()?.toLowerCase() ?? "";
  if (parseOriginalDocExt(fromName)) return fromName;
  if (type === InputType.Audio) return "mp3";
  if (type === InputType.Image) return "png";
  return "mp4";
}

export async function ingestMediaUrlToClip(
  store: Store,
  mediaUrl: string,
  type: InputType,
): Promise<IngestedClip> {
  const url = mediaUrl.trim();
  if (!url) throw new Error("ingest url is empty");
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest ${res.status}${text ? `: ${text.slice(0, 160)}` : ""}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 16) throw new Error("ingest: empty media body");
  const filename = filenameFromUrl(
    url,
    type === InputType.Audio ? "clip.mp3" : type === InputType.Image ? "still.png" : "clip.mp4",
  );
  const ext = extForType(type, filename);
  const content = blobDocContent(filename, bytes);
  const doc = store.addDoc(filename, type, content, DocLabel.Inference);
  persistOriginalDocBytes(store, doc.id, bytes, ext);
  const mime = EXT_MIME[ext as keyof typeof EXT_MIME] ?? res.headers.get("content-type") ?? "application/octet-stream";
  return { doc_id: doc.id, url, filename, mime };
}
