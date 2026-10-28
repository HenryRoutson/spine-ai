import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { dataDir } from "./config"
import type { ModuleId, SharedLinkId } from "./types"
import {
  defaultDocIdForLink,
  defaultDocStorageKey,
  parseSharedDocId,
  resolveSharedDocOriginalFile,
} from "./shared-link-session"

describe("shared-link session originals", () => {
  it("default original lookup uses sanitized keys, not sha_ doc ids", async () => {
    const linkId = "pub_origkeytest01" as SharedLinkId
    const moduleId = "in_1" as ModuleId
    const filename = "invoices/../q.pdf"
    expect(parseSharedDocId(defaultDocStorageKey(moduleId, filename))).toBeNull()
    const dir = join(dataDir(), "shared_links", "docs", linkId, "defaults")
    mkdirSync(dir, { recursive: true })
    const key = defaultDocStorageKey(moduleId, filename)
    writeFileSync(join(dir, `${key}.pdf`), Buffer.from("%PDF-1.4"))
    try {
      const docId = defaultDocIdForLink(linkId, moduleId, filename)
      const file = await resolveSharedDocOriginalFile(linkId, docId, undefined, [
        { moduleId, filename, docId },
      ])
      expect(file?.mime).toBe("application/pdf")
      expect(file?.path).toContain(key)
    } finally {
      rmSync(join(dataDir(), "shared_links", "docs", linkId), { recursive: true, force: true })
    }
  })
})
