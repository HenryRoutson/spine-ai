import { createClient } from "@/utils/supabase/server";
import { isProductionDeploy, isVercelWithoutSupabase } from "./require_auth";
import { ensureSeeded, openStore, type JsonStore } from "./store";
import type { Store } from "./store";
import { logger } from "./server_logger";
import { isMissingSchemaError, openUserStore } from "./supabase_store";

const storeLog = logger("app-store");

// AI : one JsonStore per server process, stashed on globalThis — route handlers are
// AI : bundled separately in dev, so a plain module-level singleton is not enough, and
// AI : two independent stores would clobber each other's store.json on flush.
type StoreSlot = { __forgeStore?: Promise<JsonStore> };

function storeErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return "Store load failed";
}

function getJsonStore(): Promise<JsonStore> {
  const g = globalThis as StoreSlot;
  g.__forgeStore ??= openStore();
  return g.__forgeStore;
}

async function getLocalStore(): Promise<Store> {
  const store = await getJsonStore();
  await ensureSeeded(store);
  return store;
}

// AI : signed-in requests get a per-user SupabaseStore (RLS isolation). Local dev without
// AI : Supabase keeps the shared JsonStore; production deploys reject unauthenticated access.
export async function getStore(): Promise<Store> {
  if (isVercelWithoutSupabase()) throw new Error("Supabase env vars required on Vercel");
  if (isProductionDeploy()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) throw new Error("Sign in required");
    storeLog.info(`authenticated user — SupabaseStore`, { sub: data.claims.sub });
    const store = await openUserStore(supabase);
    return store;
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) {
      storeLog.info(`authenticated user — trying SupabaseStore`, { sub: data.claims.sub });
      try {
        const store = await openUserStore(supabase);
        storeLog.info(`using SupabaseStore`);
        return store;
      } catch (err) {
        storeLog.error(`SupabaseStore failed`, { error: storeErrorMessage(err) });
        if (!isMissingSchemaError(err)) throw err;
      }
    }
  } catch (err) {
    storeLog.debug(`Supabase unavailable — local JsonStore`, { error: storeErrorMessage(err) });
  }
  storeLog.debug(`using local JsonStore`);
  return getLocalStore();
}
