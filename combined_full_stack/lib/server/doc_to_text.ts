import { readFileSync } from "node:fs";
import { type VisionAttachment } from "./openrouter_llm";
import { llmVisionString, type CallContext } from "./llm";
import { originalDocFile, type Store } from "./store";
import { type DocId } from "./types";
import { type ServerLogger } from "./server_logger";

const OCR_SYSTEM =
  "You are an OCR engine. Transcribe documents faithfully. Preserve structure with markdown headings and lists where helpful. For handwritten text, read carefully and include uncertain words in [brackets]. Output only the transcribed text — no commentary or preamble.";

const DEFAULT_OCR_PROMPT =
  "Transcribe every visible word, number, and label from this document into plain text. Preserve section headings and question numbering.";

type DocBytes = { bytes: Uint8Array; mime: string };

async function loadDocBytes(store: Store, docId: DocId): Promise<DocBytes | undefined> {
  const file = await originalDocFile(docId);
  if (file) return { bytes: new Uint8Array(readFileSync(file.path)), mime: file.mime };
  const meta = store.docs().find((d) => d.id === docId);
  if (meta?.type === "image") {
    throw new Error(
      `doc-to-text LLM: no image bytes for ${docId} — re-upload the file so the server can store the original`,
    );
  }
  return undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// AI : OpenRouter vision OCR — images, scanned PDFs, handwriting; text-only fallback when no bytes.
export async function docToTextViaLlm(
  store: Store,
  docId: DocId,
  purpose: string,
  userPrompt: string | undefined,
  ctx: CallContext,
  fallbackText: string,
  log: ServerLogger,
): Promise<string> {
  const prompt =
    userPrompt?.trim() ||
    `${DEFAULT_OCR_PROMPT}\n\nDocument purpose: ${purpose || "general transcription"}`;
  const llmCtx: CallContext = { ...ctx, system: OCR_SYSTEM, maxTokens: 16384 };

  const media = await loadDocBytes(store, docId);
  if (media) {
    const attachments: VisionAttachment[] = [
      { mime: media.mime, base64: bytesToBase64(media.bytes) },
    ];
    log.info(`doc-to-text LLM vision`, { docId, mime: media.mime, bytes: media.bytes.length });
    const text = (await llmVisionString(prompt, attachments, llmCtx, log)).trim();
    if (!text) throw new Error(`doc-to-text LLM returned empty text for ${docId}`);
    return text;
  }

  if (!fallbackText.trim()) {
    throw new Error(`doc-to-text LLM: no file bytes or text for ${docId}`);
  }
  log.info(`doc-to-text LLM text fallback`, { docId, chars: fallbackText.length });
  const textPrompt = `${prompt}\n\n── DOCUMENT TEXT ──\n${fallbackText}`;
  return (await llmVisionString(textPrompt, [], llmCtx, log)).trim();
}
