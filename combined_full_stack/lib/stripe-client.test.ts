import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC = readFileSync(join(import.meta.dirname, "stripe-client.ts"), "utf8")

describe("stripe-client", () => {
  it("does not import @stripe/stripe-js (default entry auto-injects js.stripe.com)", () => {
    expect(SRC).not.toMatch(/from ["']@stripe\/stripe-js["']/)
    expect(SRC).not.toMatch(/from ["']@stripe\/stripe-js\/pure["']/)
    expect(SRC).toContain("redirectToCheckout")
  })
})
