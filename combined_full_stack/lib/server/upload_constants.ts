import { InputType } from "@/lib/server/types"

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
// AI : TODO (media-view-A-storage) — raise / bypass 25MB for audio/video/3d; chunked upload to doc-originals.

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
  // AI : TODO (media-view-A-upload) — wav/mp3/ogg/m4a → Audio; mp4/webm/mov → Video; gltf/glb/stl/obj → Model3d.
}

export const REJECTED_UPLOAD_EXTS = new Set(["html", "htm", "svg", "js", "mjs", "cjs", "wasm"])
// AI : TODO (media-view-C-store) — keep html rejected as *docs*. Visualizer HTML is Project.visualizers, not this map.

export function inputTypeFromFilename(filename: string): InputType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TYPE[ext] ?? InputType.Text
}

export function uploadSizeErrorMessage(): string {
  return `file too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`
}
