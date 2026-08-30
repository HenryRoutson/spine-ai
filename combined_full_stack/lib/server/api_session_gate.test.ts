import { describe, expect, it } from "vitest"
import { middlewareBlocksCookielessApi } from "@/lib/server/api_session_gate"

function headers(authorization: string | null = null): { get(name: string): string | null } {
  return {
    get(name: string) {
      return name.toLowerCase() === "authorization" ? authorization : null
    },
  }
}

describe("middlewareBlocksCookielessApi", () => {
  it("blocks cookie-less protected APIs", () => {
    expect(middlewareBlocksCookielessApi("/api/projects", "GET", headers())).toBe(true)
    expect(middlewareBlocksCookielessApi("/api/state", "GET", headers())).toBe(true)
  })

  it("lets Bearer tokens through so requireAuth can validate them", () => {
    expect(middlewareBlocksCookielessApi("/api/projects", "GET", headers("Bearer tok"))).toBe(false)
    expect(middlewareBlocksCookielessApi("/api/state", "GET", headers("bearer tok"))).toBe(false)
  })

  it("does not treat empty Bearer as a token", () => {
    expect(middlewareBlocksCookielessApi("/api/projects", "GET", headers("Bearer "))).toBe(true)
  })

  it("leaves public APIs unblocked", () => {
    expect(middlewareBlocksCookielessApi("/api/supabase-env", "GET", headers())).toBe(false)
    expect(middlewareBlocksCookielessApi("/api/demo/state", "GET", headers())).toBe(false)
  })

  it("does not apply to pages", () => {
    expect(middlewareBlocksCookielessApi("/projects", "GET", headers())).toBe(false)
    expect(middlewareBlocksCookielessApi("/login", "GET", headers())).toBe(false)
  })
})
