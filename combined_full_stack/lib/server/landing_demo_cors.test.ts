import { describe, expect, it } from "vitest"
import { isLandingDemoAllowedOrigin, landingDemoCorsHeaders } from "@/lib/server/landing_demo_cors"

describe("landing demo CORS origins", () => {
  it("allows the live app and marketing hosts", () => {
    expect(isLandingDemoAllowedOrigin("https://www.spine-ai-app.dev")).toBe(true)
    expect(isLandingDemoAllowedOrigin("https://spine-ai-app.dev")).toBe(true)
    expect(isLandingDemoAllowedOrigin("https://www.spine-ai.dev")).toBe(true)
    expect(isLandingDemoAllowedOrigin("https://auto-pipeline-app.dev")).toBe(true)
    expect(isLandingDemoAllowedOrigin("https://www.auto-pipeline-app.dev")).toBe(true)
  })

  it("allows local landing ports", () => {
    expect(isLandingDemoAllowedOrigin("http://localhost:4000")).toBe(true)
    expect(isLandingDemoAllowedOrigin("http://127.0.0.1:4000")).toBe(true)
  })

  it("sets ACAO only for allowed origins", () => {
    const ok = new Request("http://localhost:3000/api/landing-demo/build-pipeline", {
      headers: { origin: "https://www.spine-ai-app.dev" },
    })
    expect(landingDemoCorsHeaders(ok)["Access-Control-Allow-Origin"]).toBe("https://www.spine-ai-app.dev")
    const bad = new Request("http://localhost:3000/api/landing-demo/build-pipeline", {
      headers: { origin: "https://evil.example" },
    })
    expect(landingDemoCorsHeaders(bad)).toEqual({})
  })
})
