import { z } from "zod";
import { type VisionAttachment } from "./openrouter_llm";
import { llmStructured, llmVisionString, type CallContext } from "./llm";
import { structuredLlmPrompt } from "./structure";
import { type Store } from "./store";
import { DEFAULT_INPUT_CHECK_MODEL, type DocId, type PipelineModule } from "./types";
import { type ServerLogger } from "./server_logger";
import { loadDocBytesForVision } from "./doc_to_text";

const matchSchema = z.object({
  matches: z.boolean(),
  reason: z.string(),
});

const CHECK_SYSTEM =
  "You judge whether data about to enter a pipeline step matches a required description. Be strict but reasonable — the input should clearly fit the described type, format, or content.";

const INPUT_PREVIEW_CHARS = 80_000;
const MIN_TEXT_CHARS = 80;

function parseMatchReply(raw: string): z.infer<typeof matchSchema> {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  const json = start !== -1 && end > start ? body.slice(start, end + 1) : body;
  const parsed = matchSchema.safeParse(JSON.parse(json));
  if (!parsed.success) throw new Error(`input description check returned invalid JSON: ${parsed.error.message}`);
  return parsed.data;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// AI : per-step toggle — default on when a description is set.
export function shouldCheckInputDescription(
  m: Pick<PipelineModule, "inputDescription" | "checkInputDescription">,
): boolean {
  if (!m.inputDescription?.trim()) return false;
  return m.checkInputDescription !== false;
}

function extractBodyText(value: unknown): string {
  const parts: string[] = [];
  const walk = (v: unknown) => {
    if (v == null) return;
    if (typeof v === "string") {
      if (v.length > 40) parts.push(v);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (typeof v === "object") {
      const rec = v as Record<string, unknown>;
      if (typeof rec.content === "string" && rec.content.trim()) parts.push(rec.content);
      if (typeof rec.body === "string" && rec.body.trim()) parts.push(rec.body);
      Object.values(rec).forEach(walk);
    }
  };
  walk(value);
  return parts.join("\n\n");
}

function buildCheckPrompt(stepLabel: string, description: string, docName?: string): string {
  const base = `Step: ${stepLabel}\nRequired input description:\n${description}`;
  const nameLine = docName ? `\nSource filename: ${docName}` : "";
  return `${base}${nameLine}\n\nDoes this step input match the description?`;
}

// AI : optional per-step guard — cheap Gemini Flash-Lite judges incoming data before processing.
export async function assertInputMatchesDescription(
  stepLabel: string,
  description: string,
  value: unknown,
  ctx: CallContext,
  log: ServerLogger,
  vision?: { store: Store; docId: DocId; docName: string },
): Promise<void> {
  const desc = description.trim();
  if (!desc) return;

  const llmCtx: CallContext = {
    ...ctx,
    model: DEFAULT_INPUT_CHECK_MODEL,
    system: CHECK_SYSTEM,
    maxTokens: 512,
  };

  const bodyText = extractBodyText(value).trim();
  const json = JSON.stringify(value, null, 2);
  const textPayload = (bodyText.length >= MIN_TEXT_CHARS ? bodyText : json).slice(0, INPUT_PREVIEW_CHARS);

  let result: z.infer<typeof matchSchema>;

  if (textPayload.length >= MIN_TEXT_CHARS) {
    const userPrompt = `${buildCheckPrompt(stepLabel, desc, vision?.docName)}\n\n── STEP INPUT ──\n${textPayload}`;
    log.info(`input description check (text)`, { stepLabel, model: DEFAULT_INPUT_CHECK_MODEL, previewChars: textPayload.length });
    result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as z.infer<typeof matchSchema>;
  } else if (vision) {
    const media = await loadDocBytesForVision(vision.store, vision.docId);
    if (!media) {
      throw new Error(
        `step "${stepLabel}" input has too little text to verify against the required description — enable OCR or re-upload the original file`,
      );
    }
    const attachments: VisionAttachment[] = [{ mime: media.mime, base64: bytesToBase64(media.bytes) }];
    const userPrompt = structuredLlmPrompt(buildCheckPrompt(stepLabel, desc, vision.docName), matchSchema);
    log.info(`input description check (vision)`, {
      stepLabel,
      model: DEFAULT_INPUT_CHECK_MODEL,
      docName: vision.docName,
      mime: media.mime,
    });
    const raw = await llmVisionString(userPrompt, attachments, llmCtx, log);
    result = parseMatchReply(raw);
  } else {
    const userPrompt = `${buildCheckPrompt(stepLabel, desc)}\n\n── STEP INPUT ──\n${textPayload || "(empty)"}`;
    log.info(`input description check (short)`, { stepLabel, model: DEFAULT_INPUT_CHECK_MODEL });
    result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as z.infer<typeof matchSchema>;
  }

  if (!result.matches) {
    const why = result.reason.trim() || "input does not match the required description";
    throw new Error(`step "${stepLabel}" input rejected: ${why}`);
  }
  log.info(`input description check passed`, { stepLabel });
}
