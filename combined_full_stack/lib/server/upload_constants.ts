import type { InputType } from "@/lib/server/types"

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const EXT_TYPE: Record<string, InputType> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  json: "json",
  txt: "text",
  md: "text",
  html: "web",
  png: "image",
  jpg: "image",
  jpeg: "image",
}

export function inputTypeFromFilename(filename: string): InputType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TYPE[ext] ?? "text"
}

export function uploadSizeErrorMessage(): string {
  return `file too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`
}
