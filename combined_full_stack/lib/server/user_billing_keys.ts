import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { uid } from "@/lib/id";
import { dataDir } from "@/lib/server/config";
import { createAdminClient } from "@/lib/server/supabase_admin";
import { isExpectedAuthSkewError, isMissingSchemaError } from "@/lib/server/supabase_store";
import { LOCAL_DEV_USER_ID, type user_id_string } from "@/lib/server/require_auth";
import { logger } from "@/lib/server/server_logger";

const keyLog = logger("user-billing-keys");

export type UserBillingKeyId = string & { __brand: "UserBillingKeyId" };

export type UserBillingKeyRecord = {
  id: UserBillingKeyId;
  label: string;
  keyPrefix: string;
  createdAt: number;
  revoked: boolean;
};

export type UserBillingKeyCreateResult = UserBillingKeyRecord & { key: string };

export class UserBillingKeyError extends Error {
  constructor(readonly code: "invalid_key") {
    super("Invalid billing key.");
  }
}

type StoredUserBillingKey = UserBillingKeyRecord & {
  userId: user_id_string;
  keyHash: string;
};

const KEY_PREFIX = "bill_";
const RAW_KEY_PREFIX = "spine_bill_";
const AUTH_SKEW_RETRY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keysDir(): string {
  return join(dataDir(), "user_billing_keys");
}

function keyFile(userId: user_id_string, id: UserBillingKeyId): string {
  return join(keysDir(), `${userId}_${id}.json`);
}

function hashBillingKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateUserBillingKey(): { key: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const key = `${RAW_KEY_PREFIX}${raw}`;
  return { key, prefix: key.slice(0, 18), hash: hashBillingKey(key) };
}

function newUserBillingKeyId(): UserBillingKeyId {
  return uid<UserBillingKeyId>(KEY_PREFIX);
}

function loadLocalKey(userId: user_id_string, id: UserBillingKeyId): StoredUserBillingKey | null {
  const path = keyFile(userId, id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StoredUserBillingKey;
}

function saveLocalKey(row: StoredUserBillingKey): void {
  mkdirSync(keysDir(), { recursive: true });
  writeFileSync(keyFile(row.userId, row.id), JSON.stringify(row, null, 2));
}

function listLocalKeys(userId: user_id_string): UserBillingKeyRecord[] {
  if (!existsSync(keysDir())) return [];
  return readdirSync(keysDir())
    .filter((f) => f.startsWith(`${userId}_`) && f.endsWith(".json"))
    .map((f) => {
      const id = f.slice(userId.length + 1, -5) as UserBillingKeyId;
      return loadLocalKey(userId, id);
    })
    .filter((r): r is StoredUserBillingKey => r != null && !r.revoked)
    .map(toPublicRecord);
}

function toPublicRecord(row: StoredUserBillingKey): UserBillingKeyRecord {
  return {
    id: row.id,
    label: row.label,
    keyPrefix: row.keyPrefix,
    createdAt: row.createdAt,
    revoked: row.revoked,
  };
}

async function loadSupabaseKeyByHash(hash: string): Promise<StoredUserBillingKey | null> {
  const db = await createAdminClient();
  if (!db) return null;
  const { data, error } = await db
    .from("user_billing_keys")
    .select("*")
    .eq("key_hash", hash)
    .eq("revoked", false)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return rowFromDb(data);
}

function rowFromDb(data: Record<string, unknown>): StoredUserBillingKey {
  return {
    id: data.id as UserBillingKeyId,
    userId: data.user_id as user_id_string,
    label: (data.label as string) ?? "default",
    keyHash: data.key_hash as string,
    keyPrefix: data.key_prefix as string,
    createdAt: Number(data.created_at),
    revoked: Boolean(data.revoked),
  };
}

function findLocalKeyByHash(hash: string): StoredUserBillingKey | null {
  if (!existsSync(keysDir())) return null;
  for (const f of readdirSync(keysDir()).filter((name) => name.endsWith(".json"))) {
    const row = JSON.parse(readFileSync(join(keysDir(), f), "utf8")) as StoredUserBillingKey;
    if (!row.revoked && row.keyHash === hash) return row;
  }
  return null;
}

export async function verifyUserBillingKey(key: string): Promise<user_id_string> {
  const hash = hashBillingKey(key);
  const local = findLocalKeyByHash(hash);
  if (local) return local.userId;
  const row = await loadSupabaseKeyByHash(hash);
  if (!row) throw new UserBillingKeyError("invalid_key");
  return row.userId;
}

export async function listUserBillingKeys(userId: user_id_string): Promise<UserBillingKeyRecord[]> {
  const db = await createAdminClient();
  if (!db) return listLocalKeys(userId);
  const query = () =>
    db.from("user_billing_keys").select("*").eq("user_id", userId).eq("revoked", false);
  let { data, error } = await query();
  if (error && isExpectedAuthSkewError(error)) {
    keyLog.warn(`listUserBillingKeys JWT skew — retrying`, { userId });
    await sleep(AUTH_SKEW_RETRY_MS);
    ({ data, error } = await query());
  }
  if (error) {
    if (isMissingSchemaError(error)) return listLocalKeys(userId);
    throw error;
  }
  return (data ?? []).map((row) => toPublicRecord(rowFromDb(row)));
}

export async function createUserBillingKey(
  userId: user_id_string,
  label?: string,
): Promise<UserBillingKeyCreateResult> {
  const id = newUserBillingKeyId();
  const { key, prefix, hash } = generateUserBillingKey();
  const row: StoredUserBillingKey = {
    id,
    userId,
    label: label?.trim() || "default",
    keyHash: hash,
    keyPrefix: prefix,
    createdAt: Date.now(),
    revoked: false,
  };
  saveLocalKey(row);
  const db = await createAdminClient();
  if (db) {
    const { error } = await db.from("user_billing_keys").upsert({
      id: row.id,
      user_id: row.userId,
      label: row.label,
      key_hash: row.keyHash,
      key_prefix: row.keyPrefix,
      revoked: false,
      created_at: row.createdAt,
    });
    if (error && !isMissingSchemaError(error)) throw error;
  }
  keyLog.info(`createUserBillingKey`, { userId, id, prefix });
  return { ...toPublicRecord(row), key };
}

export async function revokeUserBillingKey(
  userId: user_id_string,
  id: UserBillingKeyId,
): Promise<boolean> {
  const local = loadLocalKey(userId, id);
  if (local) {
    local.revoked = true;
    saveLocalKey(local);
  }
  const db = await createAdminClient();
  if (db) {
    await db.from("user_billing_keys").update({ revoked: true }).eq("user_id", userId).eq("id", id);
  }
  return !!local;
}

export function isLocalDevBillingKeyUser(userId: user_id_string): boolean {
  return userId === LOCAL_DEV_USER_ID;
}
