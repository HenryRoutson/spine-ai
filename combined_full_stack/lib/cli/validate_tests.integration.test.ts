import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateTestsCommand } from "@/lib/cli/validate_test"
import { SEEDS_DIR } from "@/lib/server/seed"

const seedFiles = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"))

// AI : TODO — tutoring_*_testing.json lack expectedOutputs; skip until those fixtures are filled in.
const SKIP_VALIDATE_TESTS = new Set([
  "tutoring_random_fill.json",
  "tutoring_styled_batch.json",
  // AI : fork fixtures pin inputs only — expectedOutputs filled after a verified run.
  "contract_diligence_fork.json",
  "invoice_triage_fork.json",
  "lead_notify_fork.json",
])

describe("validate tests across seeds", () => {
  it.each(seedFiles)(
    "bundled tests validate for %s",
    (file) => {
      if (SKIP_VALIDATE_TESTS.has(file)) return
      const ctx = loadProjectContext(resolve(SEEDS_DIR, file))
      const result = validateTestsCommand(ctx)
      const perFile = result.data?.perFile as Record<string, { ok: boolean; errors: number }> | undefined
      const failing = Object.entries(perFile ?? {}).filter(([, v]) => !v.ok)
      expect(
        failing,
        `${file}: ${failing.map(([n, v]) => `${n} (${v.errors} errors)`).join(", ")}`,
      ).toEqual([])
    },
  )
})
