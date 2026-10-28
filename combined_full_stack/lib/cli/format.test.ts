import { describe, expect, it, vi } from "vitest"
import { formatHuman, formatJson, hasErrors, exitCodeForResult, printResult } from "@/lib/cli/format"
import type { CliCommandResult } from "@/lib/cli/types"

describe("cli format", () => {
  it("hasErrors is true only when an error-level issue exists", () => {
    expect(hasErrors([])).toBe(false)
    expect(hasErrors([{ level: "warning", where: "x", message: "warn" }])).toBe(false)
    expect(hasErrors([{ level: "error", where: "x", message: "bad" }])).toBe(true)
  })

  it("exitCodeForResult returns 1 when validation failed", () => {
    const failed: CliCommandResult = {
      ok: false,
      command: "validate test",
      issues: [{ level: "error", where: "step", message: "missing" }],
    }
    expect(exitCodeForResult(failed)).toBe(1)
    expect(exitCodeForResult({ ok: true, command: "parse test", issues: [] })).toBe(0)
  })

  it("formatHuman lists issues with level tags", () => {
    const text = formatHuman({
      ok: false,
      command: "validate test",
      issues: [{ level: "error", where: "Output", message: "type mismatch" }],
      data: { testFile: "/tmp/t.json" },
    })
    expect(text).toContain("[ERROR] Output: type mismatch")
    expect(text).toContain("test: /tmp/t.json")
  })

  it("formatJson round-trips structured output", () => {
    const result: CliCommandResult = { ok: true, command: "parse test", issues: [], data: { n: 1 } }
    expect(JSON.parse(formatJson(result))).toEqual(result)
  })

  it("exitCodeForResult treats help and warning-only failures as success", () => {
    expect(exitCodeForResult({ ok: true, command: "help", issues: [] })).toBe(0)
    expect(
      exitCodeForResult({
        ok: false,
        command: "validate test",
        issues: [{ level: "warning", where: "Output", message: "placeholder" }],
      }),
    ).toBe(0)
  })

  it("formatHuman shows metadata and ok/failed when there are no issues", () => {
    const okText = formatHuman({
      ok: true,
      command: "validate project",
      issues: [],
      data: { projectName: "Demo", summary: "project valid" },
    })
    expect(okText).toContain("project: Demo")
    expect(okText).toContain("project valid")
    expect(okText).toContain("ok")

    const failedText = formatHuman({ ok: false, command: "usage", issues: [] })
    expect(failedText).toContain("failed")
  })

  it("printResult writes human or json to stdout", () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
    const result: CliCommandResult = { ok: true, command: "parse test", issues: [] }
    printResult(result, false)
    expect(write).toHaveBeenCalledWith(formatHuman(result))
    printResult(result, true)
    expect(write).toHaveBeenCalledWith(formatJson(result))
    write.mockRestore()
  })
})
