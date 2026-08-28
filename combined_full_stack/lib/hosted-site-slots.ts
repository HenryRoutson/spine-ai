export const HOSTED_SITE_RUN_SLOT = "{{run}}"
export const HOSTED_SITE_AUTH_SLOT = "{{auth}}"
export const HOSTED_SITE_OUTPUT_SLOT = "{{output}}"
export const HOSTED_SITE_CHATBOT_SLOT = "{{chatbot}}"
export const HOSTED_SITE_DOCS_SLOT = "{{docs}}"
export const HOSTED_SITE_PAY_SLOT = "{{pay}}"
export const HOSTED_SITE_TABLE_SLOT = "{{table}}"

// AI : TODO (spine-in-spine-bootstrap-S4-dag) — parse {{slot:<widget>}} like {{table:Model}}
// AI :   (pipeline-dag | type-expr | step-trace | code). Do not add a second slot tokenizer.
// AI : TODO (spine-in-spine-bootstrap-S3-actions) — no new token required: hosted buttons use
// AI :   data-spine-id (SPINE_ACTION_ATTR) and dispatch SESSION_ACTIONS. Wire the click in the viewer.
export type hosted_site_widget_slot = "run" | "auth" | "output" | "chatbot" | "docs" | "pay" | "table"

export const HOSTED_SITE_SLOT_CLASS: Record<hosted_site_widget_slot, string> = {
  run: "hs-run-slot",
  auth: "hs-auth-slot",
  output: "hs-output-slot",
  chatbot: "hs-chatbot-slot",
  docs: "hs-docs-slot",
  pay: "hs-pay-slot",
  table: "hs-table-slot",
}

export const HOSTED_SITE_SLOT_TOKEN: Record<hosted_site_widget_slot, string> = {
  run: HOSTED_SITE_RUN_SLOT,
  auth: HOSTED_SITE_AUTH_SLOT,
  output: HOSTED_SITE_OUTPUT_SLOT,
  chatbot: HOSTED_SITE_CHATBOT_SLOT,
  docs: HOSTED_SITE_DOCS_SLOT,
  pay: HOSTED_SITE_PAY_SLOT,
  table: HOSTED_SITE_TABLE_SLOT,
}

export const HOSTED_SITE_IGNORED_SLOT_SELECTOR = Object.values(HOSTED_SITE_SLOT_CLASS)
  .map((cls) => `.${cls}`)
  .join(", ")

const SLOT_SPLIT_RE =
  /(\{\{(?:run(?::[a-z0-9_-]+)?|table(?::[A-Za-z][A-Za-z0-9_]*)?|auth|output|chatbot|docs|pay)\}\})/g

const TOKEN_TO_SLOT: Record<string, hosted_site_widget_slot> = {
  [HOSTED_SITE_RUN_SLOT]: "run",
  [HOSTED_SITE_AUTH_SLOT]: "auth",
  [HOSTED_SITE_OUTPUT_SLOT]: "output",
  [HOSTED_SITE_CHATBOT_SLOT]: "chatbot",
  [HOSTED_SITE_DOCS_SLOT]: "docs",
  [HOSTED_SITE_PAY_SLOT]: "pay",
  [HOSTED_SITE_TABLE_SLOT]: "table",
}

const RUN_ALIAS_RE = /^\{\{run:([a-z0-9_-]+)\}\}$/
const TABLE_ALIAS_RE = /^\{\{table:([A-Za-z][A-Za-z0-9_]*)\}\}$/

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
    const tableNamed = part.match(TABLE_ALIAS_RE)
    if (tableNamed?.[1]) {
      segments.push({ kind: "slot", slot: "table", alias: tableNamed[1] })
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
