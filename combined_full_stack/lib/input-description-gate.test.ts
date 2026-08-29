import { describe, expect, it } from "vitest"
import { shouldCheckInputDescription } from "@/lib/input-description-gate"
import { InputType, ModuleKind } from "@/lib/types"

describe("shouldCheckInputDescription", () => {
  it("skips if/case/join and custom-code unless opted in", () => {
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.IfElse,
        inputDescription: "Ticket with urgent bool",
      }),
    ).toBe(false)
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.Case,
        inputDescription: "Ticket with status",
      }),
    ).toBe(false)
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.ControlJoin,
        inputDescription: "Taken branch",
      }),
    ).toBe(false)
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.CustomCode,
        inputDescription: "Ticket marked urgent",
      }),
    ).toBe(false)
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.CustomCode,
        inputDescription: "Ticket marked urgent",
        checkInputDescription: true,
      }),
    ).toBe(true)
  })

  it("keeps the LLM gate on for llm steps with a description", () => {
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.Llm,
        inputDescription: "A signed W-2",
      }),
    ).toBe(true)
  })

  it("skips JSON input steps", () => {
    expect(
      shouldCheckInputDescription({
        kind: ModuleKind.Input,
        inputType: InputType.Json,
        inputDescription: "JSON Ticket",
      }),
    ).toBe(false)
  })
})
