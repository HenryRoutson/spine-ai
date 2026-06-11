import { type ZodType } from "zod";
import {
  getStringResponse,
  getStructuredResponse,
  type ChatOptions,
} from "./openrouter_llm";
import { type ModelId, slugFor } from "./types";
import { type UsageLedger } from "./usage";

// AI : single place to call the LLM with a demo ModelId — maps id→slug and bills the ledger.
// AI : mirrors the pitch's "Get llm instance" idea (one cached entry point for all calls).
interface CallContext {
  model: ModelId;
  ledger: UsageLedger;
  system?: string;
}

function chatOpts(ctx: CallContext): ChatOptions {
  return {
    // AI : the demo ModelId maps to a real OpenRouter slug; both are branded strings.
    model: slugFor(ctx.model) as unknown as ChatOptions["model"],
    system: ctx.system,
    onUsage: (u) => ctx.ledger.recordLlm({ model: ctx.model, ...u }),
  };
}

export function llmString(prompt: string, ctx: CallContext): Promise<string> {
  return getStringResponse(prompt, chatOpts(ctx));
}

export function llmStructured<T>(prompt: string, schema: ZodType<T>, ctx: CallContext): Promise<T> {
  return getStructuredResponse(prompt, schema, chatOpts(ctx));
}

// AI : batch llm — one structured (zod-validated) call per list item with bounded concurrency,
// AI : merged back into a typed list in input order. Powers the "llm-batch" pipeline step.
export async function llmBatchStructured<T>(
  items: unknown[],
  promptFor: (item: unknown, index: number) => string,
  schema: ZodType<T>,
  ctx: CallContext,
  concurrency = 4,
): Promise<T[]> {
  const out: T[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await llmStructured(promptFor(items[i], i), schema, ctx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
