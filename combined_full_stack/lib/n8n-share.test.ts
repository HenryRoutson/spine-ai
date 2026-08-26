import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { listN8nNodes } from "@/lib/n8n-catalog"
import { exportAllPiecesToDisk, listPiecesForMcp } from "@/lib/n8n-share"

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

  it("MCP list is compact until a piece id is requested", () => {
    const listed = listPiecesForMcp(process.cwd())
    expect(listed.some((p) => p.n8nNodeType === "n8n-nodes-base.set")).toBe(true)
    expect(listed.every((p) => !("props" in p))).toBe(true)
    const one = listPiecesForMcp(process.cwd(), "piece.set")
    expect(one).toHaveLength(1)
    expect(one[0]?.n8nNodeType).toBe("n8n-nodes-base.set")
    expect(one[0] && "props" in one[0]).toBe(true)
  })
})
