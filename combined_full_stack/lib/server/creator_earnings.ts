import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  billingKeyForUser,
  loadBillingAccount,
  saveBillingAccount,
  type BillingUserKey,
} from "@/lib/server/billing_account";
import { dataDir } from "@/lib/server/config";
import { createAdminClient } from "@/lib/server/supabase_admin";
import { isMissingSchemaError } from "@/lib/server/supabase_store";
import { LOCAL_DEV_USER_ID, type user_id_string } from "@/lib/server/require_auth";
import { logger } from "@/lib/server/server_logger";

const earnLog = logger("creator-earnings");

export type CreatorEarnings = {
  balanceCents: number;
  totalEarnedCents: number;
  totalWithdrawnCents: number;
};

const EMPTY: CreatorEarnings = {
  balanceCents: 0,
  totalEarnedCents: 0,
  totalWithdrawnCents: 0,
};

function toExactCents(cents: number): number {
  return +Math.max(0, cents).toFixed(4);
}

function earningsFile(): string {
  return join(dataDir(), "creator_earnings.json");
}

function loadJsonEarnings(): Record<string, CreatorEarnings> {
  const path = earningsFile();
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, CreatorEarnings>;
}

function saveJsonEarnings(userId: user_id_string, row: CreatorEarnings): void {
  const path = earningsFile();
  mkdirSync(dataDir(), { recursive: true });
  const all = loadJsonEarnings();
  all[userId] = row;
  writeFileSync(path, JSON.stringify(all, null, 2));
}

function isLocalJsonUser(userId: user_id_string): boolean {
  return userId === LOCAL_DEV_USER_ID;
}

async function loadSupabaseEarnings(userId: user_id_string): Promise<CreatorEarnings | null> {
  const db = await createAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("creator_earnings")
    .select("balance_cents, total_earned_cents, total_withdrawn_cents")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return {
    balanceCents: Number(data.balance_cents ?? 0),
    totalEarnedCents: Number(data.total_earned_cents ?? 0),
    totalWithdrawnCents: Number(data.total_withdrawn_cents ?? 0),
  };
}

async function saveSupabaseEarnings(userId: user_id_string, row: CreatorEarnings): Promise<void> {
  const db = await createAdminClient();
  if (!db) throw new Error("Supabase required for creator earnings");
  const { error } = await db.from("creator_earnings").upsert({
    user_id: userId,
    balance_cents: toExactCents(row.balanceCents),
    total_earned_cents: toExactCents(row.totalEarnedCents),
    total_withdrawn_cents: toExactCents(row.totalWithdrawnCents),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function loadCreatorEarnings(userId: user_id_string): Promise<CreatorEarnings> {
  if (isLocalJsonUser(userId)) {
    return { ...EMPTY, ...loadJsonEarnings()[userId] };
  }
  const row = await loadSupabaseEarnings(userId);
  if (row) return row;
  return { ...EMPTY };
}

async function persistCreatorEarnings(userId: user_id_string, row: CreatorEarnings): Promise<void> {
  if (isLocalJsonUser(userId)) {
    saveJsonEarnings(userId, row);
    return;
  }
  try {
    await saveSupabaseEarnings(userId, row);
  } catch (err) {
    if (isMissingSchemaError(err as { message?: string; code?: string })) {
      saveJsonEarnings(userId, row);
      return;
    }
    throw err;
  }
}

export async function creditCreatorEarnings(
  userId: user_id_string,
  cents: number,
): Promise<CreatorEarnings> {
  const credit = toExactCents(cents);
  if (credit <= 0) return loadCreatorEarnings(userId);
  const current = await loadCreatorEarnings(userId);
  const next: CreatorEarnings = {
    balanceCents: toExactCents(current.balanceCents + credit),
    totalEarnedCents: toExactCents(current.totalEarnedCents + credit),
    totalWithdrawnCents: current.totalWithdrawnCents,
  };
  await persistCreatorEarnings(userId, next);
  earnLog.info(`creditCreatorEarnings`, { userId, credit, balanceAfter: next.balanceCents });
  return next;
}

export class CreatorEarningsError extends Error {
  constructor(readonly code: "insufficient_earnings") {
    super("Not enough earnings to withdraw.");
  }
}

// AI : MVP withdrawal — transfer earnings into usage credit balance (separate wallets, one user).
export async function withdrawCreatorEarningsToCredit(
  userId: user_id_string,
  cents: number,
): Promise<{ earnings: CreatorEarnings; creditBalanceCents: number }> {
  const amount = toExactCents(cents);
  if (amount <= 0) throw new CreatorEarningsError("insufficient_earnings");
  const current = await loadCreatorEarnings(userId);
  if (current.balanceCents < amount) throw new CreatorEarningsError("insufficient_earnings");

  const key = billingKeyForUser(userId) as BillingUserKey;
  const account = await loadBillingAccount(key);
  const nextAccount = {
    ...account,
    balanceCents: toExactCents(account.balanceCents + amount),
  };
  await saveBillingAccount(key, nextAccount);

  const nextEarnings: CreatorEarnings = {
    balanceCents: toExactCents(current.balanceCents - amount),
    totalEarnedCents: current.totalEarnedCents,
    totalWithdrawnCents: toExactCents(current.totalWithdrawnCents + amount),
  };
  await persistCreatorEarnings(userId, nextEarnings);
  earnLog.info(`withdrawCreatorEarningsToCredit`, {
    userId,
    amount,
    creditBalanceAfter: nextAccount.balanceCents,
    earningsBalanceAfter: nextEarnings.balanceCents,
  });
  return { earnings: nextEarnings, creditBalanceCents: nextAccount.balanceCents };
}
