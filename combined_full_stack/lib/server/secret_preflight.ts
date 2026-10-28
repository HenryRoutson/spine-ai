// AI : fail closed on missing webhook auth/URL secrets before any inference step runs.
import type { PipelineModule } from "@/lib/types"
import {
  collectSecretRequirements,
  formatMissingSecretsError,
  missingRequiredSecrets,
  secretValuePresent,
  type SecretRequirementStatus,
} from "@/lib/webhook-step"
import { loadWebhookSecretEnv, secretEnvForUser } from "@/lib/server/user_secrets"
import { secretEnvForTeam } from "@/lib/server/team_secrets"
import {
  overlayProjectPrefixedSecrets,
  projectSecretPrefix,
  type project_secret_prefix,
} from "@/lib/secret-scope"
import type { team_id_string } from "@/lib/team-types"
import type { user_id_string } from "@/lib/server/require_auth"

export type SecretEnvOpts = {
  teamId?: team_id_string | null
  projectName?: string | null
  // AI : shared-pointer owner — project-prefixed keys live on the owner vault.
  projectOwnerId?: user_id_string | string | null
}

export async function mergedSecretEnv(
  cacheOwnerId: string | undefined,
  opts: SecretEnvOpts = {},
): Promise<Record<string, string | undefined>> {
  const runner = await loadWebhookSecretEnv(cacheOwnerId)
  const ownerId = opts.projectOwnerId?.trim()
  const owner =
    ownerId && ownerId !== cacheOwnerId ? await secretEnvForUser(ownerId as user_id_string) : {}
  const team = await secretEnvForTeam(opts.teamId ?? null)
  // AI : resolve order — process.env < team < owner vault < runner vault; then PREFIX_KEY → KEY.
  let merged: Record<string, string> = {
    ...team,
    ...owner,
    ...runner,
  }
  const name = opts.projectName?.trim()
  if (name) {
    const prefix: project_secret_prefix = projectSecretPrefix(name)
    merged = overlayProjectPrefixedSecrets(merged, prefix)
  }
  return { ...process.env, ...merged }
}

export async function missingRequiredSecretsError(
  modules: PipelineModule[],
  cacheOwnerId: string | undefined,
  opts: SecretEnvOpts = {},
): Promise<string | null> {
  const env = await mergedSecretEnv(cacheOwnerId, opts)
  const missing = missingRequiredSecrets(modules, env)
  if (missing.length === 0) return null
  return formatMissingSecretsError(missing)
}

export async function secretRequirementStatusesFor(
  modules: PipelineModule[],
  cacheOwnerId: string | undefined,
  opts: SecretEnvOpts = {},
): Promise<SecretRequirementStatus[]> {
  const env = await mergedSecretEnv(cacheOwnerId, opts)
  return collectSecretRequirements(modules).map((r) => ({
    ...r,
    // AI : defaults satisfy resolve at runtime but are not "set" for Secrets tab status.
    present: secretValuePresent(env, r.name),
  }))
}
