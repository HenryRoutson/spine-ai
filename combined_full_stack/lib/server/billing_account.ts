import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
// AI : TODO (spec) — profit-per-user virtual table + arbitrage guard; block runs when balance breaches -$10 floor during billing.
import {
  BILLING_CAP_CENTS,
  MIN_ACCOUNT_BALANCE_CENTS,
  MIN_RUN_BALANCE_CENTS,
  NEW_ACCOUNT_BALANCE_CENTS,
  SUB_CENTS_PER_MONTH,
  TOPUP_OPTIONS_CENTS,
} from "@/lib/billing_config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type Stripe from "stripe";
import { createClient } from "@/utils/supabase/server";
import { getSiteUrl } from "@/utils/supabase/site_url";
import { dataDir } from "./config";
import { createAdminClient } from "./supabase_admin";
import {
  isAuthSession,
  isProductionDeploy,
  LOCAL_DEV_USER_ID,
  requireAuth,
  type user_id_string,
} from "./require_auth";
import { logger } from "./server_logger";
import { getStripe } from "./stripe_client";

const billLog = logger("billing");

// AI : credit-based billing ported from stripe/stripe.js — $5/mo sub grants $5 credit,
// AI : $1 / $10 / $20 top-up options, 10¢ minimum balance to start a run (actual cost varies), $300 hard cap; new accounts get $10 free credit.
export type BillingUserKey = string & { __brand: "BillingUserKey" };

export type BillingAccount = {
  balanceCents: number;
  totalBilledCents: number;
  totalUsageCents: number;
  subscribed: boolean;
  creditedSessions: string[];
};

export type BillingCreditHistoryEntry = {
  creditKey: string;
  amountCents: number;
  source: "checkout" | "invoice";
  createdAt: string;
};

export {
  BILLING_CAP_CENTS,
  MIN_RUN_BALANCE_CENTS,
  SUB_CENTS_PER_MONTH,
  TOPUP_OPTIONS_CENTS,
};

export class BillingError extends Error {
  constructor(readonly code: "insufficient_funds" | "cap_reached") {
    super(code === "insufficient_funds" ? "Not enough credit — subscribe or top up in Billing." : "App billing cap reached.");
  }
}

const EMPTY: BillingAccount = {
  balanceCents: NEW_ACCOUNT_BALANCE_CENTS,
  totalBilledCents: 0,
  totalUsageCents: 0,
  subscribed: false,
  creditedSessions: [],
};

// AI : Stripe + cap checks stay whole cents; run usage matches sub-cent step traces (4 dp).
function toWholeCents(cents: number): number {
  return Math.round(cents);
}

function toExactCents(cents: number): number {
  return +Math.max(0, cents).toFixed(4);
}

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

function isMissingCreditLedgerTable(error: { message?: string; code?: string }): boolean {
  const msg = error.message ?? "";
  return msg.includes("billing_credit_ledger") || msg.includes("schema cache");
}

type BillingCreditSource = "checkout" | "invoice";

function checkoutSessionUserId(session: Stripe.Checkout.Session, key: BillingUserKey): void {
  if (session.client_reference_id !== key) {
    throw new Error("Checkout session belongs to a different account");
  }
  const metaUser = session.metadata?.user_id;
  if (metaUser && metaUser !== key) {
    throw new Error("Checkout session belongs to a different account");
  }
}

// AI : never credit more than Stripe collected — amounts must match server-configured prices.
function checkoutCreditCents(session: Stripe.Checkout.Session): number {
  if (session.payment_status !== "paid") throw new Error("Checkout not paid");
  if (session.amount_total == null || session.amount_total <= 0) {
    throw new Error("Checkout has no paid amount");
  }
  const total = session.amount_total;
  if (session.mode === "payment") {
    if (!TOPUP_OPTIONS_CENTS.includes(total as (typeof TOPUP_OPTIONS_CENTS)[number])) {
      throw new Error("Checkout amount does not match a valid top-up");
    }
    return total;
  }
  if (session.mode === "subscription") {
    if (total !== SUB_CENTS_PER_MONTH) {
      throw new Error("Checkout amount does not match subscription price");
    }
    return total;
  }
  throw new Error("Unsupported checkout mode");
}

async function claimBillingCredit(
  key: BillingUserKey,
  creditKey: string,
  creditCents: number,
  source: BillingCreditSource,
  subscribed?: boolean,
): Promise<{ claimed: boolean; account: BillingAccount }> {
  const credit = toWholeCents(creditCents);
  if (credit <= 0) return { claimed: false, account: await loadBillingAccount(key) };

  let account = await loadBillingAccount(key);
  if (account.creditedSessions.includes(creditKey)) {
    return { claimed: false, account };
  }

  if (!isLocalJsonBillingKey(key)) {
    const admin = await createAdminClient();
    if (admin) {
      const { error } = await admin.from("billing_credit_ledger").insert({
        credit_key: creditKey,
        user_id: key,
        amount_cents: credit,
        source,
      });
      if (error?.code === "23505") {
        billLog.info(`claimBillingCredit duplicate`, { key, creditKey, source });
        return { claimed: false, account: await loadBillingAccount(key) };
      }
      if (error && !isMissingCreditLedgerTable(error)) throw error;
    }
  }

  account = await loadBillingAccount(key);
  if (account.creditedSessions.includes(creditKey)) {
    return { claimed: false, account };
  }
  if (!canBill(account, credit)) throw new BillingError("cap_reached");

  const next: BillingAccount = {
    ...account,
    balanceCents: account.balanceCents + credit,
    totalBilledCents: account.totalBilledCents + credit,
    subscribed: subscribed ?? account.subscribed,
    creditedSessions: [...account.creditedSessions, creditKey],
  };
  await saveBillingAccount(key, next);
  billLog.info(`claimBillingCredit ok`, { key, creditKey, credit, source });
  return { claimed: true, account: next };
}

async function seedSupabaseBillingAccount(key: BillingUserKey): Promise<BillingAccount> {
  const admin = await createAdminClient();
  if (!admin) return { ...EMPTY };
  const row = {
    user_id: key,
    balance_cents: toExactCents(NEW_ACCOUNT_BALANCE_CENTS),
    total_billed_cents: 0,
    total_usage_cents: 0,
    subscribed: false,
    credited_sessions: [] as string[],
  };
  const { error } = await admin.from("billing_accounts").insert(row);
  if (error && error.code !== "23505") {
    if (!isMissingBillingTable(error)) throw error;
    return { ...EMPTY };
  }
  const loaded = await loadSupabaseAccount(key);
  return loaded ?? { ...EMPTY };
}

// AI : prefer service role — webhooks and shared-link runs bill users without their session.
async function billingDb() {
  const admin = await createAdminClient();
  if (admin) return admin;
  return createClient();
}

// AI : billing writes must use service role in production — user session is SELECT-only via RLS.
// AI : TODO security — dev fallback to user session still writes if old FOR ALL billing RLS is active;
// AI : always require service role for billing writes (no createClient() fallback).
async function billingDbWrite() {
  const admin = await createAdminClient();
  if (admin) return admin;
  if (!isProductionDeploy()) return createClient();
  throw new Error("SUPABASE_SERVICE_ROLE_KEY required for billing writes");
}

async function loadSupabaseAccount(userId: BillingUserKey): Promise<BillingAccount | null> {
  const db = await billingDb();
  const { data, error } = await db
    .from("billing_accounts")
    .select("balance_cents, total_billed_cents, total_usage_cents, subscribed, credited_sessions")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (!isMissingBillingTable(error)) console.error("billing_accounts:", error.message);
    // AI : migration 008 not applied yet — read without total_usage_cents.
    if ((error.message ?? "").includes("total_usage_cents")) {
      const legacy = await db
        .from("billing_accounts")
        .select("balance_cents, total_billed_cents, subscribed, credited_sessions")
        .eq("user_id", userId)
        .maybeSingle();
      if (legacy.error) {
        if (!isMissingBillingTable(legacy.error)) console.error("billing_accounts:", legacy.error.message);
        return null;
      }
      if (!legacy.data) return null;
      return {
        balanceCents: Number(legacy.data.balance_cents),
        totalBilledCents: Number(legacy.data.total_billed_cents),
        totalUsageCents: 0,
        subscribed: legacy.data.subscribed,
        creditedSessions: legacy.data.credited_sessions ?? [],
      };
    }
    return null;
  }
  if (!data) return null;
  return {
    balanceCents: Number(data.balance_cents),
    totalBilledCents: Number(data.total_billed_cents),
    totalUsageCents: Number(data.total_usage_cents ?? 0),
    subscribed: data.subscribed,
    creditedSessions: data.credited_sessions ?? [],
  };
}

async function saveSupabaseAccount(userId: BillingUserKey, account: BillingAccount): Promise<void> {
  const db = await billingDbWrite();
  const row = {
    user_id: userId,
    balance_cents: toExactCents(account.balanceCents),
    total_billed_cents: toExactCents(account.totalBilledCents),
    total_usage_cents: toExactCents(account.totalUsageCents ?? 0),
    subscribed: account.subscribed,
    credited_sessions: account.creditedSessions,
  };
  const { error } = await db.from("billing_accounts").upsert(row);
  if (error && (error.message ?? "").includes("total_usage_cents")) {
    const { total_usage_cents: _drop, ...legacyRow } = row;
    const legacy = await db.from("billing_accounts").upsert({
      ...legacyRow,
      balance_cents: toWholeCents(account.balanceCents),
      total_billed_cents: toWholeCents(account.totalBilledCents),
    });
    if (legacy.error) throw legacy.error;
    return;
  }
  if (error) throw error;
}

function isLocalJsonBillingKey(key: BillingUserKey): boolean {
  return key === (LOCAL_DEV_USER_ID as unknown as BillingUserKey);
}

export async function getBillingUserKey(): Promise<BillingUserKey> {
  const auth = await requireAuth();
  if (!isAuthSession(auth)) throw new Error(AUTH_SIGN_IN_REQUIRED);
  return auth.userId as unknown as BillingUserKey;
}

export function billingKeyForUser(userId: user_id_string): BillingUserKey {
  return userId as unknown as BillingUserKey;
}

export async function loadBillingAccount(key: BillingUserKey): Promise<BillingAccount> {
  if (isLocalJsonBillingKey(key)) {
    const accounts = loadJsonAccounts();
    const row = accounts[key] ?? accounts["anon" as BillingUserKey] ?? { ...EMPTY };
    return { ...EMPTY, ...row, totalUsageCents: row.totalUsageCents ?? 0 };
  }
  const row = await loadSupabaseAccount(key);
  if (row) return row;
  try {
    return await seedSupabaseBillingAccount(key);
  } catch (err) {
    if (!isMissingBillingTable(err as { message?: string })) throw err;
  }
  const local = loadJsonAccounts()[key];
  if (local) return { ...EMPTY, ...local, totalUsageCents: local.totalUsageCents ?? 0 };
  return { ...EMPTY };
}

export async function saveBillingAccount(key: BillingUserKey, account: BillingAccount): Promise<void> {
  if (isLocalJsonBillingKey(key)) {
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

// AI : pre-run gate — requires minimum balance; does not deduct (actual LLM cost billed after the run).
export async function assertCanStartRun(key: BillingUserKey): Promise<BillingAccount> {
  const account = await loadBillingAccount(key);
  billLog.info(`assertCanStartRun`, {
    key,
    balanceCents: account.balanceCents,
    minRequired: MIN_RUN_BALANCE_CENTS,
    floor: MIN_ACCOUNT_BALANCE_CENTS,
  });
  if (account.balanceCents < MIN_ACCOUNT_BALANCE_CENTS) {
    throw new BillingError("insufficient_funds");
  }
  if (account.balanceCents < MIN_RUN_BALANCE_CENTS) {
    throw new BillingError("insufficient_funds");
  }
  return account;
}

/** @deprecated use assertCanStartRun — kept for call-site clarity during migration */
export const chargeForRun = assertCanStartRun;

// AI : deduct measured LLM / service cost after a run completes (skipped when billedCents is 0).
export async function billRunUsage(key: BillingUserKey, cents: number): Promise<BillingAccount> {
  const billed = toExactCents(cents);
  if (billed <= 0) return loadBillingAccount(key);
  const account = await loadBillingAccount(key);
  const balanceAfter = toExactCents(account.balanceCents - billed);
  if (balanceAfter < MIN_ACCOUNT_BALANCE_CENTS) {
    billLog.warn(`billRunUsage floor breached`, { key, balanceAfter, billed, floor: MIN_ACCOUNT_BALANCE_CENTS });
    throw new BillingError("insufficient_funds");
  }
  const next: BillingAccount = {
    ...account,
    balanceCents: balanceAfter,
    totalUsageCents: toExactCents((account.totalUsageCents ?? 0) + billed),
  };
  await saveBillingAccount(key, next);
  billLog.info(`billRunUsage ok`, { key, billed, balanceAfter, rawCents: cents });
  return next;
}

export async function createCheckoutSession(
  key: BillingUserKey,
  mode: "payment" | "subscription",
  _origin: string,
  topupCents?: number,
): Promise<{ sessionId: string; url: string | null }> {
  const account = await loadBillingAccount(key);
  const amount =
    mode === "payment"
      ? (() => {
          if (topupCents == null || !TOPUP_OPTIONS_CENTS.includes(topupCents as (typeof TOPUP_OPTIONS_CENTS)[number])) {
            throw new Error("topupCents must be one of the configured top-up amounts");
          }
          return topupCents;
        })()
      : SUB_CENTS_PER_MONTH;
  if (!canBill(account, amount)) throw new BillingError("cap_reached");

  const siteUrl = getSiteUrl().replace(/\/$/, "");

  const lineItem =
    mode === "payment"
      ? {
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: { name: "Credit top up" },
          },
        }
      : {
          price_data: {
            currency: "usd",
            unit_amount: SUB_CENTS_PER_MONTH,
            recurring: { interval: "month" as const },
            product_data: { name: "Spine monthly" },
          },
        };

  const session = await getStripe().checkout.sessions.create({
    mode,
    line_items: [{ ...lineItem, quantity: 1 }],
    success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/?canceled=1`,
    client_reference_id: key,
    metadata: { user_id: key },
    ...(mode === "subscription"
      ? { subscription_data: { metadata: { user_id: key } } }
      : {}),
  });
  if (!session.id) throw new Error("Stripe checkout session missing id");
  return { sessionId: session.id, url: session.url };
}

// AI : success redirect → verify with Stripe and credit once (idempotent via creditedSessions).
export async function confirmCheckoutSession(
  key: BillingUserKey,
  sessionId: string,
): Promise<{ account: BillingAccount; creditedCents: number }> {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  checkoutSessionUserId(session, key);
  const creditCents = checkoutCreditCents(session);
  const { claimed, account } = await claimBillingCredit(
    key,
    sessionId,
    creditCents,
    "checkout",
    session.mode === "subscription" ? true : undefined,
  );
  return { account, creditedCents: claimed ? creditCents : 0 };
}

// AI : monthly renewal credits — invoice.paid webhook grants SUB_CENTS_PER_MONTH (idempotent per invoice id).
type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

async function resolveInvoiceUserId(invoice: InvoiceWithSubscription): Promise<BillingUserKey | null> {
  if (invoice.metadata?.user_id) return invoice.metadata.user_id as BillingUserKey;

  const subId =
    typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (subId) {
    const sub = await getStripe().subscriptions.retrieve(subId);
    if (sub.metadata?.user_id) return sub.metadata.user_id as BillingUserKey;
  }

  const custId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (custId) {
    const cust = await getStripe().customers.retrieve(custId);
    if (!("deleted" in cust && cust.deleted) && cust.metadata?.user_id) {
      return cust.metadata.user_id as BillingUserKey;
    }
  }
  return null;
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  if (event.type !== "invoice.paid") return;

  const invoice = event.data.object as InvoiceWithSubscription;
  if (!invoice.id || invoice.amount_paid <= 0) return;
  // AI : first subscription payment is credited via confirmCheckoutSession — renewals only here.
  if (invoice.billing_reason !== "subscription_cycle") return;

  const userId = await resolveInvoiceUserId(invoice);
  if (!userId) {
    billLog.warn(`invoice.paid missing user reference`, { invoiceId: invoice.id });
    return;
  }

  const creditCents = toWholeCents(invoice.amount_paid);
  if (creditCents !== SUB_CENTS_PER_MONTH) {
    billLog.warn(`invoice.paid unexpected amount — skipping credit`, {
      invoiceId: invoice.id,
      userId,
      amountPaid: invoice.amount_paid,
      expected: SUB_CENTS_PER_MONTH,
    });
    return;
  }

  const creditKey = `inv_${invoice.id}`;
  await claimBillingCredit(userId, creditKey, creditCents, "invoice", true);
  billLog.info(`invoice.paid credited`, { invoiceId: invoice.id, userId, creditCents });
}

export function verifyStripeWebhookPayload(body: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
  if (!signature) throw new Error("Missing stripe-signature header");
  return getStripe().webhooks.constructEvent(body, signature, secret);
}

// AI : paid credit ledger for Billing tab — RLS-scoped read via service role after auth gate.
export async function loadBillingCreditHistory(key: BillingUserKey): Promise<BillingCreditHistoryEntry[]> {
  const admin = await createAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("billing_credit_ledger")
      .select("credit_key, amount_cents, source, created_at")
      .eq("user_id", key)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      return data.map((row) => ({
        creditKey: row.credit_key as string,
        amountCents: Number(row.amount_cents),
        source: row.source as BillingCreditHistoryEntry["source"],
        createdAt: row.created_at as string,
      }));
    }
    if (error && !isMissingCreditLedgerTable(error)) {
      billLog.warn(`loadBillingCreditHistory failed`, { key, error: error.message });
    }
  }
  return [];
}
