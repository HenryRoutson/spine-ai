import { afterEach, describe, expect, it } from "vitest"
import { isLiveOpenRouterApiKey, isPlaceholderOpenRouterKey, resolveOpenRouterApiKey } from "./config"

describe("OpenRouter key resolution", () => {
  const prevApi = process.env.OPENROUTER_API_KEY
  const prevAlt = process.env.OPENROUTER_KEY

  afterEach(() => {
    if (prevApi === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = prevApi
    if (prevAlt === undefined) delete process.env.OPENROUTER_KEY
    else process.env.OPENROUTER_KEY = prevAlt
  })

  it("treats local placeholders as missing", () => {
    expect(isPlaceholderOpenRouterKey("sk-or-local-dev-placeholder")).toBe(true)
    expect(isPlaceholderOpenRouterKey("seed")).toBe(true)
    expect(isPlaceholderOpenRouterKey("sk-or-v1-abc")).toBe(false)
  })

  it("falls back to OPENROUTER_KEY when OPENROUTER_API_KEY is a placeholder", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-local-dev-placeholder"
    process.env.OPENROUTER_KEY = "sk-or-v1-from-alt-secret"
    expect(resolveOpenRouterApiKey()).toBe("sk-or-v1-from-alt-secret")
    expect(isLiveOpenRouterApiKey()).toBe(true)
  })
})
