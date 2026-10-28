// AI : Short Activepieces allowlist for Vibe — never dump 600 pieces into the agent prompt.
// AI : Live run is ap_client.ts (sidecar HTTP). Local Set/Filter stay in n8n-catalog.
import { GMAIL_CONNECT_PROPS, SHEETS_AP_CONNECT_PROPS, SLACK_CONNECT_PROPS } from "@/lib/connect-props"
import type { PieceProp } from "@/lib/n8n-catalog"

export type ap_piece_name_string = string & { __brand: "ap_piece_name" }
export type ap_action_name_string = string & { __brand: "ap_action_name" }
export type ap_connect_action_id_string = string & { __brand: "ap_connect_action_id" }

export type ApAllowlistPiece = {
  id: ap_connect_action_id_string
  displayName: string
  pieceName: ap_piece_name_string
  actionName: ap_action_name_string
  provider: string
  description: string
  vibeHint: string
  props: PieceProp[]
}

function apPiece(
  id: string,
  displayName: string,
  pieceName: string,
  actionName: string,
  provider: string,
  description: string,
  vibeHint: string,
  props: PieceProp[],
): ApAllowlistPiece {
  return {
    id: id as ap_connect_action_id_string,
    displayName,
    pieceName: pieceName as ap_piece_name_string,
    actionName: actionName as ap_action_name_string,
    provider,
    description,
    vibeHint,
    props,
  }
}

// AI : three first-party sends — same jobs as Nango Connect, MIT piece implementations.
const ALLOWLIST: ApAllowlistPiece[] = [
  apPiece(
    "ap.slack.send_channel_message",
    "Slack (Activepieces)",
    "@activepieces/piece-slack",
    "send_channel_message",
    "slack",
    "Post a message to a Slack channel via Activepieces CE.",
    "I'll send this to Slack. Connect Slack when you're ready.",
    SLACK_CONNECT_PROPS,
  ),
  apPiece(
    "ap.gmail.send_email",
    "Gmail (Activepieces)",
    "@activepieces/piece-gmail",
    "send_email",
    "gmail",
    "Send an email from the connected Gmail account via Activepieces CE.",
    "I'll email this. Connect Gmail when you're ready.",
    GMAIL_CONNECT_PROPS,
  ),
  apPiece(
    "ap.google-sheets.append_row",
    "Google Sheets (Activepieces)",
    "@activepieces/piece-google-sheets",
    "insert_row",
    "google-sheet",
    "Append a row to a Google Sheet via Activepieces CE.",
    "I'll add a row to your sheet. Connect Google Sheets when you're ready.",
    SHEETS_AP_CONNECT_PROPS,
  ),
]

export function listApAllowlist(): ApAllowlistPiece[] {
  return ALLOWLIST
}

export function apVibeAllowlistIds(): string[] {
  return ALLOWLIST.map((a) => a.id)
}

export function getApAllowlistPiece(id: string | undefined): ApAllowlistPiece | undefined {
  if (!id?.trim()) return undefined
  const key = id.trim()
  return ALLOWLIST.find((a) => a.id === key)
}

export function connectInputField(input: unknown, field: string): unknown {
  if (input && typeof input === "object" && !Array.isArray(input) && field in (input as Record<string, unknown>)) {
    return (input as Record<string, unknown>)[field]
  }
  return undefined
}

export function buildApActionInput(
  piece: ApAllowlistPiece,
  params: Record<string, unknown> | undefined,
  input: unknown,
): Record<string, unknown> {
  const p = params ?? {}
  if (piece.id === "ap.slack.send_channel_message") {
    const textField = String(p.textField ?? "text")
    const text = connectInputField(input, textField)
    return {
      channel: p.channel ?? "#general",
      text: typeof text === "string" ? text : JSON.stringify(input),
    }
  }
  if (piece.id === "ap.gmail.send_email") {
    return {
      receiver: connectInputField(input, String(p.toField ?? "to")),
      subject: connectInputField(input, String(p.subjectField ?? "subject")),
      body_text: connectInputField(input, String(p.bodyField ?? "body")),
    }
  }
  if (piece.id === "ap.google-sheets.append_row") {
    const values =
      input && typeof input === "object" && !Array.isArray(input)
        ? Object.values(input as Record<string, unknown>)
        : Array.isArray(input)
          ? input
          : [input]
    return {
      spreadsheet_id: p.spreadsheetId,
      sheet_id: Number(p.sheetId ?? 0),
      values,
    }
  }
  return { ...p, input }
}
