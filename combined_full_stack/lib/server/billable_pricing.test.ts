import { describe, expect, it } from "vitest";
import { SharedLinkFundingMode } from "@/lib/server/types";
import {
  billingMultipleFromLegacyMarkupBps,
  computeBillableCharge,
  customPricingAppliesToLink,
} from "@/lib/server/billable_pricing";

describe("billable_pricing", () => {
  it("passes through at 1× with no flat fee", () => {
    const charge = computeBillableCharge(100, { billingMultiple: 1, flatFeeCents: 0 }, true);
    expect(charge.totalCents).toBe(100);
    expect(charge.earningsCents).toBe(0);
  });

  it("applies billing multiple and flat fee", () => {
    const charge = computeBillableCharge(100, { billingMultiple: 2, flatFeeCents: 25 }, true);
    expect(charge.totalCents).toBe(225);
    expect(charge.earningsCents).toBe(125);
  });

  it("ignores pricing when owner pays", () => {
    const applies = customPricingAppliesToLink({
      fundingMode: SharedLinkFundingMode.SharerPays,
      billingMultiple: 3,
      flatFeeCents: 50,
    });
    expect(applies).toBe(false);
    const charge = computeBillableCharge(100, { billingMultiple: 3, flatFeeCents: 50 }, applies);
    expect(charge.totalCents).toBe(100);
  });

  it("converts legacy markup bps to multiple", () => {
    expect(billingMultipleFromLegacyMarkupBps(2000)).toBe(1.2);
  });
});
