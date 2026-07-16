import { createAdminClient } from "./supabase_admin";
import type { BillingUserKey } from "./billing_account";
import { freeCreditCentsAt } from "./free_credit_schedule";

export type billing_flow_type =
  | "signup_credit"
  | "checkout_credit"
  | "invoice_credit"
  | "feedback_credit"
  | "usage_run"
  | "usage_assistant"
  | "usage_hosted_api"
  | "usage_shared_link"
  | "usage_marketplace"
  | "usage_other";

export type billing_flow_input = {
  userId: BillingUserKey;
  userEmail?: string | null;
  flowType: billing_flow_type;
  amountCents: number;
  balanceAfterCents?: number;
  refId?: string;
  detail?: Record<string, unknown>;
};

function isMissingBillingFlowTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("billing_flow_ledger") || msg.includes("schema cache");
}

export async function recordBillingFlow(entry: billing_flow_input): Promise<void> {
  const admin = await createAdminClient();
  if (!admin) return;

  const { error } = await admin.from("billing_flow_ledger").insert({
    user_id: entry.userId,
    user_email: entry.userEmail ?? null,
    flow_type: entry.flowType,
    amount_cents: +entry.amountCents.toFixed(4),
    balance_after_cents:
      entry.balanceAfterCents != null ? +entry.balanceAfterCents.toFixed(4) : null,
    ref_id: entry.refId ?? null,
    detail: entry.detail ?? {},
  });

  if (error && !isMissingBillingFlowTable(error)) {
    console.warn("billing_flow_ledger insert failed:", error.message);
  }
}

export async function recordSignupCredit(
  userId: BillingUserKey,
  userEmail?: string | null,
): Promise<void> {
  const amountCents = await freeCreditCentsAt("signup");
  await recordBillingFlow({
    userId,
    userEmail,
    flowType: "signup_credit",
    amountCents,
    balanceAfterCents: amountCents,
    detail: { note: "New account starting credit" },
  });
}
