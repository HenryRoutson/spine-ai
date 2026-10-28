import { afterEach, describe, expect, it, vi } from "vitest"
import {
  LANDING_BUILD_SECRET_REQUIRED,
  mintLandingBuildAccessToken,
  resolveLandingBuildSigningSecret,
  verifyLandingBuildAccessToken,
} from "@/lib/server/landing_build_access"
import type { ProjectId } from "@/lib/server/types"

afterEach(() => {
  vi.unstubAllEnvs()
})

const BUILD_ID = "p_land_test" as ProjectId

describe("landing build access secret", () => {
  it("uses the local-dev fallback when not hosted", () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("LANDING_BUILD_ACCESS_SECRET", "")
    vi.stubEnv("LANDING_DEMO_PROXY_SECRET", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-must-not-sign")
    expect(resolveLandingBuildSigningSecret()).toBe("local-dev-landing-build-access")
    const token = mintLandingBuildAccessToken(BUILD_ID)
    expect(verifyLandingBuildAccessToken(BUILD_ID, token)).toBe(true)
  })

  it("fails closed on hosted deploys without a dedicated secret", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("LANDING_BUILD_ACCESS_SECRET", "")
    vi.stubEnv("LANDING_DEMO_PROXY_SECRET", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-must-not-sign")
    expect(resolveLandingBuildSigningSecret()).toBeNull()
    expect(() => mintLandingBuildAccessToken(BUILD_ID)).toThrow(LANDING_BUILD_SECRET_REQUIRED)
    expect(verifyLandingBuildAccessToken(BUILD_ID, "p_land_test.1.sig")).toBe(false)
  })

  it("accepts LANDING_DEMO_PROXY_SECRET on hosted deploys", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("LANDING_BUILD_ACCESS_SECRET", "")
    vi.stubEnv("LANDING_DEMO_PROXY_SECRET", "proxy-secret")
    const token = mintLandingBuildAccessToken(BUILD_ID)
    expect(verifyLandingBuildAccessToken(BUILD_ID, token)).toBe(true)
    expect(verifyLandingBuildAccessToken("other", token)).toBe(false)
  })
})
