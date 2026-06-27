import type { DocId } from "./types";

type DocumentHints = {
  docId?: string;
  docName?: string;
};

// AI : normalize runtime document values — supports legacy body/doc_id and the shared Document struct.
export function documentContentFrom(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const rec = value as Record<string, unknown>;
  if (typeof rec.content === "string") return rec.content;
  if (typeof rec.body === "string") return rec.body;
  return fallback;
}

export function documentFilenameFrom(
  value: unknown,
  hints: DocumentHints = {},
  fallback = "",
): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return hints.docName?.trim() || hints.docId || fallback;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.filename === "string" && rec.filename.trim()) return rec.filename.trim();
  if (typeof rec.doc_id === "string" && rec.doc_id.trim()) return rec.doc_id.trim();
  return hints.docName?.trim() || hints.docId || fallback;
}

export function documentDocIdFrom(value: unknown, hints: DocumentHints = {}): DocId | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return hints.docId as DocId | undefined;
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.doc_id === "string" && rec.doc_id.trim()) return rec.doc_id.trim() as DocId;
  return hints.docId as DocId | undefined;
}

export function documentValueFrom(
  value: unknown,
  hints: DocumentHints = {},
  fallbackContent = "",
): { content: string; filename: string } {
  return {
    content: documentContentFrom(value, fallbackContent),
    filename: documentFilenameFrom(value, hints, hints.docId ?? "document"),
  };
}
