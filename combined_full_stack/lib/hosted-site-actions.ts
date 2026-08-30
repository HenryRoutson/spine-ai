// AI : hosted {{action:alias}} buttons — label, trigger JSON, and SQL table come from site options.

import { parseAppSql } from "@/lib/app-sql"
import type { PipelineModule } from "@/lib/types"

export type hosted_action_alias = string

export type HostedSiteActionBinding = {
  alias: hosted_action_alias
  label: string
  title?: string
  table?: string
  pipelineAlias?: string
  // AI : run this function on the bound project — not the active modules copy.
  functionId?: string
  payload?: Record<string, unknown>
}

const ALIAS_RE = /^[a-z][a-z0-9_-]{0,39}$/

export function isHostedActionAlias(raw: string): raw is hosted_action_alias {
  return ALIAS_RE.test(raw)
}

export function humanizeActionAlias(alias: string): string {
  const trimmed = alias.trim()
  if (!trimmed) return "Run"
  return trimmed
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function slugActionAlias(raw: string, used: Iterable<string> = []): hosted_action_alias {
  const taken = new Set(used)
  const stripped = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/^[^a-z]+/, "")
  let core: string = stripped.slice(0, 40)
  if (!isHostedActionAlias(core)) core = "action"
  if (!taken.has(core)) return core
  for (let n = 2; n < 100; n++) {
    const suffix = `-${n}`
    const next = `${core.slice(0, Math.max(1, 40 - suffix.length))}${suffix}`
    if (isHostedActionAlias(next) && !taken.has(next)) return next
  }
  return "action"
}

export function actionPageTag(alias: string): string {
  return `{{action:${alias}}}`
}

export function defaultHostedAction(alias: string): HostedSiteActionBinding {
  const key = isHostedActionAlias(alias) ? alias : "run"
  return {
    alias: key,
    label: humanizeActionAlias(key),
    payload: { action: key },
  }
}

export function normalizeHostedSiteActions(raw: unknown): HostedSiteActionBinding[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: HostedSiteActionBinding[] = []
  for (const row of raw.slice(0, 24)) {
    if (!row || typeof row !== "object") continue
    const rec = row as Record<string, unknown>
    const alias = typeof rec.alias === "string" ? rec.alias.trim().toLowerCase() : ""
    if (!isHostedActionAlias(alias) || used.has(alias)) continue
    used.add(alias)
    const label =
      typeof rec.label === "string" && rec.label.trim()
        ? rec.label.trim().slice(0, 80)
        : humanizeActionAlias(alias)
    const title = typeof rec.title === "string" && rec.title.trim() ? rec.title.trim().slice(0, 80) : undefined
    const table = typeof rec.table === "string" && rec.table.trim() ? rec.table.trim().slice(0, 64) : undefined
    const pipelineAlias =
      typeof rec.pipelineAlias === "string" && rec.pipelineAlias.trim()
        ? rec.pipelineAlias.trim().slice(0, 40)
        : undefined
    const functionId =
      typeof rec.functionId === "string" && rec.functionId.trim() ? rec.functionId.trim().slice(0, 128) : undefined
    const payload =
      rec.payload && typeof rec.payload === "object" && !Array.isArray(rec.payload)
        ? (rec.payload as Record<string, unknown>)
        : { action: alias }
    out.push({ alias, label, title, table, pipelineAlias, functionId, payload })
  }
  return out
}

export function hostedActionBinding(
  actions: HostedSiteActionBinding[],
  alias?: string | null,
): HostedSiteActionBinding {
  const key = (alias ?? "").trim().toLowerCase()
  if (key && key !== "run") {
    const hit = actions.find((a) => a.alias === key)
    if (hit) return hit
    return defaultHostedAction(key)
  }
  return actions[0] ?? defaultHostedAction(key || "run")
}

export function hostedActionButtonLabel(
  alias?: string | null,
  actions: HostedSiteActionBinding[] = [],
): string {
  return hostedActionBinding(actions, alias).label
}

export function hostedActionCardTitle(binding: HostedSiteActionBinding): string {
  return binding.title?.trim() || binding.label
}

export function hostedActionPayload(binding: HostedSiteActionBinding): Record<string, unknown> {
  const payload = binding.payload && typeof binding.payload === "object" ? { ...binding.payload } : {}
  if (!("action" in payload)) payload.action = binding.alias
  return payload
}

export function inferSqlTableFromModules(modules: PipelineModule[]): string | undefined {
  for (const m of modules) {
    const sql = m.sql?.trim()
    if (!sql) continue
    try {
      const parsed = parseAppSql(sql)
      if (parsed.table) return parsed.table
    } catch {
      continue
    }
  }
  return undefined
}

export function hostedActionTable(
  binding: HostedSiteActionBinding,
  modules: PipelineModule[] = [],
): string | undefined {
  return binding.table?.trim() || inferSqlTableFromModules(modules)
}
