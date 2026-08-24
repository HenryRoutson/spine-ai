// AI : client-safe import strings only — disk copy lives in pipeline_export_runtime_files.ts.

type RuntimeImportNeeds = {
  llm: boolean;
  llmBatch: boolean;
  exampleSelect: boolean;
  merge: boolean;
  quote: boolean;
  humanReview: boolean;
  chatbot: boolean;
  webhook: boolean;
  n8n?: boolean;
  visionOcr: boolean;
  docToText: boolean;
};

function unique(names: string[]): string[] {
  return [...new Set(names)];
}

export function exportRuntimeImportTs(needs: RuntimeImportNeeds): string {
  const value: string[] = [];
  if (needs.llm || needs.visionOcr) value.push("llmStructured");
  if (needs.llmBatch) value.push("llmBatchStructured");
  if (needs.exampleSelect) value.push("selectRelevant", "exampleSelectItems");
  if (needs.merge) value.push("mergeFold");
  if (needs.visionOcr) value.push("visionOcr");
  if (needs.docToText) value.push("convertDocToText");
  if (needs.quote) value.push("resolveQuotes");
  if (needs.humanReview) value.push("waitForHumanReview");
  if (needs.chatbot) value.push("waitForChatbotSession");
  if (needs.webhook) value.push("callWebhook");
  if (needs.n8n) value.push("runN8nCode");
  const types: string[] = [];
  if (needs.chatbot) types.push("ChatbotPrompt");
  const lines = [
    'export { configurePipelineRuntime, registerCustomLlmProvider, getLlmProvider } from "./pipeline_runtime";',
  ];
  if (types.length) {
    lines.push(`import type { ${types.join(", ")} } from "./pipeline_runtime";`);
  }
  if (value.length) {
    lines.push(`import {\n  ${unique(value).join(",\n  ")},\n} from "./pipeline_runtime";`);
  }
  return lines.join("\n");
}

export function exportRuntimeImportPy(needs: RuntimeImportNeeds): string {
  const names = ["configure_pipeline_runtime"];
  if (needs.llm || needs.visionOcr) names.push("llm_structured");
  if (needs.llmBatch) names.push("llm_batch_structured");
  if (needs.exampleSelect) names.push("select_relevant", "example_select_items");
  if (needs.merge) names.push("merge_fold");
  if (needs.visionOcr) names.push("vision_ocr");
  if (needs.docToText) names.push("convert_doc_to_text");
  if (needs.quote) names.push("resolve_quotes");
  if (needs.humanReview) names.push("wait_for_human_review");
  if (needs.chatbot) names.push("wait_for_chatbot_session");
  if (needs.webhook) names.push("call_webhook");
  return `from pipeline_runtime import (\n    ${unique(names).join(",\n    ")},\n)`;
}

export function exportRuntimePreambleRust(): string {
  return ["mod pipeline_runtime;", "use pipeline_runtime::*;", ""].join("\n");
}
