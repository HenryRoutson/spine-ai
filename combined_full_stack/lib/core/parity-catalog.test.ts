import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { SESSION_ACTION_IDS, SESSION_ACTION_PARITY_ID, TUI_COMMAND_PARITY_ID } from "@/lib/core/actions"
import { TUI_COMMANDS } from "@/lib/cli/ink/commands"
import { PARITY_ACTION_IDS, PARITY_LABELED_FILES, PARITY_ROWS, PARITY_UNLABELED_FILES } from "@/lib/core/parity-catalog"
import { renderParityMarkdownTable, SPINE_ACTION_ATTR } from "@/lib/core/parity"
import { createSpineSession } from "@/lib/core/session"

const ROOT = join(import.meta.dirname, "../..")
const REPO = join(ROOT, "..")
const SESSION_SRC = readFileSync(join(ROOT, "lib/core/session.ts"), "utf8")
const MCP_INDEX = readFileSync(join(REPO, "mcp_tool/src/index.ts"), "utf8")
const PARITY_MD = readFileSync(join(REPO, "docs/parity.md"), "utf8")
const API_SRC = readFileSync(join(ROOT, "lib/api-routes.ts"), "utf8")

const SESSION_METHOD_RE = /^\s+(?:async )?(?:get )?([a-zA-Z][a-zA-Z0-9]*)\(/gm
const sessionMethods = new Set<string>()
for (const match of SESSION_SRC.matchAll(SESSION_METHOD_RE)) {
  if (match[1]) sessionMethods.add(match[1])
}

function mcpToolNames(src: string): Set<string> {
  const names = new Set<string>()
  for (const match of src.matchAll(/server\.tool\(\s*"([^"]+)"/g)) {
    if (match[1]) names.add(match[1])
  }
  return names
}

describe("GUI button parity catalog", () => {
  it("ids are unique and searchable", () => {
    expect(PARITY_ACTION_IDS.length).toBe(PARITY_ROWS.length)
    expect(new Set(PARITY_ACTION_IDS).size).toBe(PARITY_ROWS.length)
    for (const id of PARITY_ACTION_IDS) {
      expect(id).toMatch(/^[a-z][a-z0-9.-]+$/)
    }
  })

  it("every TUI command id is referenced", () => {
    const refs = new Set(PARITY_ROWS.flatMap((row) => [row.tui.ref, row.tui.how].filter(Boolean) as string[]))
    const haystack = [...refs].join("\n")
    for (const cmd of TUI_COMMANDS) {
      expect(haystack.includes(cmd.id), `TUI command ${cmd.id} missing from catalog`).toBe(true)
    }
  })

  it("every SESSION_ACTION_ID has a library/GUI row", () => {
    const blob = PARITY_ROWS.map((r) => `${r.id} ${r.library.how} ${r.library.ref ?? ""}`).join("\n")
    for (const action of SESSION_ACTION_IDS) {
      expect(blob.toLowerCase().includes(action.toLowerCase()), `action ${action} not in catalog library column`).toBe(
        true,
      )
    }
  })

  it("Y API refs exist in api-routes.ts", () => {
    for (const row of PARITY_ROWS) {
      if (row.api.status !== "Y") continue
      const ref = row.api.ref
      if (!ref || ref === "n/a" || !ref.startsWith("/api/")) continue
      const prefix = ref.split("/").slice(0, 3).join("/")
      expect(API_SRC.includes(prefix), `${row.id} API prefix ${prefix} not in api-routes`).toBe(true)
    }
  })

  it("Y library methods exist on SpineSession or are documented hosts", () => {
    const session = createSpineSession()
    expect(typeof session.addProject).toBe("function")
    expect(typeof session.startRun).toBe("function")
    expect(typeof session.runTest).toBe("function")
    expect(sessionMethods.has("applyPendingProposal")).toBe(true)
    expect(sessionMethods.has("setDocumentation")).toBe(true)
  })

  it("labeled GUI files contain data-spine-id / spineId for their catalog rows", () => {
    for (const file of PARITY_LABELED_FILES) {
      const abs = join(ROOT, file)
      expect(existsSync(abs), file).toBe(true)
      const src = readFileSync(abs, "utf8")
      const rows = PARITY_ROWS.filter((row) => row.gui.file === file)
      for (const row of rows) {
        const found =
          src.includes(row.id) ||
          (row.id.startsWith("nav.window.") && src.includes("nav.window.${"))
        expect(
          found,
          `${file} missing searchable id ${row.id} (${SPINE_ACTION_ATTR} or spineId)`,
        ).toBe(true)
      }
    }
  })

  it("MCP index registers tools named in the catalog", () => {
    const tools = mcpToolNames(MCP_INDEX)
    expect(tools.has("session_action")).toBe(true)
    expect(tools.has("ask_agent")).toBe(true)
    expect(tools.has("add_project")).toBe(true)
    for (const row of PARITY_ROWS) {
      if (row.mcp.status !== "Y" || !row.mcp.ref) continue
      if (row.mcp.ref === "session_action") continue
      expect(tools.has(row.mcp.ref), `MCP tool ${row.mcp.ref} for ${row.id}`).toBe(true)
    }
  })

  it("docs/parity.md lists every button id", () => {
    for (const id of PARITY_ACTION_IDS) {
      expect(PARITY_MD.includes(`\`${id}\``), `docs/parity.md missing ${id}`).toBe(true)
    }
    expect(PARITY_MD).toContain("| id | GUI | TUI | API | MCP | Library |")
  })

  it("markdown renderer emits a row per button", () => {
    const table = renderParityMarkdownTable(PARITY_ROWS)
    expect(table.split("\n").length).toBe(PARITY_ROWS.length + 2)
  })

  it("every catalog GUI file is labeled or explicitly unlabeled", () => {
    const labeled = new Set<string>(PARITY_LABELED_FILES)
    const unlabeled = new Set<string>(PARITY_UNLABELED_FILES)
    for (const file of PARITY_LABELED_FILES) {
      expect(unlabeled.has(file), `${file} listed as both labeled and unlabeled`).toBe(false)
    }
    for (const row of PARITY_ROWS) {
      const file = row.gui.file
      expect(
        labeled.has(file) || unlabeled.has(file),
        `${file} for ${row.id} is neither in PARITY_LABELED_FILES nor PARITY_UNLABELED_FILES`,
      ).toBe(true)
    }
  })

  it("session and TUI command ids map onto catalog rows", () => {
    for (const action of SESSION_ACTION_IDS) {
      const parityId = SESSION_ACTION_PARITY_ID[action]
      expect(parityId, `SESSION_ACTION_PARITY_ID missing ${action}`).toBeTruthy()
      expect(PARITY_ACTION_IDS, `catalog missing ${parityId} for ${action}`).toContain(parityId)
    }
    for (const [cmd, parityId] of Object.entries(TUI_COMMAND_PARITY_ID)) {
      expect(PARITY_ACTION_IDS, `catalog missing ${parityId} for TUI ${cmd}`).toContain(parityId)
    }
  })
})
