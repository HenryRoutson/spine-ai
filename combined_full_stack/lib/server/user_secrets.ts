// AI : owner-scoped integration secrets — webhook env:VAR resolves here after process.env.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "@/lib/server/config";
import { createAdminClient } from "@/lib/server/supabase_admin";
import { isMissingSchemaError } from "@/lib/server/supabase_store";
import { type user_id_string } from "@/lib/server/require_auth";
import { logger } from "@/lib/server/server_logger";

const secretLog = logger("user-secrets");

export const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,127}$/;
export const MAX_SECRET_VALUE_CHARS = 8_000;

export type secret_name_string = string & { __brand: "secret_name" };
export type secret_value_string = string & { __brand: "secret_value" };

export type UserSecretPublic = {
  name: secret_name_string;
  hint: string;
  updatedAt: number;
};

type StoredUserSecret = UserSecretPublic & {
  userId: user_id_string;
  value: secret_value_string;
};

function isUuidUserId(userId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
}

function secretsDir(): string {
  return join(dataDir(), "user_secrets");
}

function secretFile(userId: user_id_string, name: secret_name_string): string {
  return join(secretsDir(), `${userId}_${name}.json`);
}

export function parseSecretName(raw: string): secret_name_string {
  const name = raw.trim();
  if (!SECRET_NAME_RE.test(name)) {
    throw new Error("Secret name must be UPPER_SNAKE_CASE (A-Z, 0-9, _)");
  }
  return name as secret_name_string;
}

export function secretHintOf(value: string): string {
  const v = value.trim();
  if (v.length <= 4) return "set";
  return v.slice(-4);
}

function toPublic(row: StoredUserSecret): UserSecretPublic {
  return { name: row.name, hint: row.hint, updatedAt: row.updatedAt };
}

function loadLocal(userId: user_id_string, name: secret_name_string): StoredUserSecret | null {
  const path = secretFile(userId, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as StoredUserSecret;
}

function saveLocal(row: StoredUserSecret): void {
  mkdirSync(secretsDir(), { recursive: true });
  writeFileSync(secretFile(row.userId, row.name), JSON.stringify(row, null, 2));
}

function listLocal(userId: user_id_string): StoredUserSecret[] {
  if (!existsSync(secretsDir())) return [];
  const prefix = `${userId}_`;
  return readdirSync(secretsDir())
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => {
      const name = f.slice(prefix.length, -5) as secret_name_string;
      return loadLocal(userId, name);
    })
    .filter((r): r is StoredUserSecret => r != null);
}

function rowFromDb(data: Record<string, unknown>): StoredUserSecret {
  return {
    userId: data.user_id as user_id_string,
    name: data.name as secret_name_string,
    value: data.value as secret_value_string,
    hint: typeof data.hint === "string" ? data.hint : "",
    updatedAt: Number(data.updated_at),
  };
}

export async function listUserSecrets(userId: user_id_string): Promise<UserSecretPublic[]> {
  const db = isUuidUserId(userId) ? await createAdminClient() : null;
  if (!db) return listLocal(userId).map(toPublic);
  const { data, error } = await db.from("user_secrets").select("name, hint, updated_at").eq("user_id", userId);
  if (error) {
    if (isMissingSchemaError(error)) return listLocal(userId).map(toPublic);
    throw error;
  }
  return (data ?? []).map((row) => ({
    name: row.name as secret_name_string,
    hint: (row.hint as string) ?? "",
    updatedAt: Number(row.updated_at),
  }));
}

export async function upsertUserSecret(
  userId: user_id_string,
  nameRaw: string,
  valueRaw: string,
): Promise<UserSecretPublic> {
  const name = parseSecretName(nameRaw);
  const value = valueRaw.trim();
  if (!value) throw new Error("Secret value is empty");
  if (value.length > MAX_SECRET_VALUE_CHARS) throw new Error("Secret value is too long");
  const row: StoredUserSecret = {
    userId,
    name,
    value: value as secret_value_string,
    hint: secretHintOf(value),
    updatedAt: Date.now(),
  };
  saveLocal(row);
  const db = isUuidUserId(userId) ? await createAdminClient() : null;
  if (db) {
    const { error } = await db.from("user_secrets").upsert({
      user_id: row.userId,
      name: row.name,
      value: row.value,
      hint: row.hint,
      updated_at: row.updatedAt,
    });
    if (error && !isMissingSchemaError(error)) throw error;
  }
  secretLog.info(`upsert secret`, { userId, name });
  return toPublic(row);
}

export async function deleteUserSecret(userId: user_id_string, nameRaw: string): Promise<boolean> {
  const name = parseSecretName(nameRaw);
  const path = secretFile(userId, name);
  const hadLocal = existsSync(path);
  if (hadLocal) unlinkSync(path);
  const db = isUuidUserId(userId) ? await createAdminClient() : null;
  if (db) {
    const { error } = await db.from("user_secrets").delete().eq("user_id", userId).eq("name", name);
    if (error && !isMissingSchemaError(error)) throw error;
  }
  return hadLocal || !!db;
}

export async function secretEnvForUser(userId: user_id_string): Promise<Record<string, string>> {
  const db = isUuidUserId(userId) ? await createAdminClient() : null;
  if (!db) {
    const out: Record<string, string> = {};
    for (const row of listLocal(userId)) out[row.name] = row.value;
    return out;
  }
  const { data, error } = await db.from("user_secrets").select("name, value").eq("user_id", userId);
  if (error) {
    if (isMissingSchemaError(error)) {
      const out: Record<string, string> = {};
      for (const row of listLocal(userId)) out[row.name] = row.value;
      return out;
    }
    throw error;
  }
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    const name = typeof row.name === "string" ? row.name : "";
    const value = typeof row.value === "string" ? row.value : "";
    if (name && value) out[name] = value;
  }
  return out;
}

export async function loadWebhookSecretEnv(cacheOwnerId: string | undefined): Promise<Record<string, string>> {
  const id = cacheOwnerId?.trim();
  if (!id || id === "local" || id.includes(":")) return {};
  return secretEnvForUser(id as user_id_string);
}
