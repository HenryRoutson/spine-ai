// AI : team secrets — admins set values; members get present names only (no hint/value).
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { dataDir } from "@/lib/server/config"
import { createAdminClient } from "@/lib/server/supabase_admin"
import { isMissingSchemaError } from "@/lib/server/supabase_store"
import { type user_id_string } from "@/lib/server/require_auth"
import {
  MAX_SECRET_VALUE_CHARS,
  parseSecretName,
  secretHintOf,
  type secret_name_string,
  type secret_value_string,
  type UserSecretPublic,
} from "@/lib/server/user_secrets"
import { listTeamsForUser } from "@/lib/server/teams"
import { TeamRole, type team_id_string } from "@/lib/team-types"
import { logger } from "@/lib/server/server_logger"

const teamSecretLog = logger("team-secrets")

export type TeamSecretPublic = UserSecretPublic & { source: "team" }

export type TeamSecretPresence = {
  name: secret_name_string
  present: true
  source: "team"
}

type StoredTeamSecret = {
  teamId: team_id_string
  name: secret_name_string
  value: secret_value_string
  hint: string
  updatedAt: number
  updatedBy: user_id_string
}

function isUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

function teamSecretsDir(): string {
  return join(dataDir(), "team_secrets")
}

function teamSecretFile(teamId: team_id_string, name: secret_name_string): string {
  return join(teamSecretsDir(), `${teamId}_${name}.json`)
}

function loadLocal(teamId: team_id_string, name: secret_name_string): StoredTeamSecret | null {
  const path = teamSecretFile(teamId, name)
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf8")) as StoredTeamSecret
}

function saveLocal(row: StoredTeamSecret): void {
  mkdirSync(teamSecretsDir(), { recursive: true })
  writeFileSync(teamSecretFile(row.teamId, row.name), JSON.stringify(row, null, 2))
}

function listLocal(teamId: team_id_string): StoredTeamSecret[] {
  if (!existsSync(teamSecretsDir())) return []
  const prefix = `${teamId}_`
  return readdirSync(teamSecretsDir())
    .filter((f) => f.startsWith(prefix) && f.endsWith(".json"))
    .map((f) => {
      const name = f.slice(prefix.length, -5) as secret_name_string
      return loadLocal(teamId, name)
    })
    .filter((r): r is StoredTeamSecret => r != null)
}

export async function teamRoleForUser(
  teamId: team_id_string,
  userId: user_id_string,
): Promise<TeamRole | null> {
  const teams = await listTeamsForUser(userId)
  return teams.find((t) => t.id === teamId)?.role ?? null
}

export function canEditTeamSecrets(role: TeamRole | null): boolean {
  return role === TeamRole.Owner || role === TeamRole.Admin
}

async function listTeamSecretsStored(teamId: team_id_string): Promise<StoredTeamSecret[]> {
  const db = isUuid(teamId) ? await createAdminClient() : null
  if (!db) return listLocal(teamId)
  const { data, error } = await db
    .from("team_secrets")
    .select("team_id, name, value, hint, updated_at, updated_by")
    .eq("team_id", teamId)
  if (error) {
    if (isMissingSchemaError(error)) return listLocal(teamId)
    throw error
  }
  return (data ?? []).map((row) => ({
    teamId: row.team_id as team_id_string,
    name: row.name as secret_name_string,
    value: row.value as secret_value_string,
    hint: (row.hint as string) ?? "",
    updatedAt: Number(row.updated_at),
    updatedBy: (row.updated_by as user_id_string) ?? ("" as user_id_string),
  }))
}

export async function listTeamSecretsPublic(
  teamId: team_id_string,
  viewerId: user_id_string,
): Promise<{ rows: TeamSecretPublic[]; presence: TeamSecretPresence[]; canEdit: boolean }> {
  const role = await teamRoleForUser(teamId, viewerId)
  if (!role) return { rows: [], presence: [], canEdit: false }
  const canEdit = canEditTeamSecrets(role)
  const stored = await listTeamSecretsStored(teamId)
  if (canEdit) {
    const rows: TeamSecretPublic[] = stored.map((r) => ({
      name: r.name,
      hint: r.hint,
      updatedAt: r.updatedAt,
      source: "team",
    }))
    return {
      rows,
      presence: rows.map((r) => ({ name: r.name, present: true, source: "team" })),
      canEdit: true,
    }
  }
  // AI : members — names only, no hint/value visibility.
  return {
    rows: [],
    presence: stored.map((r) => ({ name: r.name, present: true as const, source: "team" as const })),
    canEdit: false,
  }
}

export async function secretEnvForTeam(teamId: team_id_string | undefined | null): Promise<Record<string, string>> {
  if (!teamId) return {}
  const stored = await listTeamSecretsStored(teamId)
  const out: Record<string, string> = {}
  for (const row of stored) out[row.name] = row.value
  return out
}

export async function upsertTeamSecret(
  teamId: team_id_string,
  userId: user_id_string,
  nameRaw: string,
  valueRaw: string,
): Promise<TeamSecretPublic> {
  const role = await teamRoleForUser(teamId, userId)
  if (!canEditTeamSecrets(role)) throw new Error("Only team owners and admins can set team secrets.")
  const name = parseSecretName(nameRaw)
  const value = valueRaw.trim()
  if (!value) throw new Error("Secret value is empty")
  if (value.length > MAX_SECRET_VALUE_CHARS) throw new Error("Secret value is too long")
  const row: StoredTeamSecret = {
    teamId,
    name,
    value: value as secret_value_string,
    hint: secretHintOf(value),
    updatedAt: Date.now(),
    updatedBy: userId,
  }
  saveLocal(row)
  const db = isUuid(teamId) ? await createAdminClient() : null
  if (db) {
    const { error } = await db.from("team_secrets").upsert({
      team_id: row.teamId,
      name: row.name,
      value: row.value,
      hint: row.hint,
      updated_at: row.updatedAt,
      updated_by: row.updatedBy,
    })
    if (error && !isMissingSchemaError(error)) throw error
  }
  teamSecretLog.info(`upsert team secret`, { teamId, name })
  return { name: row.name, hint: row.hint, updatedAt: row.updatedAt, source: "team" }
}

export async function deleteTeamSecret(
  teamId: team_id_string,
  userId: user_id_string,
  nameRaw: string,
): Promise<boolean> {
  const role = await teamRoleForUser(teamId, userId)
  if (!canEditTeamSecrets(role)) throw new Error("Only team owners and admins can delete team secrets.")
  const name = parseSecretName(nameRaw)
  const path = teamSecretFile(teamId, name)
  const hadLocal = existsSync(path)
  if (hadLocal) unlinkSync(path)
  const db = isUuid(teamId) ? await createAdminClient() : null
  if (db) {
    const { error } = await db.from("team_secrets").delete().eq("team_id", teamId).eq("name", name)
    if (error && !isMissingSchemaError(error)) throw error
  }
  return hadLocal || !!db
}
