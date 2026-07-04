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
type StoreSlot = { __forgeStore?: Promise<JsonStore> };

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
    storeLog.info(`authenticated user — SupabaseStore`, { sub: data.claims.sub });
    const store = await openUserStore(supabase, data.claims.sub as user_id_string);
    return hydrateUserStore(store);
  }

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) {
      storeLog.info(`authenticated user — trying SupabaseStore`, { sub: data.claims.sub });
      try {
        const store = await openUserStore(supabase, data.claims.sub as user_id_string);
        storeLog.info(`using SupabaseStore`);
        return hydrateUserStore(store);
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
