import { readFileSync } from "node:fs";
import { type VisionAttachment } from "./openrouter_llm";
import { llmVisionString, type CallContext } from "./llm";
import { originalDocFile, type Store } from "./store";
import { type DocId, type ModelId } from "./types";
import { type ServerLogger } from "./server_logger";
import { visionCacheKey } from "./doc_text_cache";

const OCR_SYSTEM =
  "You are an OCR engine. Transcribe documents faithfully. Preserve structure with markdown headings and lists where helpful. For handwritten text, read carefully and include uncertain words in [brackets]. Output only the transcribed text — no commentary or preamble.";

const DEFAULT_OCR_PROMPT =
  "Transcribe every visible word, number, and label from this document into plain text. Preserve section headings and question numbering.";

type DocBytes = { bytes: Uint8Array; mime: string };

export function mimeIsVisionAttachment(mime: string): boolean {
  const m = mime.toLowerCase();
  return m.startsWith("image/") || m === "application/pdf";
}

function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

export async function loadDocBytesForVision(store: Store, docId: DocId): Promise<DocBytes | undefined> {
  const file = await originalDocFile(docId);
  if (file) {
    const bytes = new Uint8Array(readFileSync(file.path));
    // AI : seed backfill used to copy .json onto <hash>.pdf — don't send that as a vision image.
    if (file.ext === "pdf" && !looksLikePdf(bytes)) {
      return { bytes, mime: "text/plain" };
    }
    return { bytes, mime: file.mime };
  }
  const meta = store.docs().find((d) => d.id === docId);
  if (meta?.type === "image") {
    throw new Error(
      `vision OCR: no image bytes for ${docId} — re-upload the file so the server can store the original`,
    );
  }
  return undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export type VisionOcrResult = {
  text: string;
  model: ModelId;
  fromVisionCache: boolean;
  visionCacheKey: ReturnType<typeof visionCacheKey>;
};

// AI : OpenRouter vision OCR — cached separately from docs.content (built-in PDF parser).
export async function docToTextViaLlm(
  store: Store,
  docId: DocId,
  purpose: string,
  userPrompt: string | undefined,
  ctx: CallContext,
  parserText: string,
  log: ServerLogger,
): Promise<VisionOcrResult> {
  const prompt =
    userPrompt?.trim() ||
    `${DEFAULT_OCR_PROMPT}\n\nDocument purpose: ${purpose || "general transcription"}`;
  const key = visionCacheKey({ docId, model: ctx.model, prompt, purpose });
  const cached = store.visionCacheGet(key);
  if (cached) {
    log.info(`vision OCR cache HIT`, { docId, key, model: cached.model, chars: cached.content.length });
    return { text: cached.content, model: cached.model, fromVisionCache: true, visionCacheKey: key };
  }

  const llmCtx: CallContext = { ...ctx, system: OCR_SYSTEM, maxTokens: 16384 };
  let text: string;

  const media = await loadDocBytesForVision(store, docId);
  if (media && mimeIsVisionAttachment(media.mime)) {
    const attachments: VisionAttachment[] = [
      { mime: media.mime, base64: bytesToBase64(media.bytes) },
    ];
    log.info(`vision OCR call`, { docId, mime: media.mime, bytes: media.bytes.length, model: ctx.model });
    text = (await llmVisionString(prompt, attachments, llmCtx, log)).trim();
  } else {
    const extra = media ? new TextDecoder().decode(media.bytes) : "";
    const body = parserText.trim() || extra.trim();
    if (!body) throw new Error(`vision OCR: no file bytes or parser text for ${docId}`);
    log.info(`vision OCR text fallback`, { docId, parserChars: body.length, mime: media?.mime });
    const textPrompt = `${prompt}\n\n── BUILT-IN PARSER TEXT ──\n${body}`;
    text = (await llmVisionString(textPrompt, [], llmCtx, log)).trim();
  }

  if (!text) throw new Error(`vision OCR returned empty text for ${docId}`);
  store.visionCacheSet({ key, docId, model: ctx.model, prompt, purpose, content: text });
  log.info(`vision OCR cache written`, { docId, key, model: ctx.model, chars: text.length });
  return { text, model: ctx.model, fromVisionCache: false, visionCacheKey: key };
}
