import { createClient } from "@/utils/supabase/server";
import { ensureSeeded, openStore, type JsonStore } from "./store";
import type { Store } from "./store";
import { isMissingSchemaError, openUserStore } from "./supabase_store";

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

// AI : todo §7 — signed-in requests get a per-user SupabaseStore (RLS isolation, survives
// AI : Vercel's read-only fs); anonymous requests keep the shared local JsonStore so dev
// AI : works without an account. Mutating routes must `await store.flush()` when done.
export async function getStore(): Promise<Store> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) {
      try {
        return await openUserStore(supabase);
      } catch (err) {
        console.error("SupabaseStore failed:", storeErrorMessage(err));
        if (!isMissingSchemaError(err) && !process.env.VERCEL) throw err;
      }
    }
  } catch (err) {
    console.error("Supabase client failed:", storeErrorMessage(err));
    if (!process.env.VERCEL) throw err;
  }
  return getLocalStore();
}
