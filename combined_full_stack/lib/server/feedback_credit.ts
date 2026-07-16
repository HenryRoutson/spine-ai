import {
  FEEDBACK_MAX_CREDITS_PER_DAY,
  FEEDBACK_MIN_CHARS,
} from "@/lib/billing_config";
import { createAdminClient } from "./supabase_admin";
import {
  billingKeyForUser,
  loadBillingAccount,
  saveBillingAccount,
  type BillingAccount,
  type BillingUserKey,
} from "./billing_account";
import { recordBillingFlow } from "./billing_flow";
import { freeCreditCentsAt } from "./free_credit_schedule";
import { LOCAL_DEV_USER_ID, type user_id_string } from "./require_auth";
import type { feedback_id_string } from "./user_feedback";

export { FEEDBACK_MIN_CHARS, FEEDBACK_MAX_CREDITS_PER_DAY };

export class FeedbackCreditError extends Error {
  constructor(
    readonly code: "too_short",
    message: string,
  ) {
    super(message);
  }
}

function startOfUtcDayMs(at = Date.now()): number {
  const d = new Date(at);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function isMissingFeedbackCreditTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return (
    msg.includes("billing_credit_ledger") ||
    msg.includes("user_feedback") ||
    msg.includes("schema cache")
  );
}

function feedbackCreditKey(feedbackId: feedback_id_string): string {
  return `fb_credit_${feedbackId}`;
}

export async function countFeedbackCreditsToday(userId: user_id_string): Promise<number> {
  const admin = await createAdminClient();
  if (!admin) return 0;

  const since = new Date(startOfUtcDayMs()).toISOString();
  const { count, error } = await admin
    .from("billing_credit_ledger")
    .select("credit_key", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "feedback")
    .gte("created_at", since);
  if (error) {
    if (!isMissingFeedbackCreditTable(error)) {
      console.warn("countFeedbackCreditsToday failed:", error.message);
    }
    return 0;
  }
  return count ?? 0;
}

async function linkFeedbackCredit(
  feedbackId: feedback_id_string,
  creditKey: string,
  creditCents: number,
): Promise<void> {
  const admin = await createAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("user_feedback")
    .update({
      credit_key: creditKey,
      credit_granted_cents: creditCents,
    })
    .eq("id", feedbackId);
  if (error && !isMissingFeedbackCreditTable(error)) {
    console.warn("linkFeedbackCredit failed:", error.message);
  }
}

// AI : promotional credit — balance only, no Stripe billing-cap increment.
async function claimFeedbackCredit(
  key: BillingUserKey,
  creditKey: string,
  creditCents: number,
): Promise<{ claimed: boolean; account: BillingAccount }> {
  const credit = Math.round(creditCents);
  if (credit <= 0) return { claimed: false, account: await loadBillingAccount(key) };

  let account = await loadBillingAccount(key);
  if (account.creditedSessions.includes(creditKey)) {
    return { claimed: false, account };
  }

  if (key !== (LOCAL_DEV_USER_ID as unknown as BillingUserKey)) {
    const admin = await createAdminClient();
    if (admin) {
      const { error } = await admin.from("billing_credit_ledger").insert({
        credit_key: creditKey,
        user_id: key,
        amount_cents: credit,
        source: "feedback",
      });
      if (error?.code === "23505") {
        return { claimed: false, account: await loadBillingAccount(key) };
      }
      if (error && !isMissingFeedbackCreditTable(error)) throw error;
    }
  }

  account = await loadBillingAccount(key);
  if (account.creditedSessions.includes(creditKey)) {
    return { claimed: false, account };
  }

  const next: BillingAccount = {
    ...account,
    balanceCents: account.balanceCents + credit,
    creditedSessions: [...account.creditedSessions, creditKey],
  };
  await saveBillingAccount(key, next);
  void recordBillingFlow({
    userId: key,
    flowType: "feedback_credit",
    amountCents: credit,
    balanceAfterCents: next.balanceCents,
    refId: creditKey,
    detail: { source: "feedback" },
  });
  return { claimed: true, account: next };
}

export type GrantFeedbackCreditResult = {
  creditedCents: number;
  balanceCents: number;
  creditsRemainingToday: number;
};

export async function grantFeedbackCredit(
  userId: user_id_string,
  feedbackId: feedback_id_string,
  messageLength: number,
): Promise<GrantFeedbackCreditResult> {
  if (messageLength < FEEDBACK_MIN_CHARS) {
    throw new FeedbackCreditError(
      "too_short",
      `Feedback must be at least ${FEEDBACK_MIN_CHARS} characters to earn credit.`,
    );
  }

  const key = billingKeyForUser(userId);
  const todayCount = await countFeedbackCreditsToday(userId);
  if (todayCount >= FEEDBACK_MAX_CREDITS_PER_DAY) {
    const account = await loadBillingAccount(key);
    return {
      creditedCents: 0,
      balanceCents: account.balanceCents,
      creditsRemainingToday: 0,
    };
  }

  const creditCents = await freeCreditCentsAt("feedback");
  const creditKey = feedbackCreditKey(feedbackId);
  const { claimed, account } = await claimFeedbackCredit(key, creditKey, creditCents);

  if (claimed) {
    void linkFeedbackCredit(feedbackId, creditKey, creditCents);
  }

  const creditsRemainingToday = Math.max(
    0,
    FEEDBACK_MAX_CREDITS_PER_DAY - todayCount - (claimed ? 1 : 0),
  );

  return {
    creditedCents: claimed ? creditCents : 0,
    balanceCents: account.balanceCents,
    creditsRemainingToday,
  };
}
