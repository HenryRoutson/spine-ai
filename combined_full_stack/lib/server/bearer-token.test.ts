import { describe, expect, it } from "vitest"
import { authorizationBearerToken } from "@/lib/server/bearer-token"

describe("authorizationBearerToken", () => {
  it("reads Authorization from a header getter", () => {
    expect(authorizationBearerToken({ get: (n) => (n === "authorization" ? "Bearer abc" : null) })).toBe("abc")
  })

  it("accepts bearer case-insensitively", () => {
    expect(authorizationBearerToken({ get: () => "bearer xyz" })).toBe("xyz")
  })

  it("returns null when missing or empty", () => {
    expect(authorizationBearerToken({ get: () => null })).toBeNull()
    expect(authorizationBearerToken({ get: () => "Bearer " })).toBeNull()
    expect(authorizationBearerToken({ get: () => "Token abc" })).toBeNull()
  })

  it("reads from Web Headers (middleware passes request.headers)", () => {
    expect(authorizationBearerToken(new Headers({ authorization: "Bearer from-headers" }))).toBe("from-headers")
  })
})
