import { describe, expect, it, beforeEach } from "vitest"
import { resolve } from "node:path"
import { evalSqlExpr, parseAppSql, sqlWhereMatches, tableNameForModel } from "@/lib/app-sql"
import { execAppSql, resetAppSqlForTests, AppSqlUnavailableError, appSqlAllowsEphemeralFallback } from "@/lib/server/app_sql"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { shouldCheckInputDescription } from "@/lib/server/input_description_check"
import { computeInvalid, migrateProjectModules } from "@/lib/server/validity"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import { functionsOnProject } from "@/lib/pipeline-functions"
import { hostedActionButtonLabel } from "@/lib/hosted-site-actions"
import { ModuleKind } from "@/lib/types"
import { compileHostedSiteLooksOk, normalizeHostedSiteOptions } from "@/lib/hosted-site"

describe("parseAppSql", () => {
  it("parses the double-number update", () => {
    const stmt = parseAppSql("UPDATE shared_number SET value = value * 2 WHERE id = 'global' RETURNING *")
    expect(stmt).toEqual({
      kind: "update",
      table: "shared_number",
      set: [{ field: "value", expr: { kind: "binary", op: "*", left: { kind: "col", name: "value" }, right: { kind: "lit", value: 2 } } }],
      where: [{ field: "id", value: "global" }],
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
      where: [{ field: "id", value: "global" }],
      returning: true,
    })
  })

  it("parses AND where and DELETE", () => {
    expect(parseAppSql("SELECT * FROM todos WHERE done = false AND owner = 'me'")).toEqual({
      kind: "select",
      table: "todos",
      columns: "*",
      where: [
        { field: "done", value: false },
        { field: "owner", value: "me" },
      ],
    })
    expect(parseAppSql("DELETE FROM todos WHERE id = 't1'")).toEqual({
      kind: "delete",
      table: "todos",
      where: [{ field: "id", value: "t1" }],
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
    expect(sqlWhereMatches({ id: "global", value: 1 }, [{ field: "id", value: "global" }])).toBe(true)
    expect(sqlWhereMatches({ id: "other", value: 1 }, [{ field: "id", value: "global" }])).toBe(false)
    expect(sqlWhereMatches({ id: "t1", done: false, owner: "me" }, [
      { field: "done", value: false },
      { field: "owner", value: "me" },
    ])).toBe(true)
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

  it("inserts then deletes a row", async () => {
    const scope = "project:p_todos"
    await execAppSql(scope, "INSERT INTO todos (id, title) VALUES ('t1', 'Buy milk')")
    const listed = await execAppSql(scope, "SELECT * FROM todos")
    expect(listed).toEqual([{ id: "t1", title: "Buy milk" }])
    const removed = await execAppSql(scope, "DELETE FROM todos WHERE id = 't1'")
    expect(removed).toEqual([{ id: "t1", title: "Buy milk" }])
    expect(await execAppSql(scope, "SELECT * FROM todos")).toEqual([])
  })
})

describe("app sql vercel fallback", () => {
  it("disallows ephemeral /tmp fallback on Vercel", () => {
    const prev = process.env.VERCEL
    process.env.VERCEL = "1"
    expect(appSqlAllowsEphemeralFallback()).toBe(false)
    if (prev === undefined) delete process.env.VERCEL
    else process.env.VERCEL = prev
  })

  it("allows file fallback off Vercel", () => {
    const prev = process.env.VERCEL
    delete process.env.VERCEL
    expect(appSqlAllowsEphemeralFallback()).toBe(true)
    if (prev !== undefined) process.env.VERCEL = prev
  })

  it("names the missing app_sql_rows table in the error", () => {
    const err = new AppSqlUnavailableError("Could not find the table 'public.app_sql_rows' in the schema cache")
    expect(err.code).toBe("app_sql_unavailable")
    expect(err.message).toMatch(/app_sql_rows/)
    expect(err.message).toMatch(/db:push|migrations/i)
  })
})

describe("double shared number seed", () => {
  it("loads a sql step, shared_number table, and action-only hosted page", () => {
    const seed = loadProjectSeed(resolve(SEEDS_DIR, "double_shared_number.json"))
    const project = migrateProjectModules(seed.project)
    const fns = functionsOnProject(project)
    expect(fns.map((fn) => fn.name)).toEqual(["Double", "Collatz"])
    for (const fn of fns) {
      expect([...computeInvalid(fn.modules, project.models).keys()]).toEqual([])
    }
    const flat = fns.flatMap((fn) => flattenPipelineModules(fn.modules))
    const sql = flat.filter((m) => m.kind === ModuleKind.Sql)
    expect(sql.map((m) => m.label)).toEqual(["Double", "Read n", "Odd?", "Times three", "Plus one", "Divide by two"])
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
    const site = normalizeHostedSiteOptions(seed.hostedSite as Parameters<typeof normalizeHostedSiteOptions>[0])
    expect(hostedActionButtonLabel("collatz", site.actions)).toBe("3n + 1")
    expect(hostedActionButtonLabel(undefined, site.actions)).toBe("Double it")
    expect(site.actions.map((a) => a.functionId)).toEqual(["fn_double", "fn_collatz"])
    const report = compileHostedSiteLooksOk(site)
    expect(report.ok, report.issues.map((i) => `${i.level}:${i.code} ${i.message}`).join("\n")).toBe(true)
    expect(report.pageHtml).toContain("hs-sql-slot")
    expect(report.pageHtml).toContain("hs-action-slot")
    expect(report.pageHtml).toContain("hs-action-row")
    expect(report.pageHtml).toContain("justify-content: center")
    expect(report.pageHtml).not.toContain('class="hs-run-slot"')
  })
})
