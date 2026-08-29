import { describe, expect, it } from "vitest"
import { sanitizeRedirectPath } from "@/utils/sanitize_redirect"

describe("sanitizeRedirectPath", () => {
  it("keeps same-origin relative paths", () => {
    expect(sanitizeRedirectPath("/projects")).toBe("/projects")
    expect(sanitizeRedirectPath("/projects?tab=share")).toBe("/projects?tab=share")
  })

  it("rejects protocol-relative, backslash, and @ hosts", () => {
    expect(sanitizeRedirectPath("//evil.example")).toBe("/")
    expect(sanitizeRedirectPath("/\\evil.example")).toBe("/")
    expect(sanitizeRedirectPath("/@evil.example")).toBe("/")
  })

  it("decodes once and rejects traversal", () => {
    expect(sanitizeRedirectPath("/%2e%2e/secret")).toBe("/")
    expect(sanitizeRedirectPath("/foo/%2e%2e/bar")).toBe("/")
    expect(sanitizeRedirectPath("/foo/../bar")).toBe("/")
    expect(sanitizeRedirectPath("/%252e%252e/secret")).toBe("/")
  })

  it("rejects encoded slashes that become protocol-relative", () => {
    expect(sanitizeRedirectPath("/%2f%2fevil.example")).toBe("/")
  })

  it("rejects control characters and empty / missing", () => {
    expect(sanitizeRedirectPath("/%00")).toBe("/")
    expect(sanitizeRedirectPath(null)).toBe("/")
    expect(sanitizeRedirectPath("")).toBe("/")
  })
})
