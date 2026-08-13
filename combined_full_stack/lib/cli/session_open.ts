// AI : one session factory for CLI/TUI — --offline throws; SPINE_API_URL uses the same HTTP as the GUI.

import { createSpineSession, type SpineSession } from "@/lib/core/session"
import {
  createApiEgress,
  createThrowingEgress,
  SPINE_API_TOKEN_ENV,
  SPINE_API_URL_ENV,
} from "@/lib/core/transport"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"

export function openCliSession(flags: Record<string, string | boolean>): SpineSession {
  const persist = createFilePersist(resolveSessionPath(typeof flags.session === "string" ? flags.session : undefined))
  if (flags.offline === true) {
    return createSpineSession({ persist, egress: createThrowingEgress() })
  }
  const url = process.env[SPINE_API_URL_ENV]
  if (url) {
    return createSpineSession({
      persist,
      egress: createApiEgress(url, process.env[SPINE_API_TOKEN_ENV]),
    })
  }
  return createSpineSession({ persist })
}

export async function attachCliRealtime(session: SpineSession): Promise<() => void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || session.egress?.blocked) return () => undefined
  const { createClient } = await import("@supabase/supabase-js")
  const { createSupabaseRealtimePort } = await import("@/lib/core/realtime")
  const { port } = await createSupabaseRealtimePort(createClient(url, key))
  return session.attachRealtime(port, {
    onProjectsChanged: () => {
      void session.pullRemoteState()
    },
    onRunsChanged: () => {
      void session.pullRemoteState()
    },
    onMembershipChanged: () => undefined,
  })
}
