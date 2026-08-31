import { inferSqlTableFromModules, type HostedSiteActionBinding } from "@/lib/hosted-site-actions"
import type { PipelineModule } from "@/lib/types"

export const HOSTED_SITE_RUN_SLOT = "{{run}}"
export const HOSTED_SITE_AUTH_SLOT = "{{auth}}"
export const HOSTED_SITE_OUTPUT_SLOT = "{{output}}"
export const HOSTED_SITE_CHATBOT_SLOT = "{{chatbot}}"
export const HOSTED_SITE_DOCS_SLOT = "{{docs}}"
export const HOSTED_SITE_ACTION_SLOT = "{{action}}"
export const HOSTED_SITE_PAY_SLOT = "{{pay}}"
export const HOSTED_SITE_TABLE_SLOT = "{{table}}"

export type { hosted_action_alias, HostedSiteActionBinding } from "@/lib/hosted-site-actions"
export {
  hostedActionButtonLabel,
  hostedActionBinding,
  humanizeActionAlias,
} from "@/lib/hosted-site-actions"

// AI : TODO (spine-in-spine-bootstrap-S4-dag) — parse {{slot:<widget>}} like {{table:Model}}
// AI :   (pipeline-dag | type-expr | step-trace | code). Do not add a second slot tokenizer.
// AI : TODO (spine-in-spine-full-F4-widgets) — full also needs vibe | structure | pipeline | testing |
// AI :   inference | documents | logging | share — each wraps the existing panel component.
// AI : TODO (spine-in-spine-bootstrap-S3-actions) — no new token required: hosted buttons use
// AI :   data-spine-id (SPINE_ACTION_ATTR) and dispatch SESSION_ACTIONS. Wire the click in the viewer.
export type hosted_site_widget_slot = "run" | "auth" | "output" | "chatbot" | "docs" | "sql" | "action" | "pay" | "table"

export const HOSTED_SITE_SLOT_CLASS: Record<hosted_site_widget_slot, string> = {
  run: "hs-run-slot",
  auth: "hs-auth-slot",
  output: "hs-output-slot",
  chatbot: "hs-chatbot-slot",
  docs: "hs-docs-slot",
  sql: "hs-sql-slot",
  action: "hs-action-slot",
  pay: "hs-pay-slot",
  table: "hs-table-slot",
}

export const HOSTED_SITE_SLOT_TOKEN: Record<hosted_site_widget_slot, string> = {
  run: HOSTED_SITE_RUN_SLOT,
  auth: HOSTED_SITE_AUTH_SLOT,
  output: HOSTED_SITE_OUTPUT_SLOT,
  chatbot: HOSTED_SITE_CHATBOT_SLOT,
  docs: HOSTED_SITE_DOCS_SLOT,
  sql: "{{sql}}",
  action: HOSTED_SITE_ACTION_SLOT,
  pay: HOSTED_SITE_PAY_SLOT,
  table: HOSTED_SITE_TABLE_SLOT,
}

export const HOSTED_SITE_IGNORED_SLOT_SELECTOR = Object.values(HOSTED_SITE_SLOT_CLASS)
  .map((cls) => `.${cls}`)
  .join(", ")

const SLOT_SPLIT_RE =
  /(\{\{(?:run(?::[a-z0-9_-]+)?|table(?::[A-Za-z][A-Za-z0-9_]*)?|auth|output|chatbot|docs|pay|sql(?::[a-z0-9_]+)?|action(?::[a-z0-9_-]+)?)\}\})/g

const TOKEN_TO_SLOT: Record<string, hosted_site_widget_slot> = {
  [HOSTED_SITE_RUN_SLOT]: "run",
  [HOSTED_SITE_AUTH_SLOT]: "auth",
  [HOSTED_SITE_OUTPUT_SLOT]: "output",
  [HOSTED_SITE_CHATBOT_SLOT]: "chatbot",
  [HOSTED_SITE_DOCS_SLOT]: "docs",
  [HOSTED_SITE_ACTION_SLOT]: "action",
  [HOSTED_SITE_PAY_SLOT]: "pay",
  [HOSTED_SITE_TABLE_SLOT]: "table",
}

const RUN_ALIAS_RE = /^\{\{run:([a-z0-9_-]+)\}\}$/
const SQL_TABLE_RE = /^\{\{sql:([a-z0-9_]+)\}\}$/
const ACTION_ALIAS_RE = /^\{\{action:([a-z0-9_-]+)\}\}$/
const TABLE_ALIAS_RE = /^\{\{table:([A-Za-z][A-Za-z0-9_]*)\}\}$/

export type HostedSiteHtmlSegment =
  | { kind: "html"; html: string }
  | { kind: "slot"; slot: hosted_site_widget_slot; alias?: string }

export type HostedSiteActionRowSegment = {
  kind: "action-row"
  slots: Array<Extract<HostedSiteHtmlSegment, { kind: "slot" }>>
}

export type HostedSiteRunRowSegment = {
  kind: "run-row"
  slots: Array<Extract<HostedSiteHtmlSegment, { kind: "slot" }>>
}

export type HostedSiteRenderSegment = HostedSiteHtmlSegment | HostedSiteActionRowSegment | HostedSiteRunRowSegment

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

// AI : {{action}} / {{run:alias}} tokens split the HTML tree, so adjacent widgets must be regrouped in React.
const ACTION_ROW_OPEN_RE = /<div\s+class=["']hs-action-row["']\s*>/gi
const COUNTER_OPEN_RE = /<section\b[^>]*\bhs-counter\b[^>]*>/gi
// AI : do not treat hs-split-heads as the run-row wrapper (word-boundary hits the hs-split prefix).
const SPLIT_OPEN_RE = /<section\b[^>]*\bhs-split(?![\w-])[^>]*>/gi

export function groupHostedActionSlots(segments: HostedSiteHtmlSegment[]): HostedSiteRenderSegment[] {
  const out: HostedSiteRenderSegment[] = []
  let i = 0
  while (i < segments.length) {
    const seg = segments[i]!
    if (seg.kind === "slot" && (seg.slot === "action" || seg.slot === "run")) {
      const slots: Array<Extract<HostedSiteHtmlSegment, { kind: "slot" }>> = [seg]
      let j = i + 1
      while (j < segments.length) {
        const next = segments[j]!
        if (next.kind === "slot" && next.slot === seg.slot) {
          slots.push(next)
          j += 1
          continue
        }
        if (next.kind === "html" && next.html.trim() === "") {
          j += 1
          continue
        }
        break
      }
      if (slots.length > 1) {
        out.push({ kind: seg.slot === "run" ? "run-row" : "action-row", slots })
      } else {
        out.push(slots[0]!)
      }
      i = j
      continue
    }
    out.push(seg)
    i += 1
  }
  return dropEmptyHtml(stripHostedActionRowMarkup(out))
}

// AI : leftover open/close hs-action-row / hs-split tags hydrate as invalid HTML against the React row.
function stripHostedActionRowMarkup(segments: HostedSiteRenderSegment[]): HostedSiteRenderSegment[] {
  return segments.map((seg, i, arr) => {
    if (seg.kind !== "html") return seg
    let html = seg.html.replace(ACTION_ROW_OPEN_RE, "").replace(COUNTER_OPEN_RE, "").replace(SPLIT_OPEN_RE, "")
    const prev = arr[i - 1]
    if (prev && (prev.kind === "action-row" || prev.kind === "run-row")) {
      html = html.replace(/^\s*<\/div>/, "").replace(/^\s*<\/section>/, "")
    }
    return { kind: "html", html }
  })
}

function dropEmptyHtml(segments: HostedSiteRenderSegment[]): HostedSiteRenderSegment[] {
  return segments.filter((seg) => seg.kind !== "html" || seg.html.trim() !== "")
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

// AI : studio/live SQL widgets key off {{sql:table}}, action.table, or the pipeline SQL step — never a demo table.
export function hostedSqlTableNames(
  htmlFragments: string[],
  actions: HostedSiteActionBinding[] = [],
  modules: PipelineModule[] = [],
): string[] {
  const tables = new Set<string>()
  for (const html of htmlFragments) {
    if (!html?.trim()) continue
    for (const seg of splitHostedSiteSlots(html)) {
      if (seg.kind === "slot" && seg.slot === "sql" && seg.alias) tables.add(seg.alias)
    }
  }
  for (const a of actions) {
    const t = a.table?.trim()
    if (t) tables.add(t)
  }
  const inferred = inferSqlTableFromModules(modules)
  if (inferred) tables.add(inferred)
  return [...tables]
}
