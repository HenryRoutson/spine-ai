import { describe, expect, it } from "vitest"
import { InputType, WebhookBodyMode, WebhookMethod } from "@/lib/types"
import { ModuleKind, type ModuleId, type PipelineModule } from "@/lib/types"
import {
  authorizationHeader,
  buildWebhookFetchBody,
  collectSecretRequirements,
  formatMissingSecretsError,
  getValueAtPath,
  missingRequiredSecrets,
  missingWebhookSecretMessage,
  pollWebhookUntilDone,
  resolveWebhookUrl,
  WEBHOOK_URL_DEFAULTS,
  type WebhookCallSpec,
} from "@/lib/webhook-step"

function spec(partial: Partial<WebhookCallSpec> = {}): WebhookCallSpec {
  return {
    url: "https://example.test/generate",
    method: WebhookMethod.Post,
    timeoutMs: 30_000,
    includeState: false,
    bodyMode: WebhookBodyMode.Raw,
    pollStatusPath: "status",
    pollDoneWhen: ["completed"],
    pollFailWhen: ["failed", "nsfw", "canceled", "cancelled"],
    ingestInputType: InputType.Video,
    ...partial,
  }
}

describe("webhook auth + body", () => {
  it("keeps Key / Bearer / Basic schemes", () => {
    expect(authorizationHeader("Key id:secret")).toBe("Key id:secret")
    expect(authorizationHeader("Bearer tok")).toBe("Bearer tok")
    expect(authorizationHeader("tok")).toBe("Bearer tok")
    expect(authorizationHeader("KEY_ID:KEY_SECRET")).toBe("Key KEY_ID:KEY_SECRET")
  })

  it("raw body is the spine, wrap is { input }", () => {
    const input = { prompt: "hi" }
    expect(buildWebhookFetchBody(input, { A: 1 }, spec({ bodyMode: WebhookBodyMode.Raw }))).toEqual(input)
    expect(buildWebhookFetchBody(input, { A: 1 }, spec({ bodyMode: WebhookBodyMode.Wrap, includeState: false }))).toEqual({
      input,
    })
  })
})

describe("webhook poll", () => {
  it("returns immediately when submit is already terminal", async () => {
    const submitted = { status: "completed", video: { url: "https://cdn.example/a.mp4" } }
    const out = await pollWebhookUntilDone(submitted, spec({ pollStatusUrlPath: "status_url" }), undefined, Date.now() + 10_000)
    expect(out).toEqual(submitted)
  })

  it("fails on nsfw / failed", async () => {
    await expect(
      pollWebhookUntilDone(
        { status: "failed", error: "nope" },
        spec({ pollStatusUrlPath: "status_url" }),
        undefined,
        Date.now() + 10_000,
      ),
    ).rejects.toThrow(/failed/)
  })

  it("reads nested ingest paths", () => {
    expect(getValueAtPath({ video: { url: "https://x" } }, "video.url")).toBe("https://x")
    expect(getValueAtPath({ images: [{ url: "https://img" }] }, "images.0.url")).toBe("https://img")
  })
})

describe("webhook URL env", () => {
  it("defaults public Higgsfield generate URLs", () => {
    expect(resolveWebhookUrl("env:HIGGSFIELD_GENERATE_URL", {})).toBe(WEBHOOK_URL_DEFAULTS.HIGGSFIELD_GENERATE_URL)
    expect(resolveWebhookUrl("env:HIGGSFIELD_IMAGE_URL", {})).toBe(WEBHOOK_URL_DEFAULTS.HIGGSFIELD_IMAGE_URL)
  })

  it("prefers env over the default", () => {
    expect(resolveWebhookUrl("env:HIGGSFIELD_GENERATE_URL", { HIGGSFIELD_GENERATE_URL: "https://example.test/v" })).toBe(
      "https://example.test/v",
    )
  })

  it("points missing auth at Settings → Secrets", () => {
    expect(() => resolveWebhookUrl("env:HIGGSFIELD_API_KEY", {})).toThrow(missingWebhookSecretMessage("HIGGSFIELD_API_KEY"))
  })
})

function webhookMod(partial: Partial<PipelineModule> & { id: string; label: string }): PipelineModule {
  return {
    kind: ModuleKind.Webhook,
    note: "",
    cached: false,
    avgMs: 0,
    avgCostCents: 0,
    ...partial,
    id: partial.id as ModuleId,
  }
}

describe("required secrets", () => {
  const generate = webhookMod({
    id: "mod_generate",
    label: "Generate",
    webhookUrl: "env:HIGGSFIELD_GENERATE_URL",
    webhookAuthEnv: "HIGGSFIELD_API_KEY",
  })

  it("requires auth keys and treats public URL defaults as optional", () => {
    const reqs = collectSecretRequirements([generate])
    expect(reqs).toEqual([
      expect.objectContaining({ name: "HIGGSFIELD_GENERATE_URL", optional: true, role: "url" }),
      expect.objectContaining({ name: "HIGGSFIELD_API_KEY", optional: false, role: "auth", stepLabel: "Generate" }),
    ])
  })

  it("fails closed before a webhook call when the auth key is missing", () => {
    const missing = missingRequiredSecrets([generate], {})
    expect(missing.map((r) => r.name)).toEqual(["HIGGSFIELD_API_KEY"])
    expect(formatMissingSecretsError(missing)).toContain(missingWebhookSecretMessage("HIGGSFIELD_API_KEY"))
    expect(formatMissingSecretsError(missing)).toContain("Required by: Generate")
  })

  it("passes when the auth key is present in env", () => {
    expect(missingRequiredSecrets([generate], { HIGGSFIELD_API_KEY: "Key id:secret" })).toEqual([])
  })
})
