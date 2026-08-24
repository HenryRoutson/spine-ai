import { describe, expect, it } from "vitest"
import { logicalNameFromPrefixedEnvKey, parseEnvFileText } from "@/lib/parse-env-file"

describe("parseEnvFileText", () => {
  it("parses standard .env lines", () => {
    const { entries, skipped } = parseEnvFileText(`
# comment
OPENROUTER_API_KEY=sk-or-v1-test
HIGGSFIELD_API_KEY="Key id:secret"
export STRIPE_SECRET_KEY='whsec_abc'
EMPTY=
    `)
    expect(skipped).toEqual([])
    expect(entries).toEqual([
      { name: "HIGGSFIELD_API_KEY", value: "Key id:secret" },
      { name: "OPENROUTER_API_KEY", value: "sk-or-v1-test" },
      { name: "STRIPE_SECRET_KEY", value: "whsec_abc" },
    ])
  })

  it("strips project prefix when provided", () => {
    const { entries } = parseEnvFileText(
      `
CLIP_HIGGSFIELD_API_KEY=from-prefix
HIGGSFIELD_API_KEY=from-logical
`,
      { projectPrefix: "CLIP" },
    )
    expect(entries).toEqual([{ name: "HIGGSFIELD_API_KEY", value: "from-logical" }])
  })

  it("skips invalid keys", () => {
    const { entries, skipped } = parseEnvFileText(`
123_BAD=值
GOOD_KEY=ok
`)
    expect(entries).toEqual([{ name: "GOOD_KEY", value: "ok" }])
    expect(skipped).toEqual(["123_BAD"])
  })
})

describe("logicalNameFromPrefixedEnvKey", () => {
  it("returns logical name when prefixed", () => {
    expect(logicalNameFromPrefixedEnvKey("CLIP_HIGGSFIELD_API_KEY", "CLIP")).toBe("HIGGSFIELD_API_KEY")
  })
})
