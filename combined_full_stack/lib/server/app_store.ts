import { AUTH_SIGN_IN_REQUIRED } from "@/lib/auth-messages";
import { createClient } from "@/utils/supabase/server";
import { isProductionDeploy, isVercelWithoutSupabase, isLocalDevMode, type user_id_string } from "./require_auth";
import {
  ensureSeeded,
  ensureSeedDocs,
  backfillAllProjectSeedDocNames,
  purgeSeedTemplateProjects,
  syncAllUserProjectsFromSeeds,
  openStore,
  type JsonStore,
} from "./store";
import type { Store } from "./store";
import { logger } from "./server_logger";
import { isMissingSchemaError, openUserStore } from "./supabase_store";
import { storeErrorMessage } from "./errors";

const storeLog = logger("app-store");

// AI : one JsonStore per server process, stashed on globalThis — route handlers are
// AI : bundled separately in dev, so a plain module-level singleton is not enough, and
// AI : two independent stores would clobber each other's store.json on flush.
type StoreSlot = {
  __forgeStore?: Promise<JsonStore>;
  __forgeLocalStore?: Promise<Store>;
  __forgeUserStores?: Map<user_id_string, Promise<Store>>;
};

function getJsonStore(): Promise<JsonStore> {
  const g = globalThis as StoreSlot;
  g.__forgeStore ??= openStore();
  return g.__forgeStore;
}

async function getLocalStore(): Promise<Store> {
  const g = globalThis as StoreSlot;
  g.__forgeLocalStore ??= (async () => {
    const store = await getJsonStore();
    await ensureSeeded(store);
    return store;
  })();
  return g.__forgeLocalStore;
}

// AI : warm lambdas reuse one hydrated SupabaseStore per user — avoids reloading every row on each API call.
function getCachedUserStore(userId: user_id_string, open: () => Promise<Store>): Promise<Store> {
  const g = globalThis as StoreSlot;
  g.__forgeUserStores ??= new Map();
  let pending = g.__forgeUserStores.get(userId);
  if (!pending) {
    pending = open().catch((err) => {
      g.__forgeUserStores?.delete(userId);
      throw err;
    });
    g.__forgeUserStores.set(userId, pending);
  }
  return pending;
}

async function openSupabaseUserStore(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: user_id_string,
): Promise<Store> {
  return getCachedUserStore(userId, async () => {
    const store = await openUserStore(supabase, userId);
    return hydrateUserStore(store);
  });
}

async function hydrateUserStore(store: Store): Promise<Store> {
  purgeSeedTemplateProjects(store);
  await ensureSeedDocs(store);
  backfillAllProjectSeedDocNames(store);
  syncAllUserProjectsFromSeeds(store);
  await store.flush();
  return store;
}

// AI : signed-in requests get a per-user SupabaseStore (RLS isolation). Local dev without
// AI : Supabase keeps the shared JsonStore; production deploys reject unauthenticated access.
export async function getStore(): Promise<Store> {
  if (isVercelWithoutSupabase()) throw new Error("Supabase env vars required on Vercel");
  if (isProductionDeploy()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) throw new Error(AUTH_SIGN_IN_REQUIRED);
    const userId = data.claims.sub as user_id_string;
    storeLog.info(`authenticated user — SupabaseStore`, { sub: userId });
    return openSupabaseUserStore(supabase, userId);
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      const userId = data.claims.sub as user_id_string;
      storeLog.info(`authenticated user — trying SupabaseStore`, { sub: userId });
      try {
        storeLog.info(`using SupabaseStore`);
        return openSupabaseUserStore(supabase, userId);
      } catch (err) {
        storeLog.error(`SupabaseStore failed`, { error: storeErrorMessage(err, "Store load failed") });
        if (!isMissingSchemaError(err)) throw err;
      }
    }
  } catch (err) {
    storeLog.debug(`Supabase unavailable — local JsonStore`, { error: storeErrorMessage(err, "Store load failed") });
  }
  storeLog.debug(`using local JsonStore`);
  if (!isLocalDevMode()) throw new Error(AUTH_SIGN_IN_REQUIRED);
  return getLocalStore();
}
