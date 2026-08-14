import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { PipelineSetupFile } from "./pipeline_export_shared";

type RuntimeImportNeeds = {
  llm: boolean;
  llmBatch: boolean;
  exampleSelect: boolean;
  merge: boolean;
  quote: boolean;
  humanReview: boolean;
  chatbot: boolean;
  webhook: boolean;
  visionOcr: boolean;
};

const RUNTIME_DIR = join(dirname(fileURLToPath(import.meta.url)), "../export_runtime");

function readRuntime(rel: string): string {
  return readFileSync(join(RUNTIME_DIR, rel), "utf8");
}

// AI : hand-written libraries copied into the export zip — do not string-generate these.
export function exportRuntimeLibraryFiles(): PipelineSetupFile[] {
  return [
    { filename: "pipeline_runtime.ts", content: readRuntime("ts/pipeline_runtime.ts"), mime: "text/typescript" },
    { filename: "pipeline_runtime.py", content: readRuntime("py/pipeline_runtime.py"), mime: "text/x-python" },
    { filename: "pipeline_runtime.go", content: readRuntime("go/pipeline_runtime.go"), mime: "text/x-go" },
    { filename: "pipeline_runtime.rs", content: readRuntime("rs/pipeline_runtime.rs"), mime: "text/x-rust" },
  ];
}

export function exportRuntimeTsPath(): string {
  return join(RUNTIME_DIR, "ts/pipeline_runtime.ts");
}

function unique(names: string[]): string[] {
  return [...new Set(names)];
}

export function exportRuntimeImportTs(needs: RuntimeImportNeeds): string {
  const value: string[] = [];
  if (needs.llm || needs.visionOcr) value.push("llmStructured");
  if (needs.llmBatch) value.push("llmBatchStructured");
  if (needs.exampleSelect) value.push("selectRelevant");
  if (needs.merge) value.push("mergeFold");
  if (needs.visionOcr) value.push("visionOcr");
  if (needs.quote) value.push("resolveQuotes");
  if (needs.humanReview) value.push("waitForHumanReview");
  if (needs.chatbot) value.push("waitForChatbotSession");
  if (needs.webhook) value.push("callWebhook");
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
  if (needs.exampleSelect) names.push("select_relevant");
  if (needs.merge) names.push("merge_fold");
  if (needs.visionOcr) names.push("vision_ocr");
  if (needs.quote) names.push("resolve_quotes");
  if (needs.humanReview) names.push("wait_for_human_review");
  if (needs.chatbot) names.push("wait_for_chatbot_session");
  if (needs.webhook) names.push("call_webhook");
  return `from pipeline_runtime import (\n    ${unique(names).join(",\n    ")},\n)`;
}

export function exportRuntimePreambleRust(): string {
  return ["mod pipeline_runtime;", "use pipeline_runtime::*;", ""].join("\n");
}
