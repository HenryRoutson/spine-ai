// AI : Short typed app-action catalog for Vibe — never dump 400 connectors here.
// AI : Live Slack/Gmail go through Nango (see nango_client.ts). Local Set/Filter stay in n8n-catalog as piece.*.
import type { PieceProp } from "@/lib/n8n-catalog"

export type connect_action_id_string = string & { __brand: "connect_action_id" }
export type nango_provider_config_key_string = string & { __brand: "nango_provider_config_key" }
export type nango_connection_id_string = string & { __brand: "nango_connection_id" }

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
  }
}

// AI : keep this list small — vibe picks ids from here; HTTP is the generic hatch.
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
    [
      { name: "channel", displayName: "Channel", type: "string", required: true, default: "#general" },
      { name: "textField", displayName: "Text field on input", type: "string", required: true, default: "text" },
    ],
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
    [
      { name: "toField", displayName: "To field on input", type: "string", required: true, default: "to" },
      { name: "subjectField", displayName: "Subject field on input", type: "string", required: true, default: "subject" },
      { name: "bodyField", displayName: "Body field on input", type: "string", required: true, default: "body" },
    ],
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
    [
      { name: "spreadsheetId", displayName: "Spreadsheet id", type: "string", required: true },
      { name: "range", displayName: "Range", type: "string", required: true, default: "Sheet1!A1" },
    ],
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
    [
      { name: "url", displayName: "URL", type: "string", required: true },
      { name: "method", displayName: "Method", type: "select", default: "POST", options: [
        { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" },
      ] },
    ],
  ),
]

export const DEFAULT_CONNECT_ACTION_ID = "slack.postMessage" as connect_action_id_string

export function listConnectActions(): ConnectAction[] {
  return BUNDLED
}

export function getConnectAction(id: string | undefined): ConnectAction | undefined {
  if (!id?.trim()) return undefined
  const key = id.trim()
  return BUNDLED.find((a) => a.id === key || a.displayName === key)
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

export function connectActionsForMcp(): Array<{
  id: string
  displayName: string
  provider: string
  auth: ConnectAuthKind
  description: string
}> {
  return BUNDLED.map((a) => ({
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
