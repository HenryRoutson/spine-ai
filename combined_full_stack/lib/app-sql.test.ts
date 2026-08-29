import { describe, expect, it, beforeEach } from "vitest"
import { resolve } from "node:path"
import { evalSqlExpr, parseAppSql, sqlWhereMatches, tableNameForModel } from "@/lib/app-sql"
import { execAppSql, resetAppSqlForTests } from "@/lib/server/app_sql"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { shouldCheckInputDescription } from "@/lib/server/input_description_check"
import { computeInvalid, migrateProjectModules } from "@/lib/server/validity"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { hostedActionButtonLabel } from "@/lib/hosted-site-slots"
import { ModuleKind } from "@/lib/types"
import { compileHostedSiteLooksOk, normalizeHostedSiteOptions } from "@/lib/hosted-site"

describe("parseAppSql", () => {
  it("parses the double-number update", () => {
    const stmt = parseAppSql("UPDATE shared_number SET value = value * 2 WHERE id = 'global' RETURNING *")
    expect(stmt).toEqual({
      kind: "update",
      table: "shared_number",
      set: [{ field: "value", expr: { kind: "binary", op: "*", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 2 } } }],
      where: { field: "id", value: "global" },
      returning: true,
    })
  })

  it("parses select star", () => {
    expect(parseAppSql("SELECT * FROM shared_number")).toEqual({
      kind: "select",
      table: "shared_number",
      columns: "*",
      where: undefined,
    })
  })

  it("parses insert", () => {
    expect(parseAppSql("INSERT INTO shared_number (id, value) VALUES ('global', 1)")).toEqual({
      kind: "insert",
      table: "shared_number",
      columns: ["id", "value"],
      values: ["global", 1],
    })
  })

  it("parses modulo parity", () => {
    const stmt = parseAppSql("UPDATE shared_number SET odd = value % 2 WHERE id = 'global' RETURNING *")
    expect(stmt).toEqual({
      kind: "update",
      table: "shared_number",
      set: [{ field: "odd", expr: { kind: "binary", op: "%", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 2 } } }],
      where: { field: "id", value: "global" },
      returning: true,
    })
  })

  it("rejects join", () => {
    expect(() => parseAppSql("SELECT * FROM a JOIN b ON a.id = b.id")).toThrow()
  })
})

describe("evalSqlExpr", () => {
  it("doubles a column", () => {
    const stmt = parseAppSql("UPDATE shared_number SET value = value * 2 WHERE id = 'global' RETURNING *")
    if (stmt.kind !== "update") throw new Error("expected update")
    expect(evalSqlExpr(stmt.set[0]!.expr, { id: "global", value: 1 })).toBe(2)
    expect(evalSqlExpr(stmt.set[0]!.expr, { id: "global", value: 2 })).toBe(4)
  })

  it("computes 3n, plus one, and n/2", () => {
    expect(evalSqlExpr({ kind: "binary", op: "*", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 3 } }, { value: 1 })).toBe(3)
    expect(evalSqlExpr({ kind: "binary", op: "+", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 1 } }, { value: 3 })).toBe(4)
    expect(evalSqlExpr({ kind: "binary", op: "/", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 2 } }, { value: 4 })).toBe(2)
    expect(evalSqlExpr({ kind: "binary", op: "%", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 2 } }, { value: 1 })).toBe(1)
    expect(evalSqlExpr({ kind: "binary", op: "%", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 2 } }, { value: 4 })).toBe(0)
  })

  it("matches where on string ids", () => {
    expect(sqlWhereMatches({ id: "global", value: 1 }, { field: "id", value: "global" })).toBe(true)
    expect(sqlWhereMatches({ id: "other", value: 1 }, { field: "id", value: "global" })).toBe(false)
  })
})

describe("execAppSql", () => {
  beforeEach(() => {
    resetAppSqlForTests()
  })

  it("seeds at 1 then doubles twice to 4", async () => {
    const scope = "project:p_demo"
    const seed = [{ id: "global", value: 1 }]
    const first = await execAppSql(scope, "UPDATE shared_number SET value = value * 2 WHERE id = 'global' RETURNING *", {
      seedRows: seed,
    })
    expect(first).toEqual([{ id: "global", value: 2 }])
    const second = await execAppSql(scope, "UPDATE shared_number SET value = value * 2 WHERE id = 'global' RETURNING *", {
      seedRows: seed,
    })
    expect(second).toEqual([{ id: "global", value: 4 }])
    const listed = await execAppSql(scope, "SELECT * FROM shared_number")
    expect(listed).toEqual([{ id: "global", value: 4 }])
  })

  it("runs one odd Collatz step as times-three then plus-one", async () => {
    const scope = "project:p_collatz"
    const seed = [{ id: "global", value: 1, odd: 1 }]
    const parity = await execAppSql(scope, "UPDATE shared_number SET odd = value % 2 WHERE id = 'global' RETURNING *", {
      seedRows: seed,
    })
    expect(parity).toEqual([{ id: "global", value: 1, odd: 1 }])
    const timesThree = await execAppSql(scope, "UPDATE shared_number SET value = value * 3 WHERE id = 'global' RETURNING *")
    expect(timesThree).toEqual([{ id: "global", value: 3, odd: 1 }])
    const plusOne = await execAppSql(scope, "UPDATE shared_number SET value = value + 1 WHERE id = 'global' RETURNING *")
    expect(plusOne).toEqual([{ id: "global", value: 4, odd: 1 }])
  })
})

describe("double shared number seed", () => {
  it("loads a sql step, shared_number table, and action-only hosted page", () => {
    const seed = loadProjectSeed(resolve(SEEDS_DIR, "double_shared_number.json"))
    const project = migrateProjectModules(seed.project)
    expect([...computeInvalid(project.modules, project.models).keys()]).toEqual([])
    const flat = flattenPipelineModules(project.modules)
    const sql = flat.filter((m) => m.kind === ModuleKind.Sql)
    expect(sql.map((m) => m.label)).toEqual(["Read n", "Odd?", "Times three", "Plus one", "Divide by two", "Double"])
    expect(sql.every((m) => m.cached === false)).toBe(true)
    expect(sql.every((m) => shouldCheckInputDescription(m) === false)).toBe(true)
    expect(flat.some((m) => m.label === "Times three" && m.sql?.includes("value * 3"))).toBe(true)
    expect(flat.some((m) => m.label === "Plus one" && m.sql?.includes("value + 1"))).toBe(true)
    const number = project.models.find((m) => m.name === "SharedNumber")
    expect(number).toBeTruthy()
    expect(tableNameForModel(number!)).toBe("shared_number")
    const html = (seed.hostedSite as { customHtml?: string } | undefined)?.customHtml ?? ""
    expect(html).toContain("{{sql:shared_number}}")
    expect(html).toContain("{{action}}")
    expect(html).toContain("{{action:collatz}}")
    expect(hostedActionButtonLabel("collatz")).toBe("3n + 1")
    const report = compileHostedSiteLooksOk(
      normalizeHostedSiteOptions(seed.hostedSite as Parameters<typeof normalizeHostedSiteOptions>[0]),
    )
    expect(report.ok, report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")).toBe(true)
    expect(report.pageHtml).toContain("hs-sql-slot")
    expect(report.pageHtml).toContain("hs-action-slot")
    expect(report.pageHtml).toContain("hs-action-row")
    expect(report.pageHtml).toContain("justify-content: center")
    expect(report.pageHtml).not.toContain('class="hs-run-slot"')
  })
})
