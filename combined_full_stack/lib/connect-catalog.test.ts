import { describe, expect, it, vi } from "vitest"
import {
  collectConnectRequirements,
  getConnectAction,
  listConnectActions,
  missingConnectParams,
} from "@/lib/connect-catalog"
import { createPipelineModule } from "@/lib/pipeline-module-factory"
import { computeInvalid } from "@/lib/server/validity"
import { InvalidKind } from "@/lib/server/validity-types"
import { FieldType, ModuleKind, RunSource, type ModuleId, type StructureModel, type StructureModelId } from "@/lib/server/types"
import { emitStepBody } from "@/lib/server/pipeline_export_dispatch"
import { analyzeExportRuntimeNeeds } from "@/lib/server/pipeline_export_setup"
import { exportRuntimeImportTs } from "@/lib/server/pipeline_export_runtime_lib"
import { execConnectStep } from "@/lib/server/run_engine/steps/connect"
import { serializeCtx } from "@/lib/server/run_engine/context"
import type { Project, ProjectId } from "@/lib/server/types"
import type { RunCtx, RunLogger } from "@/lib/server/run_engine/engine_types"
import { DEFAULT_MODEL } from "@/lib/server/types"
import { nangoProxy } from "@/lib/server/nango_client"
import { buildConnectProxyCall } from "@/lib/connect-request"

vi.mock("@/lib/server/nango_client", () => ({
  nangoProxy: vi.fn(async () => {
    throw new Error("should not hit Nango in testing")
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

describe("connect catalog", () => {
  it("lists Slack/Gmail/Sheets/HTTP and does not invent ids", () => {
    const ids = listConnectActions().map((a) => a.id)
    expect(ids).toEqual(["slack.postMessage", "gmail.send", "sheets.append", "http.request"])
    expect(getConnectAction("slack.postMessage")?.provider).toBe("slack")
    expect(getConnectAction("not-a-real-action")).toBeUndefined()
  })

  it("flags missing required params", () => {
    const slack = getConnectAction("slack.postMessage")!
    expect(missingConnectParams(slack, {})).toContain("Channel")
    expect(missingConnectParams(slack, { channel: "#x", textField: "text" })).toEqual([])
  })

  it("collects unconnected oauth apps and skips http.request", () => {
    const reqs = collectConnectRequirements([
      { id: "c1", kind: "connect", label: "Slack", connectActionId: "slack.postMessage" },
      { id: "c2", kind: "connect", label: "HTTP", connectActionId: "http.request" },
      { id: "c3", kind: "connect", label: "Gmail", connectActionId: "gmail.send", connectConnectionId: "nango_1" },
    ])
    expect(reqs.map((r) => r.actionId)).toEqual(["slack.postMessage", "gmail.send"])
    expect(reqs.find((r) => r.actionId === "slack.postMessage")?.connected).toBe(false)
    expect(reqs.find((r) => r.actionId === "gmail.send")?.connected).toBe(true)
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
  })
})

describe("connect exec + export", () => {
  it("testing source mocks and never calls Nango", async () => {
    const prevId = "mod_in" as ModuleId
    const connectId = "mod_c" as ModuleId
    const input = createPipelineModule(
      { id: prevId, kind: ModuleKind.Input, label: "In", note: "source", outStructureId: msgId },
      models,
      DEFAULT_MODEL,
    )
    const connect = createPipelineModule(
      {
        id: connectId,
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
    const project: Project = {
      id: "p_connect" as ProjectId,
      name: "connect",
      kind: "test",
      models,
      modules: [input, connect],
      strategies: [],
    }
    const ctx = {
      project,
      store: {} as RunCtx["store"],
      ledger: {} as RunCtx["ledger"],
      model: DEFAULT_MODEL,
      inputByModule: new Map(),
      byLabel: {},
      byModel: new Map(),
      outputs: new Map([[prevId, { text: "hello from test" }]]),
      sourceText: "",
      sourceDocId: "d_x" as RunCtx["sourceDocId"],
      prevModuleId: prevId,
      source: RunSource.Testing,
    } as RunCtx
    const log = { info: () => {}, debug: () => {}, warn: () => {}, error: () => {} } as unknown as RunLogger
    const result = await execConnectStep(connect, ctx, log)
    expect(result.preview).toContain("test pin")
    expect(vi.mocked(nangoProxy)).not.toHaveBeenCalled()
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
