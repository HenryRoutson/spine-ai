import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { SPINE_MCP_INSTRUCTIONS } from "./agent-playbook.js"

describe("MCP playbook connect allowlist", () => {
  it("lists AP allowlist ids next to Nango ids", () => {
    expect(SPINE_MCP_INSTRUCTIONS).toContain("ap.slack.send_channel_message")
    expect(SPINE_MCP_INSTRUCTIONS).toContain("ap.gmail.send_email")
    expect(SPINE_MCP_INSTRUCTIONS).toContain("ap.google-sheets.append_row")
    expect(SPINE_MCP_INSTRUCTIONS).toContain("slack.postMessage")
    expect(SPINE_MCP_INSTRUCTIONS).toContain("list_connect_actions")
  })

  it("unknown-connect hint names the AP allowlist", () => {
    const src = readFileSync(resolve(import.meta.dirname, "index.ts"), "utf8")
    expect(src).toContain("ap.* allowlist ids")
  })
})
