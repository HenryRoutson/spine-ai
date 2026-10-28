// AI : Short typed app-action catalog for Vibe — never dump 400 connectors here.
// AI : Live Slack/Gmail go through Nango (nango_client.ts) or AP CE (ap-catalog.ts). Local Set/Filter stay n8n-catalog.
import { listApAllowlist } from "@/lib/ap-catalog"
import {
  GMAIL_CONNECT_PROPS,
  HTTP_CONNECT_PROPS,
  SHEETS_NANGO_CONNECT_PROPS,
  SLACK_CONNECT_PROPS,
} from "@/lib/connect-props"
import type { PieceProp } from "@/lib/n8n-catalog"

export type connect_action_id_string = string & { __brand: "connect_action_id" }
export type nango_provider_config_key_string = string & { __brand: "nango_provider_config_key" }
export type nango_connection_id_string = string & { __brand: "nango_connection_id" }
export type ConnectEngine = "nango" | "ap" | "http"

export type ConnectAuthKind = "oauth2" | "api_key" | "none"

export type ConnectAction = {
  id: connect_action_id_string
  displayName: string
  provider: nango_provider_config_key_string
  nangoEndpoint: string
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  auth: ConnectAuthKind
  description: string
  vibeHint: string
  props: PieceProp[]
  engine: ConnectEngine
  apPieceName?: string
  apActionName?: string
}

function action(
  id: string,
  displayName: string,
  provider: string,
  nangoEndpoint: string,
  method: ConnectAction["method"],
  auth: ConnectAuthKind,
  description: string,
  vibeHint: string,
  props: PieceProp[],
): ConnectAction {
  return {
    id: id as connect_action_id_string,
    displayName,
    provider: provider as nango_provider_config_key_string,
    nangoEndpoint,
    method,
    auth,
    description,
    vibeHint,
    props,
    engine: auth === "none" ? "http" : "nango",
  }
}

// AI : keep this list small — vibe picks ids from here; HTTP is the generic hatch.
// AI : TODO (jank-connect-allowlist) — Slack / Gmail / Sheets / HTTP only; grow when a seed needs an id.
const BUNDLED: ConnectAction[] = [
  action(
    "slack.postMessage",
    "Post to Slack",
    "slack",
    "/chat.postMessage",
    "POST",
    "oauth2",
    "Post a message to a Slack channel.",
    "I'll send the result to Slack. Connect Slack when you're ready — a Slack window will ask you to approve.",
    SLACK_CONNECT_PROPS,
  ),
  action(
    "gmail.send",
    "Send Gmail",
    "google-mail",
    "/gmail/v1/users/me/messages/send",
    "POST",
    "oauth2",
    "Send an email from the connected Gmail account.",
    "I'll email this. Connect Gmail when you're ready — Google will ask you to approve.",
    GMAIL_CONNECT_PROPS,
  ),
  action(
    "sheets.append",
    "Append Google Sheet row",
    "google-sheet",
    "/v4/spreadsheets/{spreadsheetId}/values/{range}:append",
    "POST",
    "oauth2",
    "Append a row to a Google Sheet.",
    "I'll add a row to your sheet. Connect Google Sheets when you're ready.",
    SHEETS_NANGO_CONNECT_PROPS,
  ),
  action(
    "http.request",
    "HTTP request",
    "http",
    "/",
    "POST",
    "none",
    "POST JSON to a URL you control — no OAuth.",
    "I'll send this to the web address you gave me.",
    HTTP_CONNECT_PROPS,
  ),
]

export const DEFAULT_CONNECT_ACTION_ID = "slack.postMessage" as connect_action_id_string

function apAsConnectAction(): ConnectAction[] {
  return listApAllowlist().map((p) => ({
    id: p.id as unknown as connect_action_id_string,
    displayName: p.displayName,
    provider: p.provider as nango_provider_config_key_string,
    nangoEndpoint: "",
    method: "POST" as const,
    auth: "oauth2" as const,
    description: p.description,
    vibeHint: p.vibeHint,
    props: p.props,
    engine: "ap" as const,
    apPieceName: p.pieceName,
    apActionName: p.actionName,
  }))
}

export function listConnectActions(): ConnectAction[] {
  return [...BUNDLED, ...apAsConnectAction()]
}

export function getConnectAction(id: string | undefined): ConnectAction | undefined {
  if (!id?.trim()) return undefined
  const key = id.trim()
  return listConnectActions().find((a) => a.id === key || a.displayName === key)
}

export function missingConnectParams(entry: ConnectAction, params: Record<string, unknown> | undefined): string[] {
  const missing: string[] = []
  for (const p of entry.props) {
    if (!p.required) continue
    const v = params?.[p.name]
    if (v == null || v === "") missing.push(p.displayName)
  }
  return missing
}

export type ConnectActionFamily = "slack" | "gmail" | "sheets" | "http"

export function connectActionFamily(entry: ConnectAction): ConnectActionFamily {
  const p = entry.provider
  if (p === "slack") return "slack"
  if (p === "google-mail" || p === "gmail") return "gmail"
  if (p === "google-sheet") return "sheets"
  return "http"
}

export const CONNECT_FAMILY_LABEL: Record<ConnectActionFamily, string> = {
  slack: "Slack",
  gmail: "Gmail",
  sheets: "Google Sheets",
  http: "HTTP",
}

function paramStr(params: Record<string, unknown> | undefined, name: string, fallback: string): string {
  const v = params?.[name]
  return v == null || v === "" ? fallback : String(v)
}

export function summarizeConnectAction(
  entry: ConnectAction,
  params: Record<string, unknown> | undefined,
  connectionId: string | undefined,
): string {
  const family = connectActionFamily(entry)
  const app = CONNECT_FAMILY_LABEL[family]
  const bits: string[] = []
  if (family === "slack") {
    bits.push(`Posts to ${paramStr(params, "channel", "#general")}.`)
    bits.push(`Message from previous-step field “${paramStr(params, "textField", "text")}”.`)
  } else if (family === "gmail") {
    bits.push(`Sends to the “${paramStr(params, "toField", "to")}” email field.`)
    bits.push(`Subject from “${paramStr(params, "subjectField", "subject")}”.`)
  } else if (family === "sheets") {
    const sheet = paramStr(params, "spreadsheetId", "a spreadsheet")
    const range = params?.range != null && params.range !== "" ? String(params.range) : params?.sheetId != null ? `tab ${String(params.sheetId)}` : "the first tab"
    bits.push(`Appends a row to ${sheet} (${range}).`)
  } else {
    bits.push(`${paramStr(params, "method", "POST")} ${paramStr(params, "url", "a URL you set")}.`)
  }
  if (entry.auth !== "none") {
    bits.push(
      connectionId?.trim()
        ? `Sends as the connected ${app} account.`
        : `No ${app} account connected yet.`,
    )
  }
  return bits.join(" ")
}

export function connectActionsForMcp(): Array<{
  id: string
  displayName: string
  provider: string
  auth: ConnectAuthKind
  description: string
}> {
  return listConnectActions().map((a) => ({
    id: a.id,
    displayName: a.displayName,
    provider: a.provider,
    auth: a.auth,
    description: a.description,
  }))
}

export function collectConnectRequirements(
  modules: Array<{
    id?: string
    kind: string
    label: string
    connectActionId?: string
    connectConnectionId?: string
  }>,
): Array<{
  moduleId?: string
  moduleLabel: string
  actionId: connect_action_id_string
  displayName: string
  provider: nango_provider_config_key_string
  auth: ConnectAuthKind
  connected: boolean
}> {
  const out: Array<{
    moduleId?: string
    moduleLabel: string
    actionId: connect_action_id_string
    displayName: string
    provider: nango_provider_config_key_string
    auth: ConnectAuthKind
    connected: boolean
  }> = []
  for (const m of modules) {
    if (m.kind !== "connect") continue
    const entry = getConnectAction(m.connectActionId)
    if (!entry || entry.auth === "none") continue
    out.push({
      moduleId: m.id,
      moduleLabel: m.label,
      actionId: entry.id,
      displayName: entry.displayName,
      provider: entry.provider,
      auth: entry.auth,
      connected: Boolean(m.connectConnectionId?.trim()),
    })
  }
  return out
}
