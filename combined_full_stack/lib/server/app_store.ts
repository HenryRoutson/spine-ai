import { createClient } from "@/utils/supabase/server";
import { openStore, type JsonStore } from "./store";
import type { Store } from "./store";
import { openUserStore } from "./supabase_store";

// AI : one JsonStore per server process, stashed on globalThis — route handlers are
// AI : bundled separately in dev, so a plain module-level singleton is not enough, and
// AI : two independent stores would clobber each other's store.json on flush.
type StoreSlot = { __forgeStore?: Promise<JsonStore> };

function getJsonStore(): Promise<JsonStore> {
  const g = globalThis as StoreSlot;
  g.__forgeStore ??= openStore();
  return g.__forgeStore;
}

// AI : todo §7 — signed-in requests get a per-user SupabaseStore (RLS isolation, survives
// AI : Vercel's read-only fs); anonymous requests keep the shared local JsonStore so dev
// AI : works without an account. Mutating routes must `await store.flush()` when done.
export async function getStore(): Promise<Store> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) return openUserStore(supabase);
  return getJsonStore();
}
