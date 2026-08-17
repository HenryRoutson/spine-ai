import {
  inputMinCountForModule,
  inputModuleNeedsDocToText,
  inputTypeLabel,
  isMultiDocInputModule,
} from "../../../inference-input";
import { stepEmitsList } from "../../type_expr";
import { materializeInputDocument, pushMaterializedInput, wrapListForOutputStructure } from "../../structure";
import type { DocId, PipelineModule } from "../../types";
import { materializeHints, modelById } from "../helpers";
import { jsonStringifyStepValue } from "../results";
import type { ExecResult, RunCtx, RunLogger } from "../engine_types";

export async function execInputStep(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  const { project, store } = ctx;
  const docIds = ctx.inputByModule.get(m.id) ?? [];
  const min = inputMinCountForModule(m);
  if (docIds.length < min) {
    throw new Error(`input "${m.label}" needs at least ${min} document(s), got ${docIds.length}`);
  }
  const multi = isMultiDocInputModule(m) || docIds.length > 1;
  const pendingText = inputModuleNeedsDocToText(m);
  log.info(`input module loaded doc(s)`, { moduleId: m.id, docCount: docIds.length, multi, pendingText });

  const materializeDoc = async (docId: DocId, first: boolean) => {
    const content = store.docContent(docId) ?? "";
    if (first && !ctx.sourceText && !pendingText) {
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
      preview: pendingText
        ? `bound ${inputTypeLabel(m.inputType)} → ${docId} · text pending convert`
        : `loaded ${inputTypeLabel(m.inputType)} → ${docId}`,
      json: jsonStringifyStepValue(value),
      docId,
    };
  }
  const items = [];
  const inputPreviewItems: { label: string; text: string }[] = [];
  for (let i = 0; i < docIds.length; i++) {
    const docId = docIds[i]!;
    pushMaterializedInput(items, await materializeDoc(docId, i === 0), stepEmitsList(m));
    const docName = store.docs().find((d) => d.id === docId)?.name ?? docId;
    inputPreviewItems.push({
      label: `${docName} (${i + 1}/${docIds.length})`,
      text: `${inputTypeLabel(m.inputType)} · ${docId}`,
    });
  }
  const out = modelById(project.models, m.outStructureId);
  const value =
    stepEmitsList(m) || !out
      ? items
      : wrapListForOutputStructure(items, out, m.outStructureId);
  ctx.outputs.set(m.id, value);
  return {
    value,
    preview: pendingText
      ? `bound ${docIds.length} ${inputTypeLabel(m.inputType)} doc(s) · text pending convert`
      : `loaded ${docIds.length} ${inputTypeLabel(m.inputType)} doc(s)`,
    json: jsonStringifyStepValue(value),
    docId: docIds[0],
    inputPreview: `${docIds.length} documents · browse with ◀ ▶`,
    inputPreviewItems,
  };
}
