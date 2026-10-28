import { formatCostCents } from "@/lib/format"
import { llmStepCostLimitCents } from "@/lib/llm-cost-limit"
import type { UsageLedger } from "./usage"

type Cents = number

export class StepCostLimitExceededError extends Error {
  readonly spentCents: Cents
  readonly limitCents: Cents

  constructor(spentCents: Cents, limitCents: Cents, stepLabel?: string) {
    const prefix = stepLabel ? `step "${stepLabel}" ` : ""
    super(
      `${prefix}LLM cost limit exceeded: ${formatCostCents(spentCents)} spent, limit ${formatCostCents(limitCents)}`,
    )
    this.name = "StepCostLimitExceededError"
    this.spentCents = spentCents
    this.limitCents = limitCents
  }
}

export function stepCostSpentCents(ledger: UsageLedger, stepBaseCents: Cents): Cents {
  return +(ledger.totalCents() - stepBaseCents).toFixed(4)
}

export function assertWithinStepCostLimit(
  ledger: UsageLedger,
  stepBaseCents: Cents,
  limitCents: Cents,
  stepLabel?: string,
): void {
  const spent = stepCostSpentCents(ledger, stepBaseCents)
  if (spent > limitCents) throw new StepCostLimitExceededError(spent, limitCents, stepLabel)
}

export { llmStepCostLimitCents }
