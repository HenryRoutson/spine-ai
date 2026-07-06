import { PRICE_MARKUP, tokenCostCents } from "./openrouter_pricing";
import { logger } from "./server_logger";
import { type ModelId, type TokenUsage } from "./types";
import { modelOption } from "./openrouter_models";

const usageLog = logger("usage");

type Cents = number;
type ServiceName = string; // e.g. "doc-parse svc" — a non-LLM billable service

export interface UsageRecord extends TokenUsage {
  service?: ServiceName; // set for non-LLM billable work
  at: number;
}

// AI : bill prompt + completion separately at OpenRouter rates × 40% markup.
export function costOf(usage: TokenUsage): Cents {
  const opt = modelOption(usage.model);
  return tokenCostCents(
    { promptUsdPerToken: opt.promptUsdPerToken, completionUsdPerToken: opt.completionUsdPerToken },
    usage.promptTokens,
    usage.completionTokens,
  );
}

// AI : per-run ledger of every billable event; aggregated by Logging + Billing.
export class UsageLedger {
  private records: UsageRecord[] = [];

  recordLlm(usage: TokenUsage): void {
    const cost = costOf(usage);
    usageLog.debug(`recordLlm`, { ...usage, costCents: +cost.toFixed(4) });
    this.records.push({ ...usage, at: Date.now() });
  }

  // AI : flat-cost services (PDF parse etc.) bill as synthetic completion tokens on a model line.
  recordService(service: ServiceName, model: ModelId, costCents: Cents): void {
    usageLog.debug(`recordService`, { service, model, costCents });
    const opt = modelOption(model);
    const markedUpCompletionCents = opt.completionUsdPerToken * 100 * PRICE_MARKUP;
    const tokens = markedUpCompletionCents > 0 ? Math.round(costCents / markedUpCompletionCents) : 0;
    this.records.push({ model, service, promptTokens: 0, completionTokens: tokens, at: Date.now() });
  }

  totalCents(): Cents {
    return this.records.reduce((sum, r) => sum + costOf(r), 0);
  }

  tokenTotals(): { promptTokens: number; completionTokens: number } {
    return this.records.reduce(
      (acc, r) => ({
        promptTokens: acc.promptTokens + r.promptTokens,
        completionTokens: acc.completionTokens + r.completionTokens,
      }),
      { promptTokens: 0, completionTokens: 0 },
    );
  }

  all(): readonly UsageRecord[] {
    return this.records;
  }
}
