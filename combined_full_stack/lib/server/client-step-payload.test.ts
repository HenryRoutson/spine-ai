import { describe, expect, it } from "vitest"
import { formatCustomCodeFailureLog } from "@/lib/custom_code"
import {
  MAX_CLIENT_LOG_LINE_CHARS,
  MAX_CLIENT_STEP_ERROR_CHARS,
  previewCustomCodeInput,
  sanitizeClientStepPayload,
  truncateClientStepText,
} from "@/lib/client-step-payload"

describe("client-step-payload", () => {
  it("truncates oversized error and log lines", () => {
    const huge = "x".repeat(20_000)
    const sanitized = sanitizeClientStepPayload({
      error: huge,
      clientLogs: [{ at: 0, level: "error", line: huge }],
    })
    expect(sanitized.error!.length).toBeLessThanOrEqual(MAX_CLIENT_STEP_ERROR_CHARS)
    expect(sanitized.clientLogs![0]!.line.length).toBeLessThanOrEqual(MAX_CLIENT_LOG_LINE_CHARS)
    expect(sanitized.error).toContain("truncated")
  })

  it("previews large array inputs instead of full JSON", () => {
    const input = Array.from({ length: 500 }, (_, i) => ({ id: i, text: "item".repeat(40) }))
    const preview = previewCustomCodeInput(input)
    expect(preview.length).toBeLessThan(3_000)
    expect(preview).toContain("Array(500)")
  })

  it("keeps formatCustomCodeFailureLog under log line cap for huge inputs", () => {
    const input = Array.from({ length: 200 }, (_, i) => ({ id: i, payload: "x".repeat(200) }))
    const line = formatCustomCodeFailureLog(
      {
        attemptIndex: 0,
        language: "typescript",
        code: "(input) => input",
        error: "boom",
        input,
      },
      "custom-code",
    )
    expect(line.length).toBeLessThanOrEqual(MAX_CLIENT_LOG_LINE_CHARS)
    expect(line).toContain("Array(200)")
  })

  it("truncateClientStepText preserves short strings", () => {
    expect(truncateClientStepText("ok", 10)).toBe("ok")
  })
})
