import { assertNever } from "@/lib/assert";
import { ModuleKind, type PipelineModule } from "../types";
import { isMergeModuleKind } from "@/lib/module-kinds";
import type { ExecResult, RunCtx, RunLogger } from "./engine_types";
import { execInputStep } from "./steps/input";
import { execDocToTextStep } from "./steps/doc_to_text";
import { execLlmStep } from "./steps/llm";
import { execLlmBatchStep } from "./steps/llm_batch";
import { execExampleSelectStep } from "./steps/example_select";
import { execAssembleStep } from "./steps/assemble";
import { execParallelStep } from "./steps/parallel";
import {
  execAssertStep,
  execCombineStep,
  execCustomCodeStep,
  execHumanReviewStep,
  execOutputStep,
  execQuoteStep,
  execTransformStep,
} from "./steps/misc";
import { execWebhookStep } from "./steps/webhook";
import { execSqlStep } from "./steps/sql";
import { execN8nStep } from "./steps/n8n";
import { execConnectStep } from "./steps/connect";
import { execChatbotStep } from "./steps/chatbot";
import { execForkJoin } from "./steps/fork";
import { execIfElseJoin } from "./steps/if_else";

export async function execModule(m: PipelineModule, ctx: RunCtx, log: RunLogger): Promise<ExecResult> {
  log.debug(`execModule start`, { moduleId: m.id, kind: m.kind, label: m.label });
  // AI : TODO (remote-call-maybe-runner) — maybe? shared once|map|all runner; see lib/server/remote-call-roadmap.ts
  switch (m.kind) {
    case ModuleKind.Input:
      return execInputStep(m, ctx, log);
    case ModuleKind.DocToText:
      return execDocToTextStep(m, ctx, log);
    case ModuleKind.Llm:
      return execLlmStep(m, ctx, log);
    case ModuleKind.Assemble:
      return execAssembleStep(m, ctx, log);
    case ModuleKind.Parallel:
      return execParallelStep(m, ctx, log);
    case ModuleKind.Fork:
      return execForkJoin(m, ctx, log);
    case ModuleKind.IfElse:
      return execIfElseJoin(m, ctx, log);
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
    case ModuleKind.Webhook:
      return execWebhookStep(m, ctx, log);
    case ModuleKind.Sql:
      return execSqlStep(m, ctx, log);
    case ModuleKind.N8n:
      return execN8nStep(m, ctx, log);
    case ModuleKind.Connect:
      return execConnectStep(m, ctx, log);
    case ModuleKind.Chatbot:
      return execChatbotStep(m, ctx, log);
    default: {
      if (isMergeModuleKind(m.kind)) return execCustomCodeStep(m, ctx, log);
      const unreachable: never = m.kind;
      return assertNever(unreachable, `unknown module kind: ${(m as PipelineModule).kind}`);
    }
  }
}
