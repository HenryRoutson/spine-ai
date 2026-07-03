import { InputType } from "@/lib/server/types"

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

export const EXT_TYPE: Record<string, InputType> = {
  pdf: InputType.Pdf,
  doc: InputType.Word,
  docx: InputType.Word,
  xls: InputType.Excel,
  xlsx: InputType.Excel,
  csv: InputType.Excel,
  json: InputType.Json,
  txt: InputType.Text,
  md: InputType.Text,
  html: InputType.Web,
  png: InputType.Image,
  jpg: InputType.Image,
  jpeg: InputType.Image,
}

export function inputTypeFromFilename(filename: string): InputType {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  return EXT_TYPE[ext] ?? InputType.Text
}

export function uploadSizeErrorMessage(): string {
  return `file too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB)`
}
