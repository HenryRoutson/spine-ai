import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { dataDir } from "./config";
import { getStripe } from "./stripe_client";

// AI : credit-based billing ported from stripe/stripe.js — $5/mo sub grants $5 credit,
// AI : $1 top-up, 50c per pipeline run, $20 hard cap on total card billing per account.
export type BillingUserKey = string & { __brand: "BillingUserKey" };

export type BillingAccount = {
  balanceCents: number;
  totalBilledCents: number;
  subscribed: boolean;
  creditedSessions: string[];
};

export const USE_COST_CENTS = 50;
export const TOPUP_CENTS = 100;
export const SUB_CENTS_PER_MONTH = 500;
export const BILLING_CAP_CENTS = 2000;

export class BillingError extends Error {
  constructor(readonly code: "insufficient_funds" | "cap_reached") {
    super(code === "insufficient_funds" ? "Not enough credit — subscribe or top up in Billing." : "App billing cap reached.");
  }
}

const EMPTY: BillingAccount = {
  balanceCents: 0,
  totalBilledCents: 0,
  subscribed: false,
  creditedSessions: [],
};

function billingFile(): string {
  return join(dataDir(), "billing.json");
}

function loadJsonAccounts(): Record<string, BillingAccount> {
  const path = billingFile();
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, BillingAccount>;
}

function saveJsonAccount(key: BillingUserKey, account: BillingAccount): void {
  const path = billingFile();
  mkdirSync(dataDir(), { recursive: true });
  const all = loadJsonAccounts();
  all[key] = account;
  writeFileSync(path, JSON.stringify(all, null, 2));
}

// AI : schema.sql billing_accounts block may not be run yet — fall back to local billing.json.
function isMissingBillingTable(error: { message?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("billing_accounts") || msg.includes("schema cache");
}

async function loadSupabaseAccount(userId: BillingUserKey): Promise<BillingAccount | null> {
  const db = await createClient();
  const { data, error } = await db
    .from("billing_accounts")
    .select("balance_cents, total_billed_cents, subscribed, credited_sessions")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (!isMissingBillingTable(error)) console.error("billing_accounts:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    balanceCents: data.balance_cents,
    totalBilledCents: data.total_billed_cents,
    subscribed: data.subscribed,
    creditedSessions: data.credited_sessions ?? [],
  };
}

async function saveSupabaseAccount(userId: BillingUserKey, account: BillingAccount): Promise<void> {
  const db = await createClient();
  const { error } = await db.from("billing_accounts").upsert({
    user_id: userId,
    balance_cents: account.balanceCents,
    total_billed_cents: account.totalBilledCents,
    subscribed: account.subscribed,
    credited_sessions: account.creditedSessions,
  });
  if (error) throw error;
}

export async function getBillingUserKey(): Promise<BillingUserKey> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return (data.user?.id ?? "anon") as BillingUserKey;
}

export async function loadBillingAccount(key: BillingUserKey): Promise<BillingAccount> {
  if (key === "anon") return loadJsonAccounts()[key] ?? { ...EMPTY };
  const row = await loadSupabaseAccount(key);
  if (row) return row;
  // AI : no Supabase row yet, or billing_accounts table missing — reuse local JSON keyed by user id.
  return loadJsonAccounts()[key] ?? { ...EMPTY };
}

export async function saveBillingAccount(key: BillingUserKey, account: BillingAccount): Promise<void> {
  if (key === "anon") {
    saveJsonAccount(key, account);
    return;
  }
  try {
    await saveSupabaseAccount(key, account);
  } catch (err) {
    if (!isMissingBillingTable(err as { message?: string })) throw err;
    console.warn("billing_accounts table missing — persisting to local billing.json");
    saveJsonAccount(key, account);
  }
}

export function canBill(account: BillingAccount, amountCents: number): boolean {
  return account.totalBilledCents + amountCents <= BILLING_CAP_CENTS;
}

export function chargeCredit(account: BillingAccount, cents: number): BillingAccount {
  if (account.balanceCents < cents) throw new BillingError("insufficient_funds");
  return { ...account, balanceCents: account.balanceCents - cents };
}

// AI : deduct run credit before starting a pipeline — returns the updated account (caller saves).
export async function chargeForRun(key: BillingUserKey): Promise<BillingAccount> {
  const account = await loadBillingAccount(key);
  const next = chargeCredit(account, USE_COST_CENTS);
  await saveBillingAccount(key, next);
  return next;
}

export async function createCheckoutSession(
  key: BillingUserKey,
  mode: "payment" | "subscription",
  origin: string,
): Promise<{ sessionId: string; url: string | null }> {
  const account = await loadBillingAccount(key);
  const amount = mode === "payment" ? TOPUP_CENTS : SUB_CENTS_PER_MONTH;
  if (!canBill(account, amount)) throw new BillingError("cap_reached");

  const lineItem =
    mode === "payment"
      ? {
          price_data: {
            currency: "usd",
            unit_amount: TOPUP_CENTS,
            product_data: { name: "Credit top up" },
          },
        }
      : {
          price_data: {
            currency: "usd",
            unit_amount: SUB_CENTS_PER_MONTH,
            recurring: { interval: "month" as const },
            product_data: { name: "AI Pipeline Builder monthly" },
          },
        };

  const session = await getStripe().checkout.sessions.create({
    mode,
    line_items: [{ ...lineItem, quantity: 1 }],
    success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?canceled=1`,
    client_reference_id: key,
  });
  if (!session.id) throw new Error("Stripe checkout session missing id");
  return { sessionId: session.id, url: session.url };
}

// AI : success redirect → verify with Stripe and credit once (idempotent via creditedSessions).
export async function confirmCheckoutSession(
  key: BillingUserKey,
  sessionId: string,
): Promise<{ account: BillingAccount; creditedCents: number }> {
  const account = await loadBillingAccount(key);
  if (account.creditedSessions.includes(sessionId)) {
    return { account, creditedCents: 0 };
  }

  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid" || session.amount_total == null) {
    return { account, creditedCents: 0 };
  }
  if (session.client_reference_id && session.client_reference_id !== key) {
    throw new Error("Checkout session belongs to a different account");
  }

  const next: BillingAccount = {
    balanceCents: account.balanceCents + session.amount_total,
    totalBilledCents: account.totalBilledCents + session.amount_total,
    subscribed: account.subscribed || session.mode === "subscription",
    creditedSessions: [...account.creditedSessions, sessionId],
  };
  await saveBillingAccount(key, next);
  return { account: next, creditedCents: session.amount_total };
}

// AI : monthly renewal credits need webhooks — placeholder hook for `stripe listen`.
export async function handleStripeWebhook(_event: Stripe.Event): Promise<void> {
  // TODO: invoice.paid → grant SUB_CENTS_PER_MONTH credit on renewal
}
