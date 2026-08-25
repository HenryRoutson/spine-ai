import { describe, expect, it } from "vitest"
import { isValidCronExpr, nextCronFireAt } from "@/lib/cron-expr"

describe("cron DOW ranges", () => {
  it("accepts 1-7 as Monday through Sunday", () => {
    expect(isValidCronExpr("0 9 * * 1-7")).toBe(true)
    const from = Date.UTC(2026, 7, 26, 0, 0, 0)
    const next = nextCronFireAt("0 9 * * 1-7", "UTC", from)
    expect(next).not.toBeNull()
  })

  it("treats lone 7 as Sunday", () => {
    expect(isValidCronExpr("0 9 * * 7")).toBe(true)
    const sunday = Date.UTC(2026, 7, 30, 0, 0, 0)
    const next = nextCronFireAt("0 9 * * 7", "UTC", sunday)
    expect(next).toBe(Date.UTC(2026, 7, 30, 9, 0, 0))
  })
})
