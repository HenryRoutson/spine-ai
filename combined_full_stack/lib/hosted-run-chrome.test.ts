import { describe, expect, it } from "vitest"
import { hostedRunHidesInputSlots } from "@/lib/hosted-run-chrome"
import type { ModuleId } from "@/lib/types"

const IN = "mod_in" as ModuleId

describe("hosted run chrome", () => {
  it("hides input slots when the pipeline has none", () => {
    expect(hostedRunHidesInputSlots([], [])).toBe(true)
  })

  it("hides input slots when every slot already has a default document", () => {
    expect(hostedRunHidesInputSlots([IN], [{ moduleId: IN }])).toBe(true)
  })

  it("shows input slots when the visitor must upload", () => {
    expect(hostedRunHidesInputSlots([IN], [])).toBe(false)
  })
})
