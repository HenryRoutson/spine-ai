// AI : prod PostgREST can lag migrations — keep hosted site JSON in snapshot jsonb.
import type { HostedSiteOptions } from "@/lib/shared-link-types"
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import type { Project } from "./types"
import { storeErrorMessage } from "./errors"
import { logger } from "./server_logger"

const persistLog = logger("shared-link-persist")

export const SNAPSHOT_HOSTED_SITE_KEY = "hostedSite" as const

export type SharedLinkSnapshot = Project & { hostedSite?: HostedSiteOptions }

export type SchemaWriteError = { message?: string; code?: string }
export type SchemaWriteResult = { error: SchemaWriteError | null }

export function schemaCacheMissingColumn(error: unknown): string | null {
  const msg = storeErrorMessage(error, String(error))
  const quoted = /Could not find the '([^']+)' column/i.exec(msg)
  if (quoted?.[1]) return quoted[1]
  const pg =
    /column "([^"]+)" of relation/i.exec(msg) ?? /column "([^"]+)" does not exist/i.exec(msg)
  return pg?.[1] ?? null
}

function isEmptyJsonObject(value: unknown): boolean {
  if (value == null) return true
  if (typeof value !== "object" || Array.isArray(value)) return false
  return Object.keys(value).length === 0
}

export function withHostedSiteOnSnapshot(
  snapshot: Project,
  siteOptions: HostedSiteOptions,
): SharedLinkSnapshot {
  return { ...snapshot, [SNAPSHOT_HOSTED_SITE_KEY]: siteOptions }
}

export function stripHostedSiteFromSnapshot(snapshot: unknown): Project {
  const raw = (snapshot && typeof snapshot === "object" ? snapshot : {}) as SharedLinkSnapshot
  const { hostedSite: _hosted, ...project } = raw
  return project as Project
}

export function siteOptionsFromPersistence(
  siteOptionsCol: unknown,
  snapshot: unknown,
): HostedSiteOptions {
  const fromSnap =
    snapshot && typeof snapshot === "object"
      ? (snapshot as SharedLinkSnapshot)[SNAPSHOT_HOSTED_SITE_KEY]
      : undefined
  const fromCol = isEmptyJsonObject(siteOptionsCol) ? fromSnap : siteOptionsCol
  return normalizeHostedSiteOptions(fromCol ?? fromSnap)
}

export async function persistOmittingUnknownColumns(
  write: (row: Record<string, unknown>) => PromiseLike<{ error: unknown }>,
  row: Record<string, unknown>,
  maxStrips = 12,
): Promise<SchemaWriteResult> {
  const next: Record<string, unknown> = { ...row }
  for (let i = 0; i <= maxStrips; i++) {
    const { error } = await write(next)
    if (!error) return { error: null }
    const col = schemaCacheMissingColumn(error)
    if (!col || !Object.prototype.hasOwnProperty.call(next, col)) {
      return { error: error as SchemaWriteError }
    }
    persistLog.warn(`omitting unknown column from write`, { column: col })
    delete next[col]
    if (Object.keys(next).length === 0) return { error: error as SchemaWriteError }
  }
  return { error: { message: "schema cache column retry exhausted" } }
}
