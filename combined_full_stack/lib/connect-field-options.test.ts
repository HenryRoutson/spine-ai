import { describe, expect, it } from "vitest"
import { NONE_ACCOUNT, fieldRefOptions, groupedConnectActions, isEnumProp, isFieldRefProp, paramValue, sendsAsOptions, withCurrentOption } from "@/lib/connect-field-options"
import { SLACK_CONNECT_PROPS } from "@/lib/connect-props"
import { createPipelineModule } from "@/lib/pipeline-module-factory"
import { DEFAULT_MODEL, FieldType, ModuleKind, type ModuleId, type StructureModel, type StructureModelId } from "@/lib/server/types"
import type { PieceProp } from "@/lib/n8n-catalog"

const msgId = "m_msg" as StructureModelId
const models: StructureModel[] = [
  {
    id: msgId,
    name: "SlackMessage",
    description: "",
    fields: [
      { id: "f_text", name: "text", type: FieldType.Text, optional: false, description: "" },
      { id: "f_to", name: "to", type: FieldType.Text, optional: false, description: "" },
    ],
  },
]

describe("connect field options", () => {
  it("groups Nango and AP actions under the same app family", () => {
    const groups = groupedConnectActions()
    expect(groups.map((g) => g.family)).toEqual(["slack", "gmail", "sheets", "http"])
    const slackIds = groups[0]!.actions.map((a) => a.id)
    expect(slackIds).toEqual(["slack.postMessage", "ap.slack.send_channel_message"])
    expect(groups.find((g) => g.family === "http")?.actions.map((a) => a.id)).toEqual(["http.request"])
  })

  it("prepends a custom value that is not already in the enum", () => {
    const opts = [{ value: "#general", label: "#general" }]
    expect(withCurrentOption(opts, "#ops")).toEqual([
      { value: "#ops", label: "#ops" },
      { value: "#general", label: "#general" },
    ])
    expect(withCurrentOption(opts, "#general")).toBe(opts)
    expect(withCurrentOption(opts, "")).toBe(opts)
  })

  it("treats fromInputFields and *Field names as field refs", () => {
    expect(isFieldRefProp({ name: "textField", displayName: "Message field", type: "select", fromInputFields: true })).toBe(true)
    expect(isFieldRefProp({ name: "toField", displayName: "To", type: "string" })).toBe(true)
    expect(isFieldRefProp({ name: "channel", displayName: "Channel", type: "select" })).toBe(false)
    expect(isEnumProp({ name: "channel", displayName: "Channel", type: "select" })).toBe(true)
    expect(isEnumProp({ name: "url", displayName: "URL", type: "string", options: [{ value: "x", label: "x" }] })).toBe(true)
    expect(isEnumProp({ name: "url", displayName: "URL", type: "string" })).toBe(false)
  })

  it("field-ref options prefer structure fields, then default, then fallbacks", () => {
    const prop: PieceProp = {
      name: "textField",
      displayName: "Message field",
      type: "select",
      default: "text",
      fromInputFields: true,
    }
    expect(fieldRefOptions(prop, ["summary", "to"], "body").map((o) => o.value)).toEqual([
      "summary",
      "to",
      "text",
      "body",
      "content",
      "filename",
      "message",
      "subject",
    ])
  })

  it("paramValue uses the stored param then the prop default", () => {
    const channel = SLACK_CONNECT_PROPS.find((p) => p.name === "channel")!
    const selected = createPipelineModule(
      {
        kind: ModuleKind.Connect,
        label: "Slack",
        connectActionId: "slack.postMessage",
        connectParameters: { channel: "#ops" },
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    expect(paramValue(selected, channel)).toBe("#ops")
    expect(paramValue({ ...selected, connectParameters: {} }, channel)).toBe("#general")
  })

  it("Sends as lists remembered ids and sibling connect steps for the same provider", () => {
    const selected = createPipelineModule(
      {
        id: "mod_a" as ModuleId,
        kind: ModuleKind.Connect,
        label: "Slack A",
        connectActionId: "slack.postMessage",
        connectConnectionId: "conn_self_longenough",
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const sibling = createPipelineModule(
      {
        id: "mod_b" as ModuleId,
        kind: ModuleKind.Connect,
        label: "Slack B",
        connectActionId: "ap.slack.send_channel_message",
        connectConnectionId: "conn_sib",
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const gmail = createPipelineModule(
      {
        id: "mod_g" as ModuleId,
        kind: ModuleKind.Connect,
        label: "Gmail",
        connectActionId: "gmail.send",
        connectConnectionId: "conn_gmail",
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const opts = sendsAsOptions(selected, [selected, sibling, gmail], "slack", ["r1"])
    expect(opts[0]).toEqual({ value: NONE_ACCOUNT, label: "Not connected" })
    expect(opts).toEqual(
      expect.arrayContaining([
        { value: "conn_self_longenough", label: "conn_sel…" },
        { value: "conn_sib", label: "From Slack B" },
        { value: "r1", label: "r1" },
      ]),
    )
    expect(opts.some((o) => o.value === "conn_gmail")).toBe(false)
  })
})
