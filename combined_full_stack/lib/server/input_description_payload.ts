import type { Store } from "./store";
import type { DocId } from "./types";

export type InputDescriptionCheckListItem = {
  value: unknown;
  vision?: { store: Store; docId: DocId; docName: string };
  label?: string;
};

export const INPUT_PREVIEW_CHARS = 80_000;
export const MIN_INPUT_TEXT_CHARS = 80;

const PROSE_KEYS = ["content", "body"] as const;
const UPLOAD_META_KEYS = new Set(["filename", "doc_id", "content", "body", "purpose"]);

function nonUploadKeys(rec: Record<string, unknown>): string[] {
  return Object.keys(rec).filter((k) => !UPLOAD_META_KEYS.has(k));
}

function hasNestedStructure(rec: Record<string, unknown>): boolean {
  return Object.entries(rec).some(([k, v]) => {
    if (UPLOAD_META_KEYS.has(k)) return false;
    return v != null && typeof v === "object";
  });
}

// AI : uploaded file — prose in content/body with at most one scalar extra field; not a model row or nested JSON.
export function isDocumentLike(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if (!uploadedFileText(value)) return false;
  if (hasNestedStructure(rec)) return false;
  return nonUploadKeys(rec).length <= 1;
}

// AI : structured pipeline values — check JSON shape, not nested prose.
export function preferJsonPayload(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    const first = value[0];
    return !!first && typeof first === "object" && !Array.isArray(first) && !isDocumentLike(first);
  }
  return !isDocumentLike(value);
}

export function uploadedFileText(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const rec = value as Record<string, unknown>;
  return (
    (typeof rec.content === "string" && rec.content.trim()) ||
    (typeof rec.body === "string" && rec.body.trim()) ||
    ""
  );
}

export function extractBodyText(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (v.length > 40) parts.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      const rec = v as Record<string, unknown>;
      for (const key of PROSE_KEYS) {
        const s = rec[key];
        if (typeof s === "string" && s.trim()) parts.push(s);
      }
      for (const [key, child] of Object.entries(rec)) {
        if (PROSE_KEYS.includes(key as (typeof PROSE_KEYS)[number])) continue;
        walk(child);
      }
    }
  };
  walk(value);
  return parts.join("\n\n");
}

export function checkPayload(value: unknown): string {
  const uploadText = uploadedFileText(value);
  if (uploadText.length >= MIN_INPUT_TEXT_CHARS && isDocumentLike(value)) {
    return uploadText.slice(0, INPUT_PREVIEW_CHARS);
  }
  const json = JSON.stringify(value, null, 2);
  if (preferJsonPayload(value)) return json.slice(0, INPUT_PREVIEW_CHARS);
  const bodyText = extractBodyText(value).trim();
  if (bodyText.length >= MIN_INPUT_TEXT_CHARS) return bodyText.slice(0, INPUT_PREVIEW_CHARS);
  return json.slice(0, INPUT_PREVIEW_CHARS);
}

export function listItemLabel(item: unknown, index: number): string {
  if (!item || typeof item !== "object" || Array.isArray(item)) return `item ${index + 1}`;
  const rec = item as Record<string, unknown>;
  for (const key of ["filename", "name", "title", "id", "label"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return `item ${index + 1}`;
}

// AI : multi-doc inputs pass listItems explicitly; only uploaded docs get per-item checks.
export function expandListItemsForCheck(
  value: unknown,
  listItems?: InputDescriptionCheckListItem[],
): InputDescriptionCheckListItem[] | undefined {
  if (listItems && listItems.length > 1) return listItems;
  if (!Array.isArray(value) || value.length <= 1) return listItems;
  if (!value.every((v) => v != null && typeof v === "object" && !Array.isArray(v))) return listItems;
  if (!value.every(isDocumentLike)) return listItems;
  return value.map((item, i) => ({
    value: item,
    label: listItemLabel(item, i),
  }));
}

export type InputCheckPayloadMode = "json" | "text";

export function inputCheckPayloadMode(value: unknown): InputCheckPayloadMode {
  const bodyText = extractBodyText(value).trim();
  return preferJsonPayload(value) ? "json" : bodyText.length >= MIN_INPUT_TEXT_CHARS ? "text" : "json";
}
