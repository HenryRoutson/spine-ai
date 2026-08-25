import { z } from "zod";
import { type VisionAttachment } from "./openrouter_llm";
import { llmStructured, llmVisionString, type CallContext } from "./llm";
import { structuredLlmPrompt } from "./structure";
import { type Store } from "./store";
import { DEFAULT_INPUT_CHECK_MODEL, DEFAULT_VISION_DOC_PARSE_MODEL, InputType, type DocId, type InputDescriptionCheckItem, type InputDescriptionCheckResult, type PipelineModule } from "./types";
import { type ServerLogger } from "./server_logger";
import { loadDocBytesForVision, mimeIsVisionAttachment } from "./doc_to_text";
import {
  checkPayload,
  expandListItemsForCheck,
  INPUT_PREVIEW_CHARS,
  inputCheckPayloadMode,
  MIN_INPUT_TEXT_CHARS,
  type InputDescriptionCheckListItem,
} from "./input_description_payload";

export type { InputDescriptionCheckListItem } from "./input_description_payload";

const matchSchema = z.object({
  matches: z.boolean(),
  reason: z.string(),
});

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
  "You judge whether data about to enter a pipeline step matches a required description. Be strict but reasonable — the input should clearly fit the described type, format, or content. When the input is JSON, judge the object shape and field names; nested string fields are expected and do not make the input unstructured prose. Combine-step payloads may include newDocument (the uploaded file) and pipelineState (upstream structured data) — judge both parts against the description. When checking a single list item, only that item is shown — do not expect other list members in the same payload; plural wording in the description still applies to each item individually. Uploaded files are often wrapped as { filename, content } or raw text — judge the file content, not the wrapper. Structured model rows may include long text in body or feedback fields — that prose is expected, not a sign the row is a raw upload. IMPORTANT: For steps whose label or description suggests they PRODUCE an output format (e.g. Export CSV, Generate Report, Format PDF, Write Summary) the input is the raw structured data to be converted — accept it if it contains appropriate underlying content for the described output, even if the input is JSON rather than the final output format. Set matches=true when the input clearly fits the description.";

const STOPWORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "have",
  "will",
  "into",
  "about",
  "each",
  "when",
  "does",
  "step",
  "input",
  "data",
  "json",
  "list",
  "object",
  "type",
  "text",
  "file",
  "field",
  "fields",
  "match",
  "matches",
  "required",
  "description",
]);

// AI : steps whose label implies they produce an output format — the input is always raw data to convert.
const OUTPUT_PRODUCING_STEP_RE = /\b(export|generate|format|write|create|produce|build|render|output)\b/i;

function isOutputProducingStep(label: string): boolean {
  return OUTPUT_PRODUCING_STEP_RE.test(label);
}

// AI : LLM sometimes rejects while its reason affirms the described type — treat as pass.
function rejectionContradictsDescription(reason: string, description: string): boolean {
  const r = reason.toLowerCase();
  const affirm =
    /\b(is|are|appears to be|looks like|this is|these are|indeed|clearly|valid|contains|includes)\b/.test(r);
  if (!affirm) return false;

  const terms = (text: string) =>
    text
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  const descTerms = [...new Set(terms(description.toLowerCase()))];
  if (!descTerms.length) return false;

  const overlap = terms(r).filter((w) => descTerms.includes(w));
  return overlap.length >= 2 || (overlap.length >= 1 && descTerms.length <= 4);
}

// AI : when the step label implies output production and rejection only complains about format mismatch
// (e.g. "it's JSON not a CSV"), treat as a false rejection — the input is raw data to convert.
function isFormatOnlyRejection(stepLabel: string, reason: string): boolean {
  if (!isOutputProducingStep(stepLabel)) return false;
  const r = reason.toLowerCase();
  return /\bjson\b/.test(r) && /\b(not a?|instead of|rather than)\b/.test(r) && !/\b(missing|wrong|invalid|incorrect|unrelated|empty)\b/.test(r);
}

function buildCheckPrompt(
  stepLabel: string,
  description: string,
  docName?: string,
  oneListItem?: boolean,
): string {
  const base = `Step: ${stepLabel}\nRequired input description:\n${description}`;
  const nameLine = docName ? `\nSource filename: ${docName}` : "";
  const listLine = oneListItem
    ? "\nNote: you are checking ONE element from a list — plural wording in the description still applies to this single item."
    : "";
  // AI : when the step label implies output production, remind the checker that the input is raw data — not the final format.
  const exportLine = isOutputProducingStep(stepLabel)
    ? "\nIMPORTANT: This step PRODUCES the described format — its INPUT is raw structured data (e.g. JSON) to be converted. Accept any input whose content is appropriate for the described output, even if the input is JSON rather than the final format."
    : "";
  return `${base}${nameLine}${listLine}${exportLine}\n\nDoes this step input match the description?`;
}

function parseMatchReply(raw: string): InputDescriptionCheckResult {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[{[]/);
  const end = Math.max(body.lastIndexOf("}"), body.lastIndexOf("]"));
  const json = start !== -1 && end > start ? body.slice(start, end + 1) : body;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`input description check returned non-JSON: ${raw.slice(0, 200)}`);
  }
  const result = matchSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`input description check returned invalid JSON: ${result.error.message}`);
  }
  return result.data;
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// AI : per-step toggle — default on when a description is set. JSON/Excel parse structurally.
export function shouldCheckInputDescription(
  m: Pick<PipelineModule, "kind" | "inputType" | "inputDescription" | "checkInputDescription">,
): boolean {
  if (!m.inputDescription?.trim()) return false;
  if (m.checkInputDescription === false) return false
  // AI : n8n pieces run local Code-node JS — typed I/O already validates; skip the LLM gate.
  if (m.kind === "n8n") return false;
  if (m.kind === "connect") return false;
  if (m.kind === "input") {
    const types = !m.inputType ? [] : Array.isArray(m.inputType) ? m.inputType : [m.inputType];
    if (types.length > 0 && types.every((t) => t === InputType.Json || t === InputType.Excel)) return false;
  }
  return true;
}

// AI : optional per-step guard — cheap LLM judges incoming data before processing.
export async function runInputDescriptionCheck(
  stepLabel: string,
  description: string,
  value: unknown,
  ctx: CallContext,
  log: ServerLogger,
  vision?: { store: Store; docId: DocId; docName: string },
  oneListItem?: boolean,
): Promise<InputDescriptionCheckResult> {
  const desc = description.trim();
  if (!desc) return { matches: true, reason: "no description configured" };

  const llmCtx: CallContext = {
    ...ctx,
    model: DEFAULT_INPUT_CHECK_MODEL,
    system: CHECK_SYSTEM,
    maxTokens: 512,
  };

  const textPayload = checkPayload(value);
  const mode = inputCheckPayloadMode(value);

  let result: InputDescriptionCheckResult;

  if (textPayload.length >= MIN_INPUT_TEXT_CHARS) {
    const userPrompt = `${buildCheckPrompt(stepLabel, desc, vision?.docName, oneListItem)}\n\n── STEP INPUT (${mode}) ──\n${textPayload}`;
    log.info(`input description check (${mode})`, { stepLabel, model: DEFAULT_INPUT_CHECK_MODEL, previewChars: textPayload.length, oneListItem: !!oneListItem });
    result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as InputDescriptionCheckResult;
  } else if (vision) {
    const media = await loadDocBytesForVision(vision.store, vision.docId);
    if (media && mimeIsVisionAttachment(media.mime)) {
      const attachments: VisionAttachment[] = [{ mime: media.mime, base64: bytesToBase64(media.bytes) }];
      const visionCtx: CallContext = { ...llmCtx, model: DEFAULT_VISION_DOC_PARSE_MODEL };
      const userPrompt = structuredLlmPrompt(buildCheckPrompt(stepLabel, desc, vision.docName, oneListItem), matchSchema);
      log.info(`input description check (vision)`, {
        stepLabel,
        model: DEFAULT_VISION_DOC_PARSE_MODEL,
        docName: vision.docName,
        mime: media.mime,
      });
      const raw = await llmVisionString(userPrompt, attachments, visionCtx, log);
      result = parseMatchReply(raw);
    } else {
      const decoded = media ? new TextDecoder().decode(media.bytes).trim() : "";
      const payload = (decoded.length >= MIN_INPUT_TEXT_CHARS ? decoded.slice(0, INPUT_PREVIEW_CHARS) : textPayload || decoded || "(empty)");
      const userPrompt = `${buildCheckPrompt(stepLabel, desc, vision.docName, oneListItem)}\n\n── STEP INPUT ──\n${payload}`;
      log.info(`input description check (text fallback)`, {
        stepLabel,
        model: DEFAULT_INPUT_CHECK_MODEL,
        docName: vision.docName,
        payloadChars: payload.length,
      });
      result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as InputDescriptionCheckResult;
    }
  } else {
    const userPrompt = `${buildCheckPrompt(stepLabel, desc, undefined, oneListItem)}\n\n── STEP INPUT ──\n${textPayload || "(empty)"}`;
    log.info(`input description check (short)`, { stepLabel, model: DEFAULT_INPUT_CHECK_MODEL, oneListItem: !!oneListItem });
    result = (await llmStructured(userPrompt, matchSchema, llmCtx, log)) as InputDescriptionCheckResult;
  }

  if (!result.matches) {
    const reason = result.reason.trim() || "input does not match the required description";
    if (rejectionContradictsDescription(reason, desc) || isFormatOnlyRejection(stepLabel, reason)) {
      log.info(`input description check override`, { stepLabel, reason, requiredDescription: desc });
      return { matches: true, reason: `accepted: ${reason}` };
    }
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

  const expanded = expandListItemsForCheck(value, listItems);
  if (expanded && expanded.length > 1) {
    const items: InputDescriptionCheckItem[] = [];
    for (let i = 0; i < expanded.length; i++) {
      const item = expanded[i]!;
      const label = item.label ?? `item ${i + 1}`;
      log.info(`input description check (list item)`, {
        stepLabel,
        index: i + 1,
        total: expanded.length,
        label,
      });
      const result = await runInputDescriptionCheck(
        `${stepLabel} (${label})`,
        desc,
        item.value,
        ctx,
        log.child(`item-${i + 1}`),
        item.vision ?? vision,
        true,
      );
      items.push({ matches: result.matches, reason: result.reason, label });
      if (!result.matches) {
        const why = result.reason.trim() || "does not match the required description";
        const check = { matches: false as const, reason: `${label}: ${why}`, items };
        throw new InputDescriptionRejectedError(stepLabel, check, desc);
      }
    }
    return { matches: true, reason: `${items.length}/${items.length} items match`, items };
  }

  const result = await runInputDescriptionCheck(stepLabel, desc, value, ctx, log, vision);
  if (!result.matches) throw new InputDescriptionRejectedError(stepLabel, result, desc);
  return result;
}
