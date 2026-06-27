import { z } from "zod";
import { type VisionAttachment } from "./openrouter_llm";
import { llmStructured, llmVisionString, type CallContext } from "./llm";
import { structuredLlmPrompt } from "./structure";
import { type Store } from "./store";
import { DEFAULT_INPUT_CHECK_MODEL, type DocId, type InputDescriptionCheckItem, type InputDescriptionCheckResult, type PipelineModule } from "./types";
import { type ServerLogger } from "./server_logger";
import { loadDocBytesForVision } from "./doc_to_text";

const matchSchema = z.object({
  matches: z.boolean(),
  reason: z.string(),
});

export type InputDescriptionCheckListItem = {
  value: unknown;
  vision?: { store: Store; docId: DocId; docName: string };
  label?: string;
};

export class InputDescriptionRejectedError extends Error {
  readonly check: InputDescriptionCheckResult;
  readonly requiredDescription: string;

  constructor(stepLabel: string, check: InputDescriptionCheckResult, requiredDescription: string) {
    const why = check.reason.trim() || "input does not match the required description";
    super(`step "${stepLabel}" input rejected: ${why}`);
    this.name = "InputDescriptionRejectedError";
    this.check = check;
    this.requiredDescription = requiredDescription;
  }
}

const CHECK_SYSTEM =
  "You judge whether data about to enter a pipeline step matches a required description. Be strict but reasonable — the input should clearly fit the described type, format, or content. When the input is JSON, judge the object shape and field names; nested string fields (e.g. question prompts inside a rubric schema) are expected and do not make the input unstructured prose. Combine-step payloads may include newDocument (the uploaded file) and pipelineState (upstream structured data) — judge both parts against the description. When checking a single list item, only that item is shown — do not expect other list members in the same payload.";

const INPUT_PREVIEW_CHARS = 80_000;
const MIN_TEXT_CHARS = 80;

// AI : structured pipeline values (MarkingSchema, lists of model rows) — check JSON shape, not nested prose.
function preferJsonPayload(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    const first = value[0];
    return !!first && typeof first === "object" && !Array.isArray(first) && !isDocumentLike(first);
  }
  return !isDocumentLike(value);
}

// AI : Document upload — long prose in content/body; structured models use typed top-level fields instead.
function isDocumentLike(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  const prose =
    (typeof rec.content === "string" && rec.content.trim()) ||
    (typeof rec.body === "string" && rec.body.trim());
  if (!prose) return false;
  const structuredKeys = [
    "sections",
    "questions",
    "marking_questions",
    "rules",
    "items",
    "records",
    "rows",
    "student_submissions",
    "marking_schema",
  ];
  return !structuredKeys.some((k) => k in rec);
}

function checkPayload(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  if (preferJsonPayload(value)) return json.slice(0, INPUT_PREVIEW_CHARS);
  const bodyText = extractBodyText(value).trim();
  if (bodyText.length >= MIN_TEXT_CHARS) return bodyText.slice(0, INPUT_PREVIEW_CHARS);
  return json.slice(0, INPUT_PREVIEW_CHARS);
}

function parseMatchReply(raw: string): InputDescriptionCheckResult {
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

// AI : optional per-step guard — cheap LLM judges incoming data before processing.
export async function runInputDescriptionCheck(
  stepLabel: string,
  description: string,
  value: unknown,
  ctx: CallContext,
  log: ServerLogger,
  vision?: { store: Store; docId: DocId; docName: string },
): Promise<InputDescriptionCheckResult> {
  const desc = description.trim();
  if (!desc) return { matches: true, reason: "no description configured" };

  const llmCtx: CallContext = {
    ...ctx,
    model: DEFAULT_INPUT_CHECK_MODEL,
    system: CHECK_SYSTEM,
    maxTokens: 512,
  };

  const bodyText = extractBodyText(value).trim();
  const textPayload = checkPayload(value);
  const mode = preferJsonPayload(value) ? "json" : bodyText.length >= MIN_TEXT_CHARS ? "text" : "json";

  let result: InputDescriptionCheckResult;

  if (textPayload.length >= MIN_TEXT_CHARS) {
    const userPrompt = `${buildCheckPrompt(stepLabel, desc, vision?.docName)}\n\n── STEP INPUT (${mode}) ──\n${textPayload}`;
    log.info(`input description check (${mode})`, { stepLabel, model: DEFAULT_INPUT_CHECK_MODEL, previewChars: textPayload.length });
    result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as InputDescriptionCheckResult;
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
    result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as InputDescriptionCheckResult;
  }

  if (!result.matches) {
    const reason = result.reason.trim() || "input does not match the required description";
    log.warn(`input description check failed`, {
      matches: false,
      reason,
      stepLabel,
      requiredDescription: desc,
    });
    return { matches: false, reason };
  }

  log.info(`input description check passed`, { stepLabel, matches: true, reason: result.reason.trim() || "ok" });
  return { matches: true, reason: result.reason.trim() || "ok" };
}

export async function assertInputMatchesDescription(
  stepLabel: string,
  description: string,
  value: unknown,
  ctx: CallContext,
  log: ServerLogger,
  vision?: { store: Store; docId: DocId; docName: string },
  listItems?: InputDescriptionCheckListItem[],
): Promise<InputDescriptionCheckResult> {
  const desc = description.trim();
  if (!desc) return { matches: true, reason: "no description configured" };

  if (listItems && listItems.length > 1) {
    const items: InputDescriptionCheckItem[] = [];
    for (let i = 0; i < listItems.length; i++) {
      const item = listItems[i]!;
      const label = item.label ?? `item ${i + 1}`;
      const result = await runInputDescriptionCheck(
        `${stepLabel} (${label})`,
        desc,
        item.value,
        ctx,
        log.child(`item-${i + 1}`),
        item.vision ?? vision,
      );
      items.push({ matches: result.matches, reason: result.reason, label });
      if (!result.matches) {
        const why = result.reason.trim() || "does not match the required description";
        return { matches: false, reason: `${label}: ${why}`, items };
      }
    }
    return { matches: true, reason: `${items.length}/${items.length} items match`, items };
  }

  const result = await runInputDescriptionCheck(stepLabel, desc, value, ctx, log, vision);
  if (!result.matches) throw new InputDescriptionRejectedError(stepLabel, result, desc);
  return result;
}
