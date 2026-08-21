import { InputType } from "@/lib/server/types"

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
export const MAX_MEDIA_UPLOAD_BYTES = 80 * 1024 * 1024

const MEDIA_UPLOAD_EXTS = new Set(["mp4", "webm", "mov", "wav", "mp3", "m4a", "ogg"])

export function maxUploadBytesForFilename(filename: string): number {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return MEDIA_UPLOAD_EXTS.has(ext) ? MAX_MEDIA_UPLOAD_BYTES : MAX_UPLOAD_BYTES
}

// AI : SECURITY — html/htm rejected (stored XSS / inline script risk); Web type is not uploadable.
export const EXT_TYPE: Record<string, InputType> = {
  pdf: InputType.Pdf,
  doc: InputType.Word,
  docx: InputType.Word,
  xls: InputType.Excel,
  xlsx: InputType.Excel,
  csv: InputType.Excel,
  json: InputType.Json,
  txt: InputType.Text,
  md: InputType.Markdown,
  markdown: InputType.Markdown,
  tex: InputType.Latex,
  latex: InputType.Latex,
  png: InputType.Image,
  jpg: InputType.Image,
  jpeg: InputType.Image,
  wav: InputType.Audio,
  mp3: InputType.Audio,
  m4a: InputType.Audio,
  ogg: InputType.Audio,
  mp4: InputType.Video,
  webm: InputType.Video,
  mov: InputType.Video,
}

export const REJECTED_UPLOAD_EXTS = new Set(["html", "htm", "svg", "js", "mjs", "cjs", "wasm"])
// AI : TODO (media-view-C-store) — keep html rejected as *docs*. Visualizer HTML is Project.visualizers, not this map.

export function inputTypeFromFilename(filename: string): InputType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TYPE[ext] ?? InputType.Text
}

export function uploadSizeErrorMessage(maxBytes = MAX_UPLOAD_BYTES): string {
  return `file too large (max ${maxBytes / (1024 * 1024)}MB)`
}
