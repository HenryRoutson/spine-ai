import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { listN8nNodes } from "@/lib/n8n-catalog"
import { exportAllPiecesToDisk } from "@/lib/n8n-share"

describe("n8n piece sharing", () => {
  it("exports every catalog piece as shareable JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "pieces-"))
    try {
      const written = exportAllPiecesToDisk(dir)
      const types = listN8nNodes().map((p) => p.n8nNodeType)
      expect(written.map((w) => w.piece.n8nNodeType).sort()).toEqual([...types].sort())
      const files = readdirSync(join(dir, "pieces")).filter((f) => f.endsWith(".json"))
      expect(files.length).toBe(types.length)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
