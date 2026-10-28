import { describe, expect, it } from "vitest"
import {
  actionPageTag,
  hostedActionBinding,
  hostedActionButtonLabel,
  hostedActionPayload,
  hostedActionTable,
  inferSqlTableFromModules,
  normalizeHostedSiteActions,
  slugActionAlias,
} from "@/lib/hosted-site-actions"
import { ModuleKind, type PipelineModule } from "@/lib/types"

describe("hosted site actions", () => {
  it("normalizes aliases and default payload", () => {
    const actions = normalizeHostedSiteActions([
      { alias: "Add-Todo", label: "Add", table: "todo", payload: { action: "add" } },
      { alias: "bad alias", label: "Nope" },
      { alias: "add-todo", label: "Dup" },
    ])
    expect(actions).toEqual([
      { alias: "add-todo", label: "Add", title: undefined, table: "todo", pipelineAlias: undefined, functionId: undefined, payload: { action: "add" } },
    ])
  })

  it("{{action}} uses the first binding; named alias looks up", () => {
    const actions = normalizeHostedSiteActions([
      { alias: "double", label: "Double it", payload: { action: "double", collatz: false } },
      { alias: "collatz", label: "3n + 1", payload: { action: "collatz", collatz: true } },
    ])
    expect(hostedActionBinding(actions).alias).toBe("double")
    expect(hostedActionButtonLabel(undefined, actions)).toBe("Double it")
    expect(hostedActionButtonLabel("collatz", actions)).toBe("3n + 1")
    expect(hostedActionPayload(hostedActionBinding(actions, "collatz"))).toEqual({
      action: "collatz",
      collatz: true,
    })
  })

  it("humanizes an unknown alias instead of forcing Double", () => {
    expect(hostedActionButtonLabel("checkout")).toBe("Checkout")
    expect(hostedActionPayload(hostedActionBinding([], "checkout"))).toEqual({ action: "checkout" })
  })

  it("slugs a function name into a unique page tag", () => {
    expect(slugActionAlias("Double")).toBe("double")
    expect(slugActionAlias("3n + 1")).toBe("n-1")
    expect(slugActionAlias("Double", ["double"])).toBe("double-2")
    expect(actionPageTag("collatz")).toBe("{{action:collatz}}")
  })

  it("infers the SQL table from a step", () => {
    const modules = [
      {
        id: "m1",
        kind: ModuleKind.Sql,
        label: "Add",
        sql: "INSERT INTO todo (id, title) VALUES ('t1', 'x')",
      },
    ] as PipelineModule[]
    expect(inferSqlTableFromModules(modules)).toBe("todo")
    expect(hostedActionTable({ alias: "add", label: "Add" }, modules)).toBe("todo")
    expect(hostedActionTable({ alias: "add", label: "Add", table: "items" }, modules)).toBe("items")
  })
})
