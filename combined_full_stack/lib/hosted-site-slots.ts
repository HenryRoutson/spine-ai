export const HOSTED_SITE_RUN_SLOT = "{{run}}"
export const HOSTED_SITE_AUTH_SLOT = "{{auth}}"
export const HOSTED_SITE_OUTPUT_SLOT = "{{output}}"
export const HOSTED_SITE_CHATBOT_SLOT = "{{chatbot}}"
export const HOSTED_SITE_DOCS_SLOT = "{{docs}}"
export const HOSTED_SITE_ACTION_SLOT = "{{action}}"

export type hosted_action_alias = string
export type hosted_action_trigger = "double" | "collatz"

export function hostedActionButtonLabel(alias?: hosted_action_alias): string {
  return alias === "collatz" ? "3n + 1" : "Double it"
}

export function hostedActionTrigger(alias?: hosted_action_alias): hosted_action_trigger {
  return alias === "collatz" ? "collatz" : "double"
}

export type hosted_site_widget_slot = "run" | "auth" | "output" | "chatbot" | "docs" | "sql" | "action"

export const HOSTED_SITE_SLOT_CLASS: Record<hosted_site_widget_slot, string> = {
  run: "hs-run-slot",
  auth: "hs-auth-slot",
  output: "hs-output-slot",
  chatbot: "hs-chatbot-slot",
  docs: "hs-docs-slot",
  sql: "hs-sql-slot",
  action: "hs-action-slot",
}

export const HOSTED_SITE_SLOT_TOKEN: Record<hosted_site_widget_slot, string> = {
  run: HOSTED_SITE_RUN_SLOT,
  auth: HOSTED_SITE_AUTH_SLOT,
  output: HOSTED_SITE_OUTPUT_SLOT,
  chatbot: HOSTED_SITE_CHATBOT_SLOT,
  docs: HOSTED_SITE_DOCS_SLOT,
  sql: "{{sql}}",
  action: HOSTED_SITE_ACTION_SLOT,
}

export const HOSTED_SITE_IGNORED_SLOT_SELECTOR = Object.values(HOSTED_SITE_SLOT_CLASS)
  .map((cls) => `.${cls}`)
  .join(", ")

const SLOT_SPLIT_RE =
  /(\{\{(?:run(?::[a-z0-9_-]+)?|auth|output|chatbot|docs|sql(?::[a-z0-9_]+)?|action(?::[a-z0-9_-]+)?)\}\})/g

const TOKEN_TO_SLOT: Record<string, hosted_site_widget_slot> = {
  [HOSTED_SITE_RUN_SLOT]: "run",
  [HOSTED_SITE_AUTH_SLOT]: "auth",
  [HOSTED_SITE_OUTPUT_SLOT]: "output",
  [HOSTED_SITE_CHATBOT_SLOT]: "chatbot",
  [HOSTED_SITE_DOCS_SLOT]: "docs",
  [HOSTED_SITE_ACTION_SLOT]: "action",
}

const RUN_ALIAS_RE = /^\{\{run:([a-z0-9_-]+)\}\}$/
const SQL_TABLE_RE = /^\{\{sql:([a-z0-9_]+)\}\}$/
const ACTION_ALIAS_RE = /^\{\{action:([a-z0-9_-]+)\}\}$/

export type HostedSiteHtmlSegment =
  | { kind: "html"; html: string }
  | { kind: "slot"; slot: hosted_site_widget_slot; alias?: string }

export function splitHostedSiteSlots(html: string): HostedSiteHtmlSegment[] {
  const parts = html.split(SLOT_SPLIT_RE)
  const segments: HostedSiteHtmlSegment[] = []
  for (const part of parts) {
    if (!part) continue
    const named = part.match(RUN_ALIAS_RE)
    if (named?.[1]) {
      segments.push({ kind: "slot", slot: "run", alias: named[1] })
      continue
    }
    const sql = part.match(SQL_TABLE_RE)
    if (sql?.[1]) {
      segments.push({ kind: "slot", slot: "sql", alias: sql[1] })
      continue
    }
    const action = part.match(ACTION_ALIAS_RE)
    if (action?.[1]) {
      segments.push({ kind: "slot", slot: "action", alias: action[1] })
      continue
    }
    const slot = TOKEN_TO_SLOT[part]
    segments.push(slot ? { kind: "slot", slot } : { kind: "html", html: part })
  }
  return segments.length > 0 ? segments : [{ kind: "html", html }]
}

export function hostedSitePrimarySlot(surface: "app" | "signin"): hosted_site_widget_slot {
  return surface === "signin" ? "auth" : "run"
}

export function hostedSiteHasPrimarySlot(
  segments: HostedSiteHtmlSegment[],
  surface: "app" | "signin",
): boolean {
  const primary = hostedSitePrimarySlot(surface)
  return segments.some((s) => {
    if (s.kind !== "slot") return false
    if (primary === "auth") return s.slot === "auth"
    if (s.slot === "action" && (!s.alias || s.alias === "run")) return true
    return s.slot === primary && (primary !== "run" || !s.alias || s.alias === "run")
  })
}
