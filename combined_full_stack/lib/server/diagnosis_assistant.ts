// AI : stream diagnosis LLM — scoped to run error context + pipeline at run time.

import { llmStreamString } from "./llm";
import { UsageLedger } from "./usage";
import { buildDiagnosisSystemPrompt, buildDiagnosisUserPrompt } from "@/lib/diagnosis-prompt";
import { diagnosisForMissingSecrets } from "@/lib/diagnosis-missing-secret";
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
  const canned = diagnosisForMissingSecrets(project, run);
  if (canned) {
    onDelta(canned);
    return { text: canned, usageCents: 0 };
  }
  const ledger = new UsageLedger();
  const text = await llmStreamString(
    buildDiagnosisUserPrompt(project, run, message),
    { model: globalModel, ledger, system: buildDiagnosisSystemPrompt() },
    onDelta,
  );
  return { text, usageCents: +ledger.totalCents().toFixed(4) };
}
