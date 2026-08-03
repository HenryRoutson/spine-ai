import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { DEMO_ACCOUNT_EMAIL } from "@/lib/demo-constants"
import { isDemoMode } from "@/lib/demo-mode"
import {
  readSettingsAccountSnapshot,
  writeSettingsAccountSnapshot,
  type SettingsAccountSnapshot,
} from "@/lib/settings-account-snapshot-cache"
import { readTeamsSnapshot, writeTeamsSnapshot } from "@/lib/teams-snapshot-cache"
import type { TeamView, TeamsListResponse } from "@/lib/team-types"
import { createClient } from "@/utils/supabase/client"

let accountFetchRef: Promise<SettingsAccountSnapshot> | null = null
let teamsFetchRef: Promise<TeamView[]> | null = null

export async function fetchSettingsAccount(): Promise<SettingsAccountSnapshot> {
  if (accountFetchRef) return accountFetchRef
  if (isDemoMode()) {
    const demo = { email: DEMO_ACCOUNT_EMAIL, marketingOptIn: false }
    writeSettingsAccountSnapshot(demo)
    return demo
  }
  const run = createClient()
    .then((supabase) => supabase.auth.getUser())
    .then(({ data }) => {
      const next = {
        email: data.user?.email ?? null,
        marketingOptIn: data.user?.user_metadata?.marketing_opt_in === true,
      }
      writeSettingsAccountSnapshot(next)
      return next
    })
  accountFetchRef = run.finally(() => {
    accountFetchRef = null
  })
  return run
}

export function warmSettingsAccount(): Promise<void> {
  return fetchSettingsAccount().then(() => {})
}

export async function fetchTeams(): Promise<TeamView[]> {
  if (teamsFetchRef) return teamsFetchRef
  if (isDemoMode()) return readTeamsSnapshot() ?? []
  const run = apiJson<TeamsListResponse>(API_ROUTES.teams).then((body) => {
    writeTeamsSnapshot(body.teams)
    return body.teams
  })
  teamsFetchRef = run.finally(() => {
    teamsFetchRef = null
  })
  return run
}

export function warmSettingsTeams(): Promise<void> {
  return fetchTeams().then(() => {})
}

export function patchSettingsAccountMarketingOptIn(marketingOptIn: boolean): void {
  const prev = readSettingsAccountSnapshot()
  writeSettingsAccountSnapshot({
    email: prev?.email ?? null,
    marketingOptIn,
  })
}
