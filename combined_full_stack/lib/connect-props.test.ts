import { describe, expect, it } from "vitest"
import {
  GMAIL_CONNECT_PROPS,
  HTTP_CONNECT_PROPS,
  SHEETS_AP_CONNECT_PROPS,
  SHEETS_NANGO_CONNECT_PROPS,
  SLACK_CHANNEL_OPTIONS,
  SLACK_CONNECT_PROPS,
} from "@/lib/connect-props"
import { piecePropDefaults } from "@/lib/n8n-catalog"

describe("connect props", () => {
  it("Slack channel is a fixed enum, not a live user list", () => {
    expect(SLACK_CHANNEL_OPTIONS.map((o) => o.value)).toEqual([
      "#general",
      "#random",
      "#alerts",
      "#engineering",
      "#ops",
      "#support",
      "#sales",
    ])
    expect(SLACK_CONNECT_PROPS.find((p) => p.name === "channel")?.type).toBe("select")
    expect(SLACK_CONNECT_PROPS.find((p) => p.name === "textField")?.fromInputFields).toBe(true)
  })

  it("Nango sheets use a range; AP sheets use a numeric tab id", () => {
    expect(SHEETS_NANGO_CONNECT_PROPS.map((p) => p.name)).toEqual(["spreadsheetId", "range"])
    expect(SHEETS_AP_CONNECT_PROPS.map((p) => p.name)).toEqual(["spreadsheetId", "sheetId"])
    expect(SHEETS_AP_CONNECT_PROPS.find((p) => p.name === "sheetId")?.type).toBe("select")
    expect(SHEETS_NANGO_CONNECT_PROPS.find((p) => p.name === "range")?.type).toBe("select")
  })

  it("Gmail fields all bind to previous-step input", () => {
    expect(GMAIL_CONNECT_PROPS.every((p) => p.fromInputFields)).toBe(true)
    expect(GMAIL_CONNECT_PROPS.map((p) => p.name)).toEqual(["toField", "subjectField", "bodyField"])
  })

  it("HTTP method is a select with POST default", () => {
    expect(piecePropDefaults({ props: HTTP_CONNECT_PROPS })).toEqual({ method: "POST" })
    expect(HTTP_CONNECT_PROPS.find((p) => p.name === "url")?.required).toBe(true)
  })

  it("prop defaults match what the inspector seeds on pick", () => {
    expect(piecePropDefaults({ props: SLACK_CONNECT_PROPS })).toEqual({ channel: "#general", textField: "text" })
    expect(piecePropDefaults({ props: SHEETS_AP_CONNECT_PROPS })).toEqual({ sheetId: "0" })
  })
})
