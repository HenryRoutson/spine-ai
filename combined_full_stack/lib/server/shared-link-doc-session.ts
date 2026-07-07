import { isLocalDevMode, LOCAL_DEV_USER_ID, optionalAuthSession, type user_id_string } from "@/lib/server/require_auth";
import { getSupabasePublicEnv } from "@/utils/supabase/env";
import { parseSharedSessionId } from "@/lib/server/shared-link-session";

type shared_link_doc_session_link = { ownerId: user_id_string };

// AI : owner replay auth — real Supabase session, or local JsonStore single-user identity (not anonymous viewers).
async function userIdForOwnerReplay(): Promise<user_id_string | null> {
  const auth = await optionalAuthSession();
  if (auth) return auth.userId;
  if (isLocalDevMode() && !getSupabasePublicEnv()) return LOCAL_DEV_USER_ID;
  return null;
}

// AI : public runs use the session cookie; link owners replay historical runs via ?sessionId=.
export async function resolveSharedDocSessionForRequest(
  link: shared_link_doc_session_link,
  querySessionId: string | null | undefined,
  cookieSessionId: string | undefined,
): Promise<string | undefined> {
  const fromQuery = parseSharedSessionId(querySessionId ?? undefined);
  if (fromQuery) {
    if (fromQuery === cookieSessionId) return fromQuery;
    const ownerId = await userIdForOwnerReplay();
    if (ownerId === link.ownerId) return fromQuery;
    // AI : ignore stale/tampered ?sessionId= for viewers — fall back to their cookie session.
  }
  return cookieSessionId;
}
