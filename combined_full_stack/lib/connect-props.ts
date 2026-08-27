// AI : Shared Connect prop enums — UI dropdowns, not live Slack/Gmail lists.
import type { PieceProp } from "@/lib/n8n-catalog"

export const SLACK_CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: "#general", label: "#general" },
  { value: "#random", label: "#random" },
  { value: "#alerts", label: "#alerts" },
  { value: "#engineering", label: "#engineering" },
  { value: "#ops", label: "#ops" },
  { value: "#support", label: "#support" },
  { value: "#sales", label: "#sales" },
]

export const SHEET_RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "Sheet1!A1", label: "Sheet1!A1" },
  { value: "Sheet1!A:Z", label: "Sheet1!A:Z" },
  { value: "Sheet2!A1", label: "Sheet2!A1" },
]

export const SHEET_TAB_OPTIONS: { value: string; label: string }[] = [
  { value: "0", label: "First tab (0)" },
  { value: "1", label: "Second tab (1)" },
  { value: "2", label: "Third tab (2)" },
]

export const HTTP_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
]

export const SLACK_CONNECT_PROPS: PieceProp[] = [
  {
    name: "channel",
    displayName: "Channel",
    type: "select",
    required: true,
    default: "#general",
    options: SLACK_CHANNEL_OPTIONS,
    description: "Where to post",
  },
  {
    name: "textField",
    displayName: "Message field",
    type: "select",
    required: true,
    default: "text",
    fromInputFields: true,
    description: "Previous-step field that holds the Slack message",
  },
]

export const GMAIL_CONNECT_PROPS: PieceProp[] = [
  {
    name: "toField",
    displayName: "To",
    type: "select",
    required: true,
    default: "to",
    fromInputFields: true,
    description: "Previous-step field that holds the recipient email",
  },
  {
    name: "subjectField",
    displayName: "Subject",
    type: "select",
    required: true,
    default: "subject",
    fromInputFields: true,
    description: "Previous-step field that holds the subject",
  },
  {
    name: "bodyField",
    displayName: "Body",
    type: "select",
    required: true,
    default: "body",
    fromInputFields: true,
    description: "Previous-step field that holds the email body",
  },
]

export const SHEETS_NANGO_CONNECT_PROPS: PieceProp[] = [
  {
    name: "spreadsheetId",
    displayName: "Spreadsheet",
    type: "string",
    required: true,
    description: "Spreadsheet id from the sheet URL",
  },
  {
    name: "range",
    displayName: "Range",
    type: "select",
    required: true,
    default: "Sheet1!A1",
    options: SHEET_RANGE_OPTIONS,
    description: "Tab and cell range",
  },
]

export const SHEETS_AP_CONNECT_PROPS: PieceProp[] = [
  {
    name: "spreadsheetId",
    displayName: "Spreadsheet",
    type: "string",
    required: true,
    description: "Spreadsheet id from the sheet URL",
  },
  {
    name: "sheetId",
    displayName: "Sheet tab",
    type: "select",
    required: true,
    default: "0",
    options: SHEET_TAB_OPTIONS,
    description: "Numeric sheet gid (0 is the first tab)",
  },
]

export const HTTP_CONNECT_PROPS: PieceProp[] = [
  { name: "url", displayName: "URL", type: "string", required: true },
  {
    name: "method",
    displayName: "Method",
    type: "select",
    default: "POST",
    options: HTTP_METHOD_OPTIONS,
  },
]
