import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { prettyJsonString, tryParseJson } from "@/lib/json-utils"
import { hashFileBytes, parserCacheKey, type FileContentHash, type ParserKind } from "@/lib/server/doc_text_cache"
import type { Store } from "@/lib/server/store"
import type { TabularSheet } from "@/lib/server/tabular_parse"
import type { DocId, InputType } from "@/lib/server/types"
import { inputTypeFromFilename, MAX_UPLOAD_BYTES, uploadSizeErrorMessage } from "@/lib/server/upload_constants"

export type UploadValidationError = {
  message: string
  status: 400 | 403 | 413
}

export type ParsedUpload = {
  content: string
  parserKind: ParserKind | null
  parsedFresh: boolean
  sheets: TabularSheet[]
  fileHash: FileContentHash
}

type ParserCacheStore = Pick<Store, "parserCacheGetByFileHash" | "parserCacheSet">

export function validateUploadFile(file: File | null): UploadValidationError | null {
  if (!(file instanceof File)) return { message: "missing file", status: 400 }
  if (file.size > MAX_UPLOAD_BYTES) return { message: uploadSizeErrorMessage(), status: 413 }
  const confidentialBlock = confidentialUploadWarning(file.name)
  if (confidentialBlock) return { message: confidentialBlock, status: 403 }
  return null
}

export { inputTypeFromFilename }

export function shouldSaveOriginalBytes(type: InputType): boolean {
  return type === "pdf" || type === "image" || type === "excel" || type === "json"
}

export async function parseUploadedBytes(
  bytes: Uint8Array,
  filename: string,
  type: InputType,
  store?: ParserCacheStore,
): Promise<ParsedUpload> {
  const fileHash = hashFileBytes(bytes)
  let parserKind: ParserKind | null = null
  let parsedFresh = false
  let content: string
  let sheets: TabularSheet[] = []

  if (type === "pdf") {
    parserKind = "pdfjs"
    const cached = store?.parserCacheGetByFileHash(fileHash, parserKind)
    if (cached) {
      content = cached.content
    } else {
      const { pdfBytesToText } = await import("@/lib/server/pdf_to_text")
      content = await pdfBytesToText(bytes)
      parsedFresh = true
    }
  } else if (type === "image") {
    content = ""
  } else if (type === "excel") {
    parserKind = "plain"
    const cached = store?.parserCacheGetByFileHash(fileHash, parserKind)
    if (cached) {
      content = cached.content
    } else {
      const { tabularBytesToContent } = await import("@/lib/server/tabular_parse")
      const tabular = tabularBytesToContent(bytes, filename)
      content = tabular.content
      sheets = tabular.sheets
      parsedFresh = true
    }
  } else if (type === "json") {
    parserKind = "plain"
    const cached = store?.parserCacheGetByFileHash(fileHash, parserKind)
    if (cached) {
      content = cached.content
    } else {
      const raw = new TextDecoder().decode(bytes)
      const parsed = tryParseJson(raw)
      content = parsed.ok ? prettyJsonString(raw) : raw
      parsedFresh = true
    }
  } else {
    parserKind = "plain"
    const cached = store?.parserCacheGetByFileHash(fileHash, parserKind)
    if (cached) {
      content = cached.content
    } else {
      content = new TextDecoder().decode(bytes)
      parsedFresh = true
    }
  }

  return { content, parserKind, parsedFresh, sheets, fileHash }
}

export function writeParserCacheIfFresh(
  store: ParserCacheStore,
  parsed: ParsedUpload,
  docId: DocId,
): void {
  if (!parsed.parsedFresh || !parsed.parserKind) return
  store.parserCacheSet({
    key: parserCacheKey(parsed.fileHash, parsed.parserKind),
    fileHash: parsed.fileHash,
    docId,
    parser: parsed.parserKind,
    content: parsed.content,
  })
}
