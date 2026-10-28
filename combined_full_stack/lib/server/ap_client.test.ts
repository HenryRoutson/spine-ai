import { afterEach, describe, expect, it, vi } from "vitest"
import {
  AP_API_KEY_ENV,
  AP_API_URL_ENV,
  AP_FRONTEND_URL_ENV,
  DEFAULT_AP_API_URL,
  apApiUrl,
  apConfigured,
  apFrontendUrl,
  apRunAction,
} from "@/lib/server/ap_client"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("ap client env", () => {
  it("apConfigured is false without a key", () => {
    vi.stubEnv(AP_API_KEY_ENV, "")
    expect(apConfigured()).toBe(false)
  })

  it("strips a trailing slash on the API URL and falls back to 3080", () => {
    vi.stubEnv(AP_API_URL_ENV, "http://127.0.0.1:3080/")
    expect(apApiUrl()).toBe("http://127.0.0.1:3080")
    vi.stubEnv(AP_API_URL_ENV, "")
    expect(apApiUrl()).toBe(DEFAULT_AP_API_URL)
  })

  it("frontend URL falls back to the API URL", () => {
    vi.stubEnv(AP_API_URL_ENV, "http://127.0.0.1:3080")
    vi.stubEnv(AP_FRONTEND_URL_ENV, "")
    expect(apFrontendUrl()).toBe("http://127.0.0.1:3080")
    vi.stubEnv(AP_FRONTEND_URL_ENV, "http://localhost:3080/")
    expect(apFrontendUrl()).toBe("http://localhost:3080")
  })
})

describe("apRunAction", () => {
  it("rejects Nango ids that are not on the allowlist", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    await expect(
      apRunAction({ actionId: "slack.postMessage", connectionId: "c1", input: { text: "hi" } }),
    ).rejects.toThrow(/unknown Activepieces action/)
  })

  it("POSTs execute with piece name, mapped input, and Bearer key", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    vi.stubEnv(AP_API_URL_ENV, "http://127.0.0.1:3080")
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ts: "1.0" }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const out = await apRunAction({
      actionId: "ap.slack.send_channel_message",
      connectionId: "conn_1",
      input: { text: "hi" },
      parameters: { channel: "#ops", textField: "text" },
    })
    expect(out).toEqual({ ts: "1.0" })
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toContain("/api/v1/pieces/")
    expect(String(url)).toContain(encodeURIComponent("@activepieces/piece-slack"))
    expect(String(url)).toContain(encodeURIComponent("send_channel_message"))
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer sk-test",
      "Content-Type": "application/json",
    })
    const body = JSON.parse(String((init as RequestInit).body)) as {
      pieceName: string
      actionName: string
      connectionExternalId: string
      input: { channel: string; text: string }
    }
    expect(body).toEqual({
      pieceName: "@activepieces/piece-slack",
      actionName: "send_channel_message",
      connectionExternalId: "conn_1",
      input: { channel: "#ops", text: "hi" },
    })
  })

  it("maps Sheets input onto spreadsheet_id / sheet_id / values", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    vi.stubEnv(AP_API_URL_ENV, "http://127.0.0.1:3080")
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ updated: 1 }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await apRunAction({
      actionId: "ap.google-sheets.append_row",
      connectionId: "conn_1",
      input: { name: "Ada", score: 9 },
      parameters: { spreadsheetId: "spr_1", sheetId: "2" },
    })
    const body = JSON.parse(String((fetchMock.mock.calls[0]![1] as RequestInit).body)) as {
      pieceName: string
      actionName: string
      input: { spreadsheet_id: string; sheet_id: number; values: unknown[] }
    }
    expect(body.pieceName).toBe("@activepieces/piece-google-sheets")
    expect(body.actionName).toBe("insert_row")
    expect(body.input).toEqual({ spreadsheet_id: "spr_1", sheet_id: 2, values: ["Ada", 9] })
  })

  it("falls through 404 execute to MCP run-action", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const out = await apRunAction({
      actionId: "ap.gmail.send_email",
      connectionId: "c1",
      input: { to: "a@b.com", subject: "s", body: "b" },
    })
    expect(out).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[1]![0])).toContain("/api/v1/mcp/run-action")
  })

  it("explains when the CE image has no execute-action API", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })))
    await expect(
      apRunAction({ actionId: "ap.slack.send_channel_message", connectionId: "c1", input: { text: "hi" } }),
    ).rejects.toThrow(/no execute-action API/)
  })

  it("surfaces a non-404 sidecar error", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 500 })))
    await expect(
      apRunAction({ actionId: "ap.slack.send_channel_message", connectionId: "c1", input: { text: "hi" } }),
    ).rejects.toThrow(/failed \(500\)/)
  })

  it("returns a truncated body when the sidecar is not JSON", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "sk-test")
    vi.stubGlobal("fetch", vi.fn(async () => new Response("plain-ok", { status: 200 })))
    await expect(
      apRunAction({ actionId: "ap.slack.send_channel_message", connectionId: "c1", input: { text: "hi" } }),
    ).resolves.toEqual({ ok: true, body: "plain-ok" })
  })

  it("fails closed without AP_API_KEY", async () => {
    vi.stubEnv(AP_API_KEY_ENV, "")
    vi.stubGlobal("fetch", vi.fn())
    await expect(
      apRunAction({ actionId: "ap.slack.send_channel_message", connectionId: "c1", input: { text: "hi" } }),
    ).rejects.toThrow(/AP_API_KEY is not set/)
  })
})
