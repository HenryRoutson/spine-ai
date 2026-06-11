import { type ModelId, type TokenUsage, modelOption } from "./types";

type Cents = number;
type ServiceName = string; // e.g. "doc-parse svc" — a non-LLM billable service

export interface UsageRecord extends TokenUsage {
  service?: ServiceName; // set for non-LLM billable work
  at: number;
}

// AI : cost = total tokens × costPer1k (cents per 1k blended tokens).
export function costOf(usage: TokenUsage): Cents {
  const { costPer1k } = modelOption(usage.model);
  const tokens = usage.promptTokens + usage.completionTokens;
  return (tokens / 1000) * costPer1k;
}

// AI : per-run ledger of every billable event; aggregated by Logging + Billing.
export class UsageLedger {
  private records: UsageRecord[] = [];

  recordLlm(usage: TokenUsage): void {
    this.records.push({ ...usage, at: Date.now() });
  }

  // AI : flat-cost services (PDF parse etc.) bill as synthetic completion tokens on a model line.
  recordService(service: ServiceName, model: ModelId, costCents: Cents): void {
    const { costPer1k } = modelOption(model);
    const tokens = costPer1k > 0 ? Math.round((costCents / costPer1k) * 1000) : 0;
    this.records.push({ model, service, promptTokens: 0, completionTokens: tokens, at: Date.now() });
  }

  totalCents(): Cents {
    return this.records.reduce((sum, r) => sum + costOf(r), 0);
  }

  all(): readonly UsageRecord[] {
    return this.records;
  }
}
