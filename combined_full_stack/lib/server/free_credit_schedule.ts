import {
  FEEDBACK_CREDIT_CENTS,
  NEW_ACCOUNT_BALANCE_CENTS,
} from "@/lib/billing_config";
import { createAdminClient } from "./supabase_admin";

export type free_credit_kind = "signup" | "feedback";

const FALLBACK_CENTS: Record<free_credit_kind, number> = {
  signup: NEW_ACCOUNT_BALANCE_CENTS,
  feedback: FEEDBACK_CREDIT_CENTS,
};

function isMissingFreeCreditSchedule(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("free_credit_schedule") || msg.includes("schema cache");
}

// AI : dated free-credit amounts — mirrors platform_markup_schedule pattern.
export async function freeCreditCentsAt(
  kind: free_credit_kind,
  at: Date = new Date(),
): Promise<number> {
  const admin = await createAdminClient();
  if (!admin) return FALLBACK_CENTS[kind];

  const { data, error } = await admin.rpc("free_credit_cents_at", {
    p_kind: kind,
    p_at: at.toISOString(),
  });
  if (error) {
    if (!isMissingFreeCreditSchedule(error)) {
      console.warn("free_credit_cents_at rpc failed:", error.message);
    }
    return FALLBACK_CENTS[kind];
  }
  const cents = Number(data);
  return cents > 0 ? cents : FALLBACK_CENTS[kind];
}

export async function loadFreeCreditAmounts(): Promise<{
  signupCreditCents: number;
  feedbackCreditCents: number;
}> {
  const [signupCreditCents, feedbackCreditCents] = await Promise.all([
    freeCreditCentsAt("signup"),
    freeCreditCentsAt("feedback"),
  ]);
  return { signupCreditCents, feedbackCreditCents };
}
