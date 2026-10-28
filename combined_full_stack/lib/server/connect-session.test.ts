import { beforeEach, describe, expect, it, vi } from "vitest"
import { POST } from "@/app/api/connect/session/route"
import { HTTP } from "@/lib/server/api-errors"
import { requireAuthStore } from "@/lib/server/api_context"
import { apConfigured, apFrontendUrl } from "@/lib/server/ap_client"
import { createNangoConnectSession, nangoConfigured } from "@/lib/server/nango_client"
import type { AuthSession } from "@/lib/server/require_auth"
import type { Store } from "@/lib/server/store"

vi.mock("@/lib/server/api_context", async () => {
  const { NextResponse } = await import("next/server")
  return {
    requireAuthStore: vi.fn(),
    apiError: (message: string, status: number) => NextResponse.json({ error: message }, { status }),
  }
})

vi.mock("@/lib/server/nango_client", () => ({
  nangoConfigured: vi.fn(),
  createNangoConnectSession: vi.fn(),
}))

vi.mock("@/lib/server/ap_client", () => ({
  apConfigured: vi.fn(),
  apFrontendUrl: vi.fn(),
}))

vi.mock("@/lib/server/server_logger", () => ({
  logger: () => ({ info: () => {}, debug: () => {}, warn: () => {}, error: () => {} }),
}))

function sessionRequest(actionId: string): Request {
  return new Request("http://127.0.0.1/api/connect/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actionId }),
  })
}

describe("POST /api/connect/session", () => {
  beforeEach(() => {
    vi.mocked(requireAuthStore).mockResolvedValue({
      auth: { userId: "u1" as AuthSession["userId"], email: "u@example.com" },
      store: {} as Store,
    })
    vi.mocked(nangoConfigured).mockReturnValue(true)
    vi.mocked(apConfigured).mockReturnValue(true)
    vi.mocked(apFrontendUrl).mockReturnValue("http://127.0.0.1:3080")
    vi.mocked(createNangoConnectSession).mockResolvedValue({
      sessionToken: "nango_tok" as Awaited<ReturnType<typeof createNangoConnectSession>>["sessionToken"],
      host: "http://127.0.0.1:3003",
      provider: "slack",
    })
  })

  it("returns AP frontend URL for allowlist actions", async () => {
    const res = await POST(sessionRequest("ap.slack.send_channel_message"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      kind: "ap",
      frontendUrl: "http://127.0.0.1:3080",
      provider: "slack",
      actionId: "ap.slack.send_channel_message",
    })
    expect(vi.mocked(createNangoConnectSession)).not.toHaveBeenCalled()
  })

  it("serves AP even when Nango is not configured", async () => {
    vi.mocked(nangoConfigured).mockReturnValue(false)
    const res = await POST(sessionRequest("ap.gmail.send_email"))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ kind: "ap", provider: "gmail", actionId: "ap.gmail.send_email" })
  })

  it("fails closed when AP_API_KEY is missing", async () => {
    vi.mocked(apConfigured).mockReturnValue(false)
    const res = await POST(sessionRequest("ap.slack.send_channel_message"))
    expect(res.status).toBe(HTTP.BAD_REQUEST)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/AP_API_KEY/) })
  })

  it("returns a Nango session token for slack.postMessage", async () => {
    const res = await POST(sessionRequest("slack.postMessage"))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      kind: "nango",
      sessionToken: "nango_tok",
      host: "http://127.0.0.1:3003",
      provider: "slack",
      actionId: "slack.postMessage",
    })
  })

  it("fails closed when NANGO_SECRET_KEY is missing", async () => {
    vi.mocked(nangoConfigured).mockReturnValue(false)
    const res = await POST(sessionRequest("slack.postMessage"))
    expect(res.status).toBe(HTTP.BAD_REQUEST)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/NANGO_SECRET_KEY/) })
  })

  it("surfaces a Nango session error", async () => {
    vi.mocked(createNangoConnectSession).mockRejectedValueOnce(new Error("nango down"))
    const res = await POST(sessionRequest("slack.postMessage"))
    expect(res.status).toBe(HTTP.BAD_REQUEST)
    expect(await res.json()).toMatchObject({ error: "nango down" })
  })

  it("rejects http.request because it has no account connection", async () => {
    const res = await POST(sessionRequest("http.request"))
    expect(res.status).toBe(HTTP.BAD_REQUEST)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/does not need an account connection/) })
  })

  it("rejects unknown action ids", async () => {
    const res = await POST(sessionRequest("not-a-real-action"))
    expect(res.status).toBe(HTTP.BAD_REQUEST)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/unknown connect action/) })
  })
})
