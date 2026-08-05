import { assertNever } from "@/lib/assert";
import { ModuleKind, type PipelineModule } from "../types";
import { isMergeModuleKind } from "@/lib/list-ops-steps";
import type { ExecResult, RunCtx, RunLogger } from "./engine_types";
import { execInputStep } from "./steps/input";
import { execLlmStep } from "./steps/llm";
import { execLlmBatchStep } from "./steps/llm_batch";
import { execExampleSelectStep } from "./steps/example_select";
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
    case ModuleKind.Input:
      return execInputStep(m, ctx, log);
    case ModuleKind.Llm:
      return execLlmStep(m, ctx, log);
    case ModuleKind.Combine:
      return execCombineStep(m, ctx, log);
    case ModuleKind.Transform:
      return execTransformStep(m, ctx, log);
    case ModuleKind.CustomCode:
    case ModuleKind.Chunk:
    case ModuleKind.Merge:
      return execCustomCodeStep(m, ctx, log);
    case ModuleKind.LlmBatch:
      return execLlmBatchStep(m, ctx, log);
    case ModuleKind.ExampleSelect:
      return execExampleSelectStep(m, ctx, log);
    case ModuleKind.Quote:
      return execQuoteStep(m, ctx, log);
    case ModuleKind.Output:
      return execOutputStep(m, ctx, log);
    case ModuleKind.Assert:
      return execAssertStep(m, ctx, log);
    case ModuleKind.HumanReview:
      return execHumanReviewStep(m, ctx, log);
    default: {
      if (isMergeModuleKind(m.kind)) return execCustomCodeStep(m, ctx, log);
      const unreachable: never = m.kind;
      return assertNever(unreachable, `unknown module kind: ${(m as PipelineModule).kind}`);
    }
  }
}
