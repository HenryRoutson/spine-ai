import { mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, it } from "vitest"
import { applyParsedEnv, loadMcpEnvFiles } from "./mcp-env-files.js"

describe("MCP env file load", () => {
  it("does not override a value already in the process env", () => {
    const env: NodeJS.ProcessEnv = { SPINE_API_TOKEN: "from-editor" }
    applyParsedEnv([{ name: "SPINE_API_TOKEN", value: "from-file" }], env)
    expect(env.SPINE_API_TOKEN).toBe("from-editor")
  })

  it("fills SPINE_API_URL from repo .env when unset", () => {
    const dir = join(tmpdir(), `mcp-env-${Date.now()}`)
    const app = join(dir, "app")
    mkdirSync(app, { recursive: true })
    writeFileSync(join(dir, ".env"), `SPINE_API_URL="http://127.0.0.1:3000"\nSPINE_API_TOKEN="from-env"\n`)
    writeFileSync(join(app, ".env.local"), `SPINE_API_TOKEN="from-local"\n`)
    const env: NodeJS.ProcessEnv = {}
    loadMcpEnvFiles(dir, app, env)
    expect(env.SPINE_API_TOKEN).toBe("from-local")
    expect(env.SPINE_API_URL).toBe("http://127.0.0.1:3000")
    rmSync(dir, { recursive: true, force: true })
  })
})
