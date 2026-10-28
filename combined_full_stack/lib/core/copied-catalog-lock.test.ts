import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ROUTE_MAX_DURATION_ASSISTANT, ROUTE_MAX_DURATION_RUNS } from "@/lib/server/route-config"
import { NEW_ACCOUNT_BALANCE_CENTS } from "@/lib/billing_config"

const ROOT = join(import.meta.dirname, "../..")
const REPO = join(ROOT, "..")

describe("copied catalog locks", () => {
  it("API maxDuration literals match route-config (Next requires literals)", () => {
    const apiRoot = join(ROOT, "app/api")
    const files: string[] = []
    function walk(dir: string): void {
      for (const name of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, name.name)
        if (name.isDirectory()) walk(p)
        else if (name.name === "route.ts") files.push(p)
      }
    }
    walk(apiRoot)
    const durations: { file: string; n: number }[] = []
    for (const file of files) {
      const src = readFileSync(file, "utf8")
      const m = /export const maxDuration = (\d+)/.exec(src)
      if (!m) continue
      durations.push({ file: file.slice(ROOT.length + 1), n: Number(m[1]) })
    }
    expect(durations.length).toBeGreaterThan(0)
    for (const { file, n } of durations) {
      if (file.includes("pipeline-lint")) {
        expect(n, file).toBe(60)
        continue
      }
      expect(
        n === ROUTE_MAX_DURATION_RUNS || n === ROUTE_MAX_DURATION_ASSISTANT,
        `${file} maxDuration=${n} not ${ROUTE_MAX_DURATION_RUNS} or ${ROUTE_MAX_DURATION_ASSISTANT}`,
      ).toBe(true)
    }
  })

  it("dashboard NEW_ACCOUNT_BALANCE_CENTS matches billing_config", () => {
    const dash = readFileSync(join(REPO, "dashboard/lib/dashboard_timeline.ts"), "utf8")
    const m = /NEW_ACCOUNT_BALANCE_CENTS = (\d+)/.exec(dash)
    expect(m?.[1]).toBe(String(NEW_ACCOUNT_BALANCE_CENTS))
  })
})
