"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function SharePricingFields({
  billingMultiple,
  onBillingMultipleChange,
  flatFeeUsd,
  onFlatFeeUsdChange,
  flatFeeEnabled,
  onFlatFeeEnabledChange,
  perUnitLabel,
}: {
  billingMultiple: string
  onBillingMultipleChange: (v: string) => void
  flatFeeUsd: string
  onFlatFeeUsdChange: (v: string) => void
  flatFeeEnabled: boolean
  onFlatFeeEnabledChange: (v: boolean) => void
  perUnitLabel: string
}) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div>
        <Label className="font-mono text-[10px] uppercase tracking-wider">Billing multiple</Label>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Multiplier on measured LLM cost — 1× passes through at cost, 2× doubles it.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Input
            type="number"
            min="1"
            max="100"
            step="0.1"
            value={billingMultiple}
            onChange={(e) => onBillingMultipleChange(e.target.value)}
            className="h-8 w-24 font-mono text-xs"
          />
          <span className="text-xs text-muted-foreground">× LLM cost</span>
        </div>
      </div>
      <div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={flatFeeEnabled}
            onChange={(e) => onFlatFeeEnabledChange(e.target.checked)}
          />
          Add flat fee per {perUnitLabel}
        </label>
        {flatFeeEnabled && (
          <div className="mt-2 flex items-center gap-2 pl-5">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={flatFeeUsd}
              onChange={(e) => onFlatFeeUsdChange(e.target.value)}
              className="h-8 w-24 font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground">on top of multiplied LLM cost</span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        You earn everything above raw LLM cost — credited to Pipeline earnings in Billing.
      </p>
    </div>
  )
}

export function parseSharePricing(
  billingMultiple: string,
  flatFeeEnabled: boolean,
  flatFeeUsd: string,
): { ok: true; billingMultiple: number; flatFeeCents: number } | { ok: false; error: string } {
  const multiple = Number.parseFloat(billingMultiple)
  if (!Number.isFinite(multiple) || multiple < 1 || multiple > 100) {
    return { ok: false, error: "Enter a billing multiple between 1 and 100" }
  }
  let flatFeeCents = 0
  if (flatFeeEnabled) {
    const fixed = Number.parseFloat(flatFeeUsd)
    if (!Number.isFinite(fixed) || fixed < 0) {
      return { ok: false, error: "Enter a valid flat fee amount" }
    }
    flatFeeCents = Math.round(fixed * 100)
  }
  return { ok: true, billingMultiple: +multiple.toFixed(4), flatFeeCents }
}
