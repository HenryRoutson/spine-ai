import type { SharedLinkRecord } from "@/lib/shared-link-types";
import { SharedLinkFundingMode } from "@/lib/server/types";
import { viewerFundsSharedRun } from "@/lib/server/shared_link_billing";

export const MAX_BILLING_MULTIPLE = 100;
export const MAX_FLAT_FEE_CENTS = 100_000;

export type BillablePricingConfig = Pick<
  SharedLinkRecord,
  "fundingMode" | "billingMultiple" | "flatFeeCents"
>;

export type BillablePricing = {
  billingMultiple: number;
  flatFeeCents: number;
};

export type BillableCharge = {
  usageCents: number;
  totalCents: number;
  earningsCents: number;
};

function toExactCents(cents: number): number {
  return +Math.max(0, cents).toFixed(4);
}

export function normalizeBillingMultiple(multiple: number | undefined): number {
  if (multiple == null || !Number.isFinite(multiple)) return 1;
  return +Math.min(MAX_BILLING_MULTIPLE, Math.max(1, multiple)).toFixed(4);
}

export function normalizeFlatFeeCents(cents: number | undefined): number {
  if (cents == null || !Number.isFinite(cents)) return 0;
  return toExactCents(Math.min(MAX_FLAT_FEE_CENTS, Math.max(0, cents)));
}

// AI : legacy rows stored markup_bps — convert to equivalent multiple (1 + bps/10000).
export function billingMultipleFromLegacyMarkupBps(markupBps: number | undefined): number {
  const bps = Math.max(0, Math.round(markupBps ?? 0));
  if (bps === 0) return 1;
  return normalizeBillingMultiple(1 + bps / 10_000);
}

export function hasCustomBillablePricing(pricing: BillablePricing): boolean {
  return normalizeBillingMultiple(pricing.billingMultiple) > 1 || normalizeFlatFeeCents(pricing.flatFeeCents) > 0;
}

export function customPricingAppliesToLink(config: BillablePricingConfig): boolean {
  return viewerFundsSharedRun(config.fundingMode);
}

export function computeBillableCharge(
  usageCents: number,
  pricing: BillablePricing,
  applyCustomPricing: boolean,
): BillableCharge {
  const usage = toExactCents(usageCents);
  if (!applyCustomPricing) {
    return { usageCents: usage, totalCents: usage, earningsCents: 0 };
  }
  const multiple = normalizeBillingMultiple(pricing.billingMultiple);
  const flat = normalizeFlatFeeCents(pricing.flatFeeCents);
  const totalCents = toExactCents(usage * multiple + flat);
  const earningsCents = toExactCents(totalCents - usage);
  return { usageCents: usage, totalCents, earningsCents };
}

export function assertValidBillablePricing(
  chargeCaller: boolean,
  billingMultiple?: number,
  flatFeeCents?: number,
  label = "Custom pricing",
): void {
  const multiple = normalizeBillingMultiple(billingMultiple);
  normalizeFlatFeeCents(flatFeeCents);
  if (multiple === 1 && (flatFeeCents ?? 0) === 0) return;
  if (!chargeCaller) {
    throw new Error(`${label} requires caller-funded billing`);
  }
}

export function assertValidSharedLinkPricing(
  fundingMode: SharedLinkFundingMode,
  billingMultiple?: number,
  flatFeeCents?: number,
): void {
  assertValidBillablePricing(viewerFundsSharedRun(fundingMode), billingMultiple, flatFeeCents, "Pricing");
}
