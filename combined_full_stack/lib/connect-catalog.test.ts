import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  collectConnectRequirements,
  connectActionFamily,
  connectActionsForMcp,
  getConnectAction,
  listConnectActions,
  missingConnectParams,
  summarizeConnectAction,
} from "@/lib/connect-catalog"
import { createPipelineModule } from "@/lib/pipeline-module-factory"
import { computeInvalid } from "@/lib/server/validity"
import { InvalidKind } from "@/lib/server/validity-types"
import { FieldType, ModuleKind, RunSource, type ModuleId, type PipelineModule, type StructureModel, type StructureModelId } from "@/lib/server/types"
import { emitStepBody } from "@/lib/server/pipeline_export_dispatch"
import { analyzeExportRuntimeNeeds } from "@/lib/server/pipeline_export_setup"
import { exportRuntimeImportTs } from "@/lib/server/pipeline_export_runtime_lib"
import { execConnectStep } from "@/lib/server/run_engine/steps/connect"
import { serializeCtx } from "@/lib/server/run_engine/context"
import type { Project, ProjectId } from "@/lib/server/types"
import type { RunCtx, RunLogger } from "@/lib/server/run_engine/engine_types"
import { DEFAULT_MODEL } from "@/lib/server/types"
import { nangoProxy } from "@/lib/server/nango_client"
import { apRunAction } from "@/lib/server/ap_client"
import { buildConnectProxyCall } from "@/lib/connect-request"

vi.mock("@/lib/server/nango_client", () => ({
  nangoProxy: vi.fn(async () => {
    throw new Error("should not hit Nango in testing")
  }),
}))

vi.mock("@/lib/server/ap_client", () => ({
  apRunAction: vi.fn(async () => {
    throw new Error("should not hit Activepieces in testing")
  }),
}))

const msgId = "m_msg" as StructureModelId
const models: StructureModel[] = [
  {
    id: msgId,
    name: "SlackMessage",
    description: "",
    fields: [{ id: "f_text", name: "text", type: FieldType.Text, optional: false, description: "" }],
  },
]

const silentLog = { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} } as unknown as RunLogger

function slackConnectExec(opts: {
  moduleId: ModuleId
  projectId: string
  actionId: string
  source: RunSource
  connectionId?: string
  input?: Record<string, unknown>
}): { connect: PipelineModule; ctx: RunCtx } {
  const prevId = `${opts.moduleId}_in` as ModuleId
  const input = createPipelineModule(
    { id: prevId, kind: ModuleKind.Input, label: "In", note: "source", outStructureId: msgId },
    models,
    DEFAULT_MODEL,
  )
  const connect = createPipelineModule(
    {
      id: opts.moduleId,
      kind: ModuleKind.Connect,
      label: "Slack",
      connectActionId: opts.actionId,
      connectConnectionId: opts.connectionId,
      connectParameters: { channel: "#general", textField: "text" },
      inStructureId: msgId,
      outStructureId: msgId,
    },
    models,
    DEFAULT_MODEL,
  )
  const project: Project = {
    id: opts.projectId as ProjectId,
    name: "connect",
    kind: "test",
    models,
    modules: [input, connect],
    strategies: [],
  }
  return {
    connect,
    ctx: {
      project,
      store: {} as RunCtx["store"],
      ledger: {} as RunCtx["ledger"],
      model: DEFAULT_MODEL,
      inputByModule: new Map(),
      byLabel: {},
      byModel: new Map(),
      outputs: new Map([[prevId, opts.input ?? { text: "hello from test" }]]),
      sourceText: "",
      sourceDocId: "d_x" as RunCtx["sourceDocId"],
      prevModuleId: prevId,
      source: opts.source,
    } as RunCtx,
  }
}

describe("connect catalog", () => {
  it("lists Nango actions plus the Activepieces allowlist and does not invent ids", () => {
    const ids = listConnectActions().map((a) => a.id)
    expect(ids).toEqual([
      "slack.postMessage",
      "gmail.send",
      "sheets.append",
      "http.request",
      "ap.slack.send_channel_message",
      "ap.gmail.send_email",
      "ap.google-sheets.append_row",
    ])
    expect(getConnectAction("slack.postMessage")?.engine).toBe("nango")
    expect(getConnectAction("ap.slack.send_channel_message")?.engine).toBe("ap")
    expect(getConnectAction("not-a-real-action")).toBeUndefined()
    const slackChannel = getConnectAction("slack.postMessage")?.props.find((p) => p.name === "channel")
    expect(slackChannel?.type).toBe("select")
    expect(slackChannel?.options?.map((o) => o.value)).toContain("#general")
    expect(getConnectAction("slack.postMessage")?.props.find((p) => p.name === "textField")?.fromInputFields).toBe(true)
    expect(getConnectAction("gmail.send")?.props.every((p) => p.fromInputFields)).toBe(true)
    expect(getConnectAction("http.request")?.props.find((p) => p.name === "method")?.type).toBe("select")
    expect(getConnectAction("sheets.append")?.props.find((p) => p.name === "range")?.type).toBe("select")
    expect(getConnectAction("ap.google-sheets.append_row")?.props.find((p) => p.name === "sheetId")?.type).toBe("select")
  })

  it("exposes the AP allowlist on MCP list_connect_actions", () => {
    const ids = connectActionsForMcp().map((a) => a.id)
    expect(ids).toContain("ap.slack.send_channel_message")
    expect(ids).toContain("slack.postMessage")
    expect(ids).toHaveLength(listConnectActions().length)
  })

  it("flags missing required params", () => {
    const slack = getConnectAction("slack.postMessage")!
    expect(missingConnectParams(slack, {})).toContain("Channel")
    expect(missingConnectParams(slack, { channel: "#x", textField: "text" })).toEqual([])
    const apSlack = getConnectAction("ap.slack.send_channel_message")!
    expect(missingConnectParams(apSlack, {})).toContain("Channel")
    expect(missingConnectParams(apSlack, { channel: "#x", textField: "text" })).toEqual([])
  })

  it("summarizes who posts and who receives", () => {
    const slack = getConnectAction("slack.postMessage")!
    expect(summarizeConnectAction(slack, { channel: "#ops", textField: "text" }, undefined)).toMatch(
      /Posts to #ops/,
    )
    expect(summarizeConnectAction(slack, { channel: "#ops", textField: "text" }, undefined)).toMatch(
      /No Slack account connected/,
    )
    expect(summarizeConnectAction(slack, { channel: "#ops", textField: "text" }, "conn_1")).toMatch(
      /connected Slack account/,
    )
    const gmail = getConnectAction("gmail.send")!
    expect(summarizeConnectAction(gmail, { toField: "email" }, undefined)).toMatch(/“email” email field/)
  })

  it("collects unconnected oauth apps and skips http.request", () => {
    const reqs = collectConnectRequirements([
      { id: "c1", kind: "connect", label: "Slack", connectActionId: "slack.postMessage" },
      { id: "c2", kind: "connect", label: "HTTP", connectActionId: "http.request" },
      { id: "c3", kind: "connect", label: "Gmail", connectActionId: "gmail.send", connectConnectionId: "nango_1" },
      { id: "c4", kind: "connect", label: "AP Slack", connectActionId: "ap.slack.send_channel_message" },
    ])
    expect(reqs.map((r) => r.actionId)).toEqual([
      "slack.postMessage",
      "gmail.send",
      "ap.slack.send_channel_message",
    ])
    expect(reqs.find((r) => r.actionId === "slack.postMessage")?.connected).toBe(false)
    expect(reqs.find((r) => r.actionId === "gmail.send")?.connected).toBe(true)
    expect(reqs.find((r) => r.actionId === "ap.slack.send_channel_message")?.connected).toBe(false)
  })

  it("looks up AP actions by display name and maps families across engines", () => {
    expect(getConnectAction("Slack (Activepieces)")?.id).toBe("ap.slack.send_channel_message")
    expect(connectActionFamily(getConnectAction("ap.gmail.send_email")!)).toBe("gmail")
    expect(connectActionFamily(getConnectAction("gmail.send")!)).toBe("gmail")
    expect(connectActionFamily(getConnectAction("ap.google-sheets.append_row")!)).toBe("sheets")
    expect(getConnectAction("  ap.slack.send_channel_message  ")?.engine).toBe("ap")
  })

  it("summarizes AP sheets by tab id and Nango sheets by range", () => {
    const apSheets = getConnectAction("ap.google-sheets.append_row")!
    expect(summarizeConnectAction(apSheets, { spreadsheetId: "spr_1", sheetId: "2" }, undefined)).toMatch(
      /Appends a row to spr_1 \(tab 2\)/,
    )
    expect(summarizeConnectAction(apSheets, { spreadsheetId: "spr_1", sheetId: "2" }, undefined)).toMatch(
      /No Google Sheets account connected yet/,
    )
    const nangoSheets = getConnectAction("sheets.append")!
    expect(summarizeConnectAction(nangoSheets, { spreadsheetId: "spr_1", range: "Sheet1!A:Z" }, "c1")).toMatch(
      /Sheet1!A:Z/,
    )
    expect(summarizeConnectAction(nangoSheets, { spreadsheetId: "spr_1", range: "Sheet1!A:Z" }, "c1")).toMatch(
      /connected Google Sheets account/,
    )
  })

  it("summarizes HTTP without an account line", () => {
    const http = getConnectAction("http.request")!
    expect(summarizeConnectAction(http, { url: "https://example.com", method: "PUT" }, undefined)).toBe(
      "PUT https://example.com.",
    )
  })
})

describe("connect validity", () => {
  it("missing action is invalid; missing connection is not", () => {
    const input = createPipelineModule(
      { kind: ModuleKind.Input, label: "In", note: "source", outStructureId: msgId },
      models,
      DEFAULT_MODEL,
    )
    const connect = createPipelineModule(
      {
        kind: ModuleKind.Connect,
        label: "Slack",
        connectActionId: "",
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    connect.connectActionId = ""
    const missing = computeInvalid([input, connect], models)
    expect(missing.get(connect.id)?.some((i) => i.kind === InvalidKind.MissingConnectAction)).toBe(true)

    const ready = createPipelineModule(
      {
        kind: ModuleKind.Connect,
        label: "Slack",
        connectActionId: "slack.postMessage",
        connectParameters: { channel: "#general", textField: "text" },
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const ok = computeInvalid([input, ready], models)
    expect(ok.get(ready.id)?.some((i) => i.kind === InvalidKind.MissingConnectAction)).toBeFalsy()

    const apReady = createPipelineModule(
      {
        kind: ModuleKind.Connect,
        label: "Slack AP",
        connectActionId: "ap.slack.send_channel_message",
        connectParameters: { channel: "#general", textField: "text" },
        inStructureId: msgId,
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const apOk = computeInvalid([input, apReady], models)
    expect(apOk.get(apReady.id)?.some((i) => i.kind === InvalidKind.MissingConnectAction)).toBeFalsy()
    expect(apReady.connectParameters).toMatchObject({ channel: "#general", textField: "text" })
  })
})

describe("connect exec + export", () => {
  beforeEach(() => {
    vi.mocked(apRunAction).mockReset()
    vi.mocked(nangoProxy).mockReset()
    vi.mocked(apRunAction).mockImplementation(async () => {
      throw new Error("should not hit Activepieces in testing")
    })
    vi.mocked(nangoProxy).mockImplementation(async () => {
      throw new Error("should not hit Nango in testing")
    })
  })

  it("testing source mocks and never calls Nango", async () => {
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_c" as ModuleId,
      projectId: "p_connect",
      actionId: "slack.postMessage",
      source: RunSource.Testing,
    })
    const result = await execConnectStep(connect, ctx, silentLog)
    expect(result.preview).toContain("test pin")
    expect(vi.mocked(nangoProxy)).not.toHaveBeenCalled()
  })

  it("testing source mocks AP actions and never calls the sidecar", async () => {
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_ap" as ModuleId,
      projectId: "p_ap",
      actionId: "ap.slack.send_channel_message",
      source: RunSource.Testing,
    })
    const result = await execConnectStep(connect, ctx, silentLog)
    expect(result.preview).toContain("test pin")
    expect(vi.mocked(apRunAction)).not.toHaveBeenCalled()
  })

  it("live AP exec calls apRunAction and never Nango", async () => {
    vi.mocked(apRunAction).mockResolvedValueOnce({ text: "sent" })
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_ap_live" as ModuleId,
      projectId: "p_ap_live",
      actionId: "ap.slack.send_channel_message",
      source: RunSource.App,
      connectionId: "ap_conn_1",
      input: { text: "hello from live" },
    })
    const result = await execConnectStep(connect, ctx, silentLog)
    expect(result.preview).toContain("Slack (Activepieces)")
    expect(vi.mocked(apRunAction)).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: "ap.slack.send_channel_message", connectionId: "ap_conn_1" }),
    )
    expect(vi.mocked(nangoProxy)).not.toHaveBeenCalled()
  })

  it("live Nango exec calls nangoProxy and never AP", async () => {
    vi.mocked(nangoProxy).mockResolvedValueOnce({ text: "sent" })
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_nango_live" as ModuleId,
      projectId: "p_nango_live",
      actionId: "slack.postMessage",
      source: RunSource.App,
      connectionId: "nango_1",
      input: { text: "hello from live" },
    })
    const result = await execConnectStep(connect, ctx, silentLog)
    expect(result.preview).toContain("Post to Slack")
    expect(vi.mocked(nangoProxy)).toHaveBeenCalledWith(
      expect.objectContaining({ actionId: "slack.postMessage", connectionId: "nango_1" }),
    )
    expect(vi.mocked(apRunAction)).not.toHaveBeenCalled()
  })

  it("live AP exec without a connection fails closed", async () => {
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_ap_nc" as ModuleId,
      projectId: "p_ap_nc",
      actionId: "ap.slack.send_channel_message",
      source: RunSource.App,
    })
    await expect(execConnectStep(connect, ctx, silentLog)).rejects.toThrow(/Connect Slack \(Activepieces\) to run this step/)
    expect(vi.mocked(apRunAction)).not.toHaveBeenCalled()
  })

  it("TS export calls runConnectAction and pulls NANGO env", () => {
    const m = createPipelineModule(
      {
        kind: ModuleKind.Connect,
        label: "Slack",
        connectActionId: "slack.postMessage",
        connectParameters: { channel: "#ops", textField: "text" },
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const project: Project = {
      id: "p_export" as ProjectId,
      name: "export",
      kind: "test",
      models,
      modules: [m],
      strategies: [],
    }
    const body = emitStepBody("ts", { m, project, inType: "SlackMessage", outType: "SlackMessage" })
    expect(body).toMatch(/runConnectAction\(/)
    expect(body).toMatch(/slack\.postMessage/)
    expect(body).toMatch(/\/chat\.postMessage/)
    expect(body).toMatch(/NANGO_CONNECTION_ID/)
    expect(body).not.toMatch(/nango_1|connectConnectionId/)
    const needs = analyzeExportRuntimeNeeds(project)
    expect(needs.connect).toBe(true)
    expect(exportRuntimeImportTs(needs)).toMatch(/runConnectAction/)
  })

  it("TS export for AP actions uses AP_CONNECTION_ID not Nango", () => {
    const m = createPipelineModule(
      {
        kind: ModuleKind.Connect,
        label: "Slack AP",
        connectActionId: "ap.slack.send_channel_message",
        connectParameters: { channel: "#ops", textField: "text" },
        outStructureId: msgId,
      },
      models,
      DEFAULT_MODEL,
    )
    const project: Project = {
      id: "p_ap_export" as ProjectId,
      name: "export",
      kind: "test",
      models,
      modules: [m],
      strategies: [],
    }
    const body = emitStepBody("ts", { m, project, inType: "SlackMessage", outType: "SlackMessage" })
    expect(body).toMatch(/kind: "ap"/)
    expect(body).toMatch(/@activepieces\/piece-slack/)
    expect(body).toMatch(/AP_CONNECTION_ID/)
    expect(body).not.toMatch(/NANGO_CONNECTION_ID/)
  })

  it("live AP exec without required params fails before the sidecar", async () => {
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_ap_mp" as ModuleId,
      projectId: "p_ap_mp",
      actionId: "ap.slack.send_channel_message",
      source: RunSource.App,
      connectionId: "ap_conn_1",
    })
    connect.connectParameters = {}
    await expect(execConnectStep(connect, ctx, silentLog)).rejects.toThrow(/needs:/)
    expect(vi.mocked(apRunAction)).not.toHaveBeenCalled()
  })

  it("live HTTP exec does not require a connection id", async () => {
    vi.mocked(nangoProxy).mockResolvedValueOnce({ text: "ok" })
    const { connect, ctx } = slackConnectExec({
      moduleId: "mod_http" as ModuleId,
      projectId: "p_http",
      actionId: "http.request",
      source: RunSource.App,
      input: { n: 1 },
    })
    connect.connectParameters = { url: "https://example.com", method: "POST" }
    const result = await execConnectStep(connect, ctx, silentLog)
    expect(result.preview).toContain("HTTP request")
    expect(vi.mocked(nangoProxy)).toHaveBeenCalledOnce()
    expect(vi.mocked(apRunAction)).not.toHaveBeenCalled()
  })
})

describe("connect proxy call", () => {
  it("interpolates Sheets path params and uses values rows", () => {
    const call = buildConnectProxyCall(
      "sheets.append",
      { spreadsheetId: "spr_1", range: "Sheet1!A1" },
      { name: "Ada", score: 9 },
    )
    expect(call.kind).toBe("nango")
    if (call.kind !== "nango") return
    expect(call.endpoint).toContain("spr_1")
    expect(call.endpoint).not.toContain("{spreadsheetId}")
    expect(call.endpoint).toContain("valueInputOption=USER_ENTERED")
    expect(call.body).toEqual({ majorDimension: "ROWS", values: [["Ada", 9]] })
  })

  it("encodes Gmail as RFC2822 raw", () => {
    const call = buildConnectProxyCall(
      "gmail.send",
      { toField: "to", subjectField: "subject", bodyField: "body" },
      { to: "a@b.com", subject: "Hi", body: "Hello" },
    )
    expect(call.kind).toBe("nango")
    if (call.kind !== "nango") return
    const raw = (call.body as { raw: string }).raw
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(raw).not.toContain("a@b.com")
  })

  it("rejects non-http URLs", () => {
    expect(() => buildConnectProxyCall("http.request", { url: "file:///etc/passwd" }, {})).toThrow(/http\(s\)/)
  })
})

describe("connect checkpoint source", () => {
  it("serializes testing source so resume does not go live", () => {
    const snap = serializeCtx({
      project: { id: "p" as ProjectId, name: "p", kind: "test", models: [], modules: [], strategies: [] },
      store: {} as RunCtx["store"],
      ledger: {} as RunCtx["ledger"],
      model: DEFAULT_MODEL,
      inputByModule: new Map(),
      byLabel: {},
      byModel: new Map(),
      outputs: new Map(),
      sourceText: "",
      sourceDocId: "d_x" as RunCtx["sourceDocId"],
      source: RunSource.Testing,
    })
    expect(snap.source).toBe(RunSource.Testing)
  })
})
