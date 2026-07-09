import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { prettyJsonString, tryParseJson } from "@/lib/json-utils"
import { hashFileBytes, parserCacheKey, type FileContentHash, type ParserKind } from "@/lib/server/doc_text_cache"
import type { Store } from "@/lib/server/store"
import type { TabularSheet } from "@/lib/server/tabular_parse"
import type { DocId, InputType } from "@/lib/server/types"
import {
  inputTypeFromFilename,
  MAX_UPLOAD_BYTES,
  REJECTED_UPLOAD_EXTS,
  uploadSizeErrorMessage,
} from "@/lib/server/upload_constants"

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
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  // AI : SECURITY — block executable / HTML uploads before bytes are read.
  if (REJECTED_UPLOAD_EXTS.has(ext)) {
    return { message: `${ext} uploads are not allowed`, status: 400 }
  }
  const confidentialBlock = confidentialUploadWarning(file.name)
  if (confidentialBlock) return { message: confidentialBlock, status: 403 }
  return null
}

// AI : magic-byte sniff — reject extension spoofing (e.g. .html renamed .pdf).
export function validateUploadBytes(
  bytes: Uint8Array,
  filename: string,
  type: InputType,
): UploadValidationError | null {
  if (bytes.length < 4) return { message: "file too small", status: 400 }
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""
  if (REJECTED_UPLOAD_EXTS.has(ext) || type === "web") {
    return { message: "HTML and script uploads are not allowed", status: 400 }
  }
  const head = Array.from(bytes.slice(0, 8))
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
  const isZip = head[0] === 0x50 && head[1] === 0x4b && (head[2] === 0x03 || head[2] === 0x05 || head[2] === 0x07)
  if (type === "pdf" && !isPdf) return { message: "file does not look like a PDF", status: 400 }
  if (type === "image" && ext === "png" && !isPng) return { message: "file does not look like a PNG", status: 400 }
  if (type === "image" && (ext === "jpg" || ext === "jpeg") && !isJpeg) {
    return { message: "file does not look like a JPEG", status: 400 }
  }
  if (type === "word" && (ext === "docx" || ext === "doc") && ext === "docx" && !isZip) {
    return { message: "file does not look like a Word document", status: 400 }
  }
  if (type === "excel" && (ext === "xlsx" || ext === "xls") && ext === "xlsx" && !isZip) {
    return { message: "file does not look like an Excel workbook", status: 400 }
  }
  if (type === "json") {
    const probe = new TextDecoder().decode(bytes.slice(0, 256)).trimStart()
    if (!probe.startsWith("{") && !probe.startsWith("[")) {
      return { message: "file does not look like JSON", status: 400 }
    }
  }
  // AI : SECURITY — reject HTML masquerading as text/md.
  if (type === "text") {
    const probe = new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase()
    if (probe.startsWith("<!doctype html") || probe.startsWith("<html") || probe.includes("<script")) {
      return { message: "HTML content is not allowed in text uploads", status: 400 }
    }
  }
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
