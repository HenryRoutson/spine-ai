import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const REPO = resolve(import.meta.dirname, "../../..")

describe("Activepieces sidecar files", () => {
  it("pins CE 0.88.3 on host port 3080", () => {
    const compose = readFileSync(resolve(REPO, "activepieces/docker-compose.yml"), "utf8")
    expect(compose).toContain("ghcr.io/activepieces/activepieces:0.88.3")
    expect(compose).toContain("3080:80")
    expect(compose).toContain("spine-ap-app")
    expect(compose).toContain("spine-ap-worker")
    expect(compose).not.toContain("packages/ee")
    expect(compose).not.toContain("activepieces/activepieces.git")
  })

  it("env template and AP example expose the sidecar key without vendor OAuth secrets", () => {
    const example = readFileSync(resolve(REPO, "activepieces/.env.example"), "utf8")
    expect(example).toContain("AP_API_KEY=")
    expect(example).toContain("AP_FRONTEND_URL=http://localhost:3080")
    expect(example).not.toMatch(/SLACK|GOOGLE_CLIENT|NANGO/)
    const template = readFileSync(resolve(REPO, ".env.template"), "utf8")
    expect(template).toContain("AP_API_URL=")
    expect(template).toContain("AP_FRONTEND_URL=")
    expect(template).toContain("AP_API_KEY=")
  })

  it("setup_local.py ap starts the sidecar", () => {
    const setup = readFileSync(resolve(REPO, "scripts/setup_local.py"), "utf8")
    expect(setup).toContain('sub.add_parser("ap"')
    expect(setup).toContain("def cmd_ap")
    expect(setup).toContain("def ensure_ap_env")
    expect(setup).toContain("def ap_start")
    expect(setup).toContain("def ap_stop")
    expect(setup).toContain('DEFAULT_AP_HOST = "http://127.0.0.1:3080"')
    expect(setup).toContain('"ap": cmd_ap')
    expect(setup).toContain("ap_stop()")
  })
})
