import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateTestsCommand } from "@/lib/cli/validate_test"
import { SEEDS_DIR } from "@/lib/server/seed"

const seedFiles = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"))

describe("validate tests across seeds", () => {
  it.each(seedFiles)(
    "bundled tests validate for %s",
    (file) => {
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
