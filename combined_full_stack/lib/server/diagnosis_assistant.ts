// AI : stream diagnosis LLM — scoped to run error context + pipeline at run time.

import { llmStreamString } from "./llm";
import { UsageLedger } from "./usage";
import { buildDiagnosisSystemPrompt, buildDiagnosisUserPrompt } from "@/lib/diagnosis-prompt";
import { DIAGNOSIS_STREAM_EVENT } from "@/lib/diagnosis-stream-events";
import type { ModelId, PipelineRun, Project } from "./types";

export { DIAGNOSIS_STREAM_EVENT } from "@/lib/diagnosis-stream-events";

export async function diagnoseRunStream(
  project: Project,
  run: PipelineRun,
  message: string,
  globalModel: ModelId,
  onDelta: (delta: string) => void,
): Promise<{ text: string; usageCents: number }> {
  const ledger = new UsageLedger();
  const text = await llmStreamString(
    buildDiagnosisUserPrompt(project, run, message),
    { model: globalModel, ledger, system: buildDiagnosisSystemPrompt() },
    onDelta,
  );
  return { text, usageCents: +ledger.totalCents().toFixed(4) };
}
