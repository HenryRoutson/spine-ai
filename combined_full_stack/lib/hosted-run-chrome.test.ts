import { describe, expect, it } from "vitest"
import {
  deriveHostedOutputView,
  extractHostedMetric,
  hostedRunAllowsChangeJson,
  hostedRunHidesInputSlots,
  hostedRunIdleButtonLabel,
  hostedRunShowsInputSlots,
  normalizeHostedRunInputChrome,
} from "@/lib/hosted-run-chrome"
import type { ModuleId } from "@/lib/types"

const IN = "mod_in" as ModuleId

describe("hosted run chrome", () => {
  it("hides input slots when the pipeline has none", () => {
    expect(hostedRunHidesInputSlots([], [])).toBe(true)
  })

  it("hides input slots when every slot already has a default document", () => {
    expect(hostedRunHidesInputSlots([IN], [{ moduleId: IN }])).toBe(true)
  })

  it("shows input slots when the visitor must upload", () => {
    expect(hostedRunHidesInputSlots([IN], [])).toBe(false)
  })

  it("coerces editable+hidden into hidden and locked", () => {
    expect(
      normalizeHostedRunInputChrome({
        visibility: "hide",
        inputEditable: true,
        clearInputAfterRun: true,
      }),
    ).toEqual({
      visibility: "hide",
      inputEditable: false,
      clearInputAfterRun: false,
      runLabel: "",
      outputView: "auto",
    })
    expect(
      normalizeHostedRunInputChrome({ showInput: false, inputEditable: true, clearInputAfterRun: true }),
    ).toEqual({
      visibility: "hide",
      inputEditable: false,
      clearInputAfterRun: false,
      runLabel: "",
      outputView: "auto",
    })
  })

  it("keeps show + editable + clear after run", () => {
    expect(
      normalizeHostedRunInputChrome({
        showInput: true,
        inputEditable: true,
        clearInputAfterRun: true,
      }),
    ).toEqual({
      visibility: "show",
      inputEditable: true,
      clearInputAfterRun: true,
      runLabel: "",
      outputView: "auto",
    })
  })

  it("keeps a custom run label on a hidden pipeline", () => {
    expect(
      normalizeHostedRunInputChrome({
        visibility: "hide",
        runLabel: "Check length",
        outputView: "metric",
      }),
    ).toMatchObject({ visibility: "hide", runLabel: "Check length", outputView: "metric" })
    expect(hostedRunIdleButtonLabel(normalizeHostedRunInputChrome({ runLabel: "Add person" }))).toBe("Add person")
    expect(hostedRunIdleButtonLabel(normalizeHostedRunInputChrome({}))).toBe("Run pipeline")
  })

  it("picks metric for a one-field count object and table for a list", () => {
    expect(deriveHostedOutputView({ preference: "auto", json: '{"count":3}' })).toBe("metric")
    expect(extractHostedMetric('{"count":3}')).toEqual({ label: "count", text: "3" })
    expect(deriveHostedOutputView({ preference: "auto", json: '[{"id":"e_ada"}]' })).toBe("table")
    expect(deriveHostedOutputView({ preference: "metric", json: '[{"id":"e_ada"}]' })).toBe("table")
    expect(deriveHostedOutputView({ preference: "json", json: '{"count":3}' })).toBe("json")
  })

  it("shows add-person and hides check-length even when defaults exist", () => {
    const defaults = [{ moduleId: IN }]
    expect(
      hostedRunShowsInputSlots({
        chrome: normalizeHostedRunInputChrome({ visibility: "show" }),
        inputModuleIds: [IN],
        defaultDocs: defaults,
        compact: true,
      }),
    ).toBe(true)
    expect(
      hostedRunShowsInputSlots({
        chrome: normalizeHostedRunInputChrome({ visibility: "hide" }),
        inputModuleIds: [IN],
        defaultDocs: defaults,
        compact: true,
      }),
    ).toBe(false)
    expect(
      hostedRunAllowsChangeJson({
        chrome: normalizeHostedRunInputChrome({ visibility: "hide" }),
        inputModuleIds: [IN],
        defaultDocs: defaults,
        compact: true,
      }),
    ).toBe(false)
    expect(
      hostedRunAllowsChangeJson({
        chrome: normalizeHostedRunInputChrome({ visibility: "auto", inputEditable: false }),
        inputModuleIds: [IN],
        defaultDocs: defaults,
        compact: true,
      }),
    ).toBe(false)
  })
})
