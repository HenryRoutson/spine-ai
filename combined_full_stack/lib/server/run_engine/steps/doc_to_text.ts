import { docToTextViaLlm } from "../../doc_to_text";
import { documentContentFrom, documentFilenameFrom } from "../../document_value";
import { stepEmitsList } from "../../type_expr";
import { DEFAULT_VISION_DOC_PARSE_MODEL, inputUsesVisionOcr, type DocId, type PipelineModule } from "../../types";
import { jsonStringifyStepValue } from "../results";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

function asDocList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}
// AI : this step is UPDATE document SET content = ? WHERE id = ?; blob unchanged.

function precedingInputDocIds(m: PipelineModule, ctx: RunCtx): DocId[] {
  const modules = ctx.project.modules;
  const i = modules.findIndex((x) => x.id === m.id);
  for (let j = i - 1; j >= 0; j--) {
    const prev = modules[j];
    if (prev?.kind === "input") return ctx.inputByModule.get(prev.id) ?? [];
  }
  return [];
}

// AI : instantiate Document.content from store originals — never put encoded bytes on the spine.
// AI : TODO (media-view-D-stt) — audio-to-text (Whisper) fills content = transcript; optional word timings for seek.
export async function execDocToTextStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { store } = ctx;
  const incoming = ctx.prevModuleId ? ctx.outputs.get(ctx.prevModuleId) : undefined;
  const items = asDocList(incoming);
  const docIds = precedingInputDocIds(m, ctx);
  const ocr = inputUsesVisionOcr(m);
  if (ocr) ctx.stepLlmCalls = [];
  let lastOcr: { model: string; fromVisionCache: boolean } | undefined;

  const converted: { content: string; filename: string }[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const docId = docIds[i];
    const filename = documentFilenameFrom(item, { docId, docName: store.docs().find((d) => d.id === docId)?.name });
    const parserText = (docId ? store.docContent(docId) : undefined) ?? documentContentFrom(item, "");
    let content = parserText;
    if (ocr) {
      if (!docId) throw new Error(`convert to text: missing document id for "${filename}"`);
      const stepModel = m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
      const result = await docToTextViaLlm(
        store,
        docId,
        m.note ?? m.label,
        m.prompt,
        { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls },
        parserText,
        log.child("doc-to-text-ocr"),
      );
      content = result.text;
      lastOcr = { model: result.model, fromVisionCache: result.fromVisionCache };
    }
    if (!content.trim()) {
      throw new Error(`convert to text: no text for "${filename}" — enable OCR for scans, or re-upload a text-extractable file`);
    }
    if (i === 0) {
      ctx.sourceText = content;
      if (docId) ctx.sourceDocId = docId;
    }
    converted.push({ content, filename });
  }

  const value = stepEmitsList(m) || converted.length > 1 ? converted : converted[0]!;
  ctx.outputs.set(m.id, value);
  const mode = ocr
    ? `OCR · ${lastOcr?.model ?? m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL}${lastOcr?.fromVisionCache ? " · cached" : ""}`
    : "parser";
  return {
    value,
    preview: `convert to text · ${converted.length} doc(s) · ${mode}`,
    json: jsonStringifyStepValue(value),
    docId: docIds[0],
    inputPreview: mode,
    llmCalls: ocr ? ctx.stepLlmCalls : undefined,
  };
}
