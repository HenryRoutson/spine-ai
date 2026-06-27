import {
  inputMinCountForModule,
  inputTypeLabel,
  isMultiDocInputModule,
} from "../../../inference-input";
import { docToTextViaLlm } from "../../doc_to_text";
import { materializeInputDocument, wrapListForOutputStructure } from "../../structure";
import { DEFAULT_VISION_DOC_PARSE_MODEL, inputUsesVisionOcr, type DocId, type PipelineModule } from "../../types";
import { materializeHints, modelById } from "../helpers";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execInputStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project, store } = ctx;
  const docIds = ctx.inputByModule.get(m.id) ?? [];
  const min = inputMinCountForModule(m);
  if (docIds.length < min) {
    throw new Error(`input "${m.label}" needs at least ${min} document(s), got ${docIds.length}`);
  }
  const multi = isMultiDocInputModule(m) || docIds.length > 1;
  log.info(`input module loaded doc(s)`, { moduleId: m.id, docCount: docIds.length, multi, useOcr: inputUsesVisionOcr(m) });
  if (inputUsesVisionOcr(m)) ctx.stepLlmCalls = [];
  let lastOcr: { model: string; fromVisionCache: boolean } | undefined;

  const materializeDoc = async (docId: DocId, first: boolean) => {
    let content = store.docContent(docId) ?? "";
    if (inputUsesVisionOcr(m)) {
      const stepModel = m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL;
      const ocr = await docToTextViaLlm(
        store,
        docId,
        m.note ?? m.label,
        m.prompt,
        { model: stepModel, ledger: ctx.ledger, llmCalls: ctx.stepLlmCalls },
        content,
        log.child("input-ocr"),
      );
      content = ocr.text;
      lastOcr = { model: ocr.model, fromVisionCache: ocr.fromVisionCache };
    }
    if (first && !ctx.sourceText) {
      ctx.sourceText = content;
      ctx.sourceDocId = docId;
    }
    const docName = store.docs().find((d) => d.id === docId)?.name;
    const hints = { ...materializeHints(m, ctx, docId, content), docName };
    return materializeInputDocument(content, docId, m, project.models, hints);
  };

  if (!multi) {
    const docId = docIds[0]!;
    const value = await materializeDoc(docId, true);
    ctx.outputs.set(m.id, value);
    return {
      value,
      preview: `loaded ${inputTypeLabel(m.inputType)} → ${docId}${inputUsesVisionOcr(m) ? " · OCR" : ""}`,
      docId,
      inputPreview: inputUsesVisionOcr(m)
        ? `vision OCR · ${lastOcr?.model ?? m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL}${lastOcr?.fromVisionCache ? " · cached" : ""}`
        : undefined,
      llmCalls: inputUsesVisionOcr(m) ? ctx.stepLlmCalls : undefined,
    };
  }
  const items = [];
  for (let i = 0; i < docIds.length; i++) {
    items.push(await materializeDoc(docIds[i]!, i === 0));
  }
  const out = modelById(project.models, m.outStructureId);
  const value =
    m.outIsList || !out
      ? items
      : wrapListForOutputStructure(items, out, m.outStructureId);
  ctx.outputs.set(m.id, value);
  return {
    value,
    preview: `loaded ${docIds.length} ${inputTypeLabel(m.inputType)} doc(s)${inputUsesVisionOcr(m) ? " · OCR" : ""}`,
    docId: docIds[0],
    json: JSON.stringify({ doc_ids: docIds }, null, 2),
    inputPreview: inputUsesVisionOcr(m)
      ? `vision OCR · ${lastOcr?.model ?? m.model ?? DEFAULT_VISION_DOC_PARSE_MODEL}${lastOcr?.fromVisionCache ? " · cached" : ""}`
      : undefined,
    llmCalls: inputUsesVisionOcr(m) ? ctx.stepLlmCalls : undefined,
  };
}
