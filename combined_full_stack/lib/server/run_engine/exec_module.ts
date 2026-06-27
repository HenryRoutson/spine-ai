import type { PipelineModule } from "../types";
import type { ExecResult, RunCtx, RunLogger } from "./engine_types";
import { execInputStep } from "./steps/input";
import { execLlmStep } from "./steps/llm";
import { execLlmBatchStep } from "./steps/llm_batch";
import {
  execAssertStep,
  execCombineStep,
  execCustomCodeStep,
  execHumanReviewStep,
  execOutputStep,
  execQuoteStep,
  execTransformStep,
} from "./steps/misc";

export async function execModule(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  log.debug(`execModule start`, { moduleId: m.id, kind: m.kind, label: m.label });
  switch (m.kind) {
    case "input":
      return execInputStep(m, ctx, log);
    case "llm":
      return execLlmStep(m, ctx, log);
    case "combine":
      return execCombineStep(m, ctx, log);
    case "transform":
      return execTransformStep(m, ctx, log);
    case "custom-code":
      return execCustomCodeStep(m, ctx, log);
    case "llm-batch":
      return execLlmBatchStep(m, ctx, log);
    case "quote":
      return execQuoteStep(m, ctx, log);
    case "output":
      return execOutputStep(m, ctx, log);
    case "assert":
      return execAssertStep(m, ctx, log);
    case "human-review":
      return execHumanReviewStep(m, ctx, log);
  }
}
