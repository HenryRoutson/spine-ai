import type { DocId, DocLabel, DocRef, InputType } from "./types";

export const DOC_PREVIEW_CHARS = 180 as const;

// AI : snake_case row shape shared by docs + seed_docs Supabase tables.
export type DocDbRow = {
  id: string;
  name: string;
  type: string;
  label: string;
  size_kb: number;
  uploaded_at: number;
  preview: string;
  content: string;
};

export type UserDocDbRow = DocDbRow & { user_id: string };

import { sizeKbFromChars } from "@/lib/doc-size";

export function contentSizeKb(content: string): number {
  return sizeKbFromChars(content.length);
}

export function docPreview(content: string): string {
  return content.slice(0, DOC_PREVIEW_CHARS);
}

export function buildDocRef(params: {
  id: DocId;
  name: string;
  type: InputType;
  label: DocLabel;
  content: string;
  uploadedAt?: number;
}): DocRef {
  const uploadedAt = params.uploadedAt ?? Date.now();
  return {
    id: params.id,
    name: params.name,
    type: params.type,
    label: params.label,
    sizeKb: contentSizeKb(params.content),
    uploadedAt,
    preview: docPreview(params.content),
  };
}

export function docRefFromDbRow(row: DocDbRow): DocRef {
  return {
    id: row.id as DocId,
    name: row.name,
    type: row.type as InputType,
    label: row.label as DocLabel,
    sizeKb: row.size_kb > 0 ? row.size_kb : contentSizeKb(row.content),
    uploadedAt: row.uploaded_at,
    preview: row.preview,
  };
}

export function seedDocDbRow(params: {
  id: DocId;
  name: string;
  type: InputType;
  label: DocLabel;
  content: string;
  uploadedAt?: number;
}): DocDbRow {
  const uploadedAt = params.uploadedAt ?? Date.now();
  return {
    id: params.id,
    name: params.name,
    type: params.type,
    label: params.label,
    size_kb: contentSizeKb(params.content),
    uploaded_at: uploadedAt,
    preview: docPreview(params.content),
    content: params.content,
  };
}

export function userDocDbRow(userId: string, doc: DocRef, content: string): UserDocDbRow {
  return {
    user_id: userId,
    id: doc.id,
    name: doc.name,
    type: doc.type,
    label: doc.label,
    size_kb: doc.sizeKb,
    uploaded_at: doc.uploadedAt,
    preview: doc.preview,
    content,
  };
}
