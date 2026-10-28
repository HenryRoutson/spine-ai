import { InputType, type StructureModel } from "@/lib/types"

export type BuiltinViewerId = "json" | "audio" | "video" | "image"

export type ResolvedView = {
  viewerId: BuiltinViewerId
  mime?: string
  filename?: string
  docId?: string
  url?: string
  title?: string
}

export type MediaEnvelope = {
  doc_id?: string
  url?: string
  filename?: string
  mime?: string
}

export type StoryboardView = {
  title?: string
  lowerThird?: string
  items: ResolvedView[]
}

const VIDEO_MODEL_IDS = new Set(["m_builtin_video_clip"])
const AUDIO_MODEL_IDS = new Set(["m_builtin_audio_clip"])
const IMAGE_MODEL_IDS = new Set(["m_builtin_image_still"])
const VIDEO_MODEL_NAMES = new Set(["VideoClip"])
const AUDIO_MODEL_NAMES = new Set(["AudioClip"])
const IMAGE_MODEL_NAMES = new Set(["ImageStill"])

const VIDEO_EXTS = [".mp4", ".webm", ".mov"]
const AUDIO_EXTS = [".wav", ".mp3", ".m4a", ".ogg"]
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp", ".gif"]

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

export function parseOutputJson(json: string | undefined): unknown {
  if (!json?.trim()) return null
  try {
    return JSON.parse(json) as unknown
  } catch {
    return null
  }
}

export function mediaEnvelopeFromValue(value: unknown): MediaEnvelope | null {
  const rec = asRecord(value)
  if (!rec) return null
  const docId = typeof rec.doc_id === "string" ? rec.doc_id : undefined
  const url = typeof rec.url === "string" ? rec.url : undefined
  const filename = typeof rec.filename === "string" ? rec.filename : undefined
  const mime = typeof rec.mime === "string" ? rec.mime : undefined
  if (!docId && !url && !filename && !mime) return null
  return { doc_id: docId, url, filename, mime }
}

function extOf(name: string | undefined): string {
  if (!name) return ""
  const i = name.lastIndexOf(".")
  return i >= 0 ? name.slice(i).toLowerCase() : ""
}

function mimeLooksVideo(mime: string | undefined): boolean {
  return !!mime && mime.toLowerCase().startsWith("video/")
}

function mimeLooksAudio(mime: string | undefined): boolean {
  return !!mime && mime.toLowerCase().startsWith("audio/")
}

function mimeLooksImage(mime: string | undefined): boolean {
  return !!mime && mime.toLowerCase().startsWith("image/")
}

function viewerFromEnvelope(
  env: MediaEnvelope,
  opts?: { modelIsVideo?: boolean; modelIsAudio?: boolean; modelIsImage?: boolean },
): ResolvedView | null {
  const filename = env.filename
  const mime = env.mime
  const video =
    opts?.modelIsVideo || mimeLooksVideo(mime) || VIDEO_EXTS.includes(extOf(filename))
  const audio =
    opts?.modelIsAudio || mimeLooksAudio(mime) || AUDIO_EXTS.includes(extOf(filename))
  const image =
    opts?.modelIsImage || mimeLooksImage(mime) || IMAGE_EXTS.includes(extOf(filename))
  if (video) {
    return {
      viewerId: "video",
      mime: mime ?? "video/mp4",
      filename,
      docId: env.doc_id,
      url: env.url,
    }
  }
  if (audio) {
    return {
      viewerId: "audio",
      mime: mime ?? "audio/mpeg",
      filename,
      docId: env.doc_id,
      url: env.url,
    }
  }
  if (image) {
    return {
      viewerId: "image",
      mime: mime ?? "image/png",
      filename,
      docId: env.doc_id,
      url: env.url,
    }
  }
  return null
}

export function resolveViewer(input: {
  value: unknown
  models?: StructureModel[]
  mime?: string
  filename?: string
  outStructureId?: string
}): ResolvedView {
  const env = mediaEnvelopeFromValue(input.value)
  const filename = input.filename ?? env?.filename
  const mime = input.mime ?? env?.mime
  const model = input.outStructureId
    ? input.models?.find((m) => m.id === input.outStructureId)
    : undefined
  const modelIsVideo =
    VIDEO_MODEL_IDS.has(input.outStructureId ?? "") || VIDEO_MODEL_NAMES.has(model?.name ?? "")
  const modelIsAudio =
    AUDIO_MODEL_IDS.has(input.outStructureId ?? "") || AUDIO_MODEL_NAMES.has(model?.name ?? "")
  const modelIsImage =
    IMAGE_MODEL_IDS.has(input.outStructureId ?? "") || IMAGE_MODEL_NAMES.has(model?.name ?? "")
  const fromEnv = env
    ? viewerFromEnvelope({ ...env, filename, mime }, { modelIsVideo, modelIsAudio, modelIsImage })
    : viewerFromEnvelope({ filename, mime }, { modelIsVideo, modelIsAudio, modelIsImage })
  if (fromEnv) return fromEnv
  return { viewerId: "json" }
}

export function collectMediaViews(value: unknown, depth = 0): ResolvedView[] {
  if (depth > 6 || value == null) return []
  const env = mediaEnvelopeFromValue(value)
  if (env) {
    const view = viewerFromEnvelope(env)
    if (view && view.viewerId !== "json") return [view]
  }
  if (Array.isArray(value)) return value.flatMap((item) => collectMediaViews(item, depth + 1))
  const rec = asRecord(value)
  if (!rec) return []
  const out: ResolvedView[] = []
  for (const [key, child] of Object.entries(rec)) {
    if (key === "doc_id" || key === "url" || key === "filename" || key === "mime") continue
    out.push(...collectMediaViews(child, depth + 1))
  }
  return out
}

export function storyboardFromValue(value: unknown): StoryboardView | null {
  const rec = asRecord(value)
  const items = collectMediaViews(value)
  if (items.length === 0) return null
  const title = typeof rec?.title === "string" ? rec.title : undefined
  const lowerThird =
    typeof rec?.lower_third === "string"
      ? rec.lower_third
      : typeof rec?.lowerThird === "string"
        ? rec.lowerThird
        : undefined
  const hasStill = items.some((v) => v.viewerId === "image")
  const hasOverlay = !!(title || lowerThird)
  if (items.length === 1 && items[0]!.viewerId !== "image" && !hasOverlay) return null
  if (!hasStill && !hasOverlay && items.length < 2) return null
  return { title, lowerThird, items }
}

export function isMediaInputType(type: InputType): boolean {
  return type === InputType.Audio || type === InputType.Video
}
