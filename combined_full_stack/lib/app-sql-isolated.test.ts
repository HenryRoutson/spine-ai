import { afterEach, describe, expect, it } from "vitest"
import { AppSqlUnavailableError, listAppSqlRows } from "@/lib/server/app_sql"

describe("hosted site SQL isolation", () => {
  afterEach(() => {
    delete process.env.VERCEL
  })

  it("does not fall back to Spine app_sql_rows on Vercel without an isolated client", async () => {
    process.env.VERCEL = "1"
    await expect(listAppSqlRows("site:site_x", "shared_number")).rejects.toBeInstanceOf(AppSqlUnavailableError)
    await expect(listAppSqlRows("site:site_x", "shared_number")).rejects.toThrow(/isolated/i)
  })
})
