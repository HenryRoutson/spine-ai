import { describe, expect, it } from "vitest"
import {
  apVibeAllowlistIds,
  buildApActionInput,
  connectInputField,
  getApAllowlistPiece,
  listApAllowlist,
  type ApAllowlistPiece,
} from "@/lib/ap-catalog"

describe("Activepieces allowlist", () => {
  it("is three first-party sends — not the full piece catalog", () => {
    expect(apVibeAllowlistIds()).toEqual([
      "ap.slack.send_channel_message",
      "ap.gmail.send_email",
      "ap.google-sheets.append_row",
    ])
    expect(listApAllowlist()).toHaveLength(3)
    expect(getApAllowlistPiece("slack.postMessage")).toBeUndefined()
    expect(getApAllowlistPiece("")).toBeUndefined()
    expect(getApAllowlistPiece("  ap.slack.send_channel_message  ")?.actionName).toBe("send_channel_message")
  })

  it("maps spine input onto Slack piece props", () => {
    const slack = getApAllowlistPiece("ap.slack.send_channel_message")!
    expect(buildApActionInput(slack, { channel: "#ops", textField: "text" }, { text: "hi" })).toEqual({
      channel: "#ops",
      text: "hi",
    })
  })

  it("stringifies non-string Slack text and defaults the channel", () => {
    const slack = getApAllowlistPiece("ap.slack.send_channel_message")!
    expect(buildApActionInput(slack, undefined, { n: 1 })).toEqual({
      channel: "#general",
      text: JSON.stringify({ n: 1 }),
    })
  })

  it("maps Gmail fields from spine input", () => {
    const gmail = getApAllowlistPiece("ap.gmail.send_email")!
    expect(
      buildApActionInput(
        gmail,
        { toField: "to", subjectField: "subject", bodyField: "body" },
        { to: "a@b.com", subject: "Hi", body: "Hello" },
      ),
    ).toEqual({ receiver: "a@b.com", subject: "Hi", body_text: "Hello" })
  })

  it("maps a spine object to a Sheets row", () => {
    const sheet = getApAllowlistPiece("ap.google-sheets.append_row")!
    expect(
      buildApActionInput(sheet, { spreadsheetId: "spr_1", sheetId: "4" }, { name: "Ada", score: 9 }),
    ).toEqual({ spreadsheet_id: "spr_1", sheet_id: 4, values: ["Ada", 9] })
  })

  it("wraps a scalar Sheets input as a one-cell row", () => {
    const sheet = getApAllowlistPiece("ap.google-sheets.append_row")!
    expect(buildApActionInput(sheet, { spreadsheetId: "spr_1" }, "x")).toEqual({
      spreadsheet_id: "spr_1",
      sheet_id: 0,
      values: ["x"],
    })
  })

  it("passes a Sheets array through as the row values", () => {
    const sheet = getApAllowlistPiece("ap.google-sheets.append_row")!
    expect(buildApActionInput(sheet, { spreadsheetId: "spr_1" }, ["Ada", 9])).toEqual({
      spreadsheet_id: "spr_1",
      sheet_id: 0,
      values: ["Ada", 9],
    })
  })

  it("uses Gmail default field names when params are omitted", () => {
    const gmail = getApAllowlistPiece("ap.gmail.send_email")!
    expect(buildApActionInput(gmail, undefined, { to: "a@b.com", subject: "Hi", body: "Hello" })).toEqual({
      receiver: "a@b.com",
      subject: "Hi",
      body_text: "Hello",
    })
  })

  it("falls back to params+input for an unknown allowlist id", () => {
    const other: ApAllowlistPiece = {
      ...getApAllowlistPiece("ap.slack.send_channel_message")!,
      id: "ap.other.unknown" as ApAllowlistPiece["id"],
    }
    expect(buildApActionInput(other, { x: 1 }, { y: 2 })).toEqual({ x: 1, input: { y: 2 } })
  })

  it("reads a named field off a spine object", () => {
    expect(connectInputField({ to: "a@b.com" }, "to")).toBe("a@b.com")
    expect(connectInputField(["a"], "to")).toBeUndefined()
    expect(connectInputField(null, "to")).toBeUndefined()
  })

  it("pins MIT piece names used by the sidecar HTTP body", () => {
    const slack = getApAllowlistPiece("ap.slack.send_channel_message")!
    expect(slack.pieceName).toBe("@activepieces/piece-slack")
    expect(slack.provider).toBe("slack")
    expect(getApAllowlistPiece("ap.gmail.send_email")?.pieceName).toBe("@activepieces/piece-gmail")
    expect(getApAllowlistPiece("ap.google-sheets.append_row")?.actionName).toBe("insert_row")
  })
})
