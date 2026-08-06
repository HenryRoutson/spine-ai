import { describe, expect, it } from "vitest"
import { instrumentCodeLines, makeAsyncFunctionSource } from "@/lib/custom_code_trace"
import { wrapAssertTypeScript } from "@/lib/assert_steps"
import { buildCustomFnSource } from "@/lib/custom_code"

function compileInstrumented(code: string, asAssert = false, visual = false): void {
  const inst = instrumentCodeLines(code, { visual })
  const built = asAssert ? buildCustomFnSource(wrapAssertTypeScript(inst)) : buildCustomFnSource(inst)
  const src = visual ? makeAsyncFunctionSource(built) : built
  // eslint-disable-next-line no-new-function -- mirrors browser inference compile path
  new Function("__forgeTrace", `return ${src}`)(visual ? async () => {} : () => {})
}

const SELECT_ASSERT = `const selected = Array.isArray(input) ? input : step("Select Relevant Examples");
if (!Array.isArray(selected) || selected.length < 1) throw new Error("expected at least one selected example");
const rows = [
  step("Example Library")?.examples,
  step("Combine Inputs")?.library?.examples,
  step("Parse Examples"),
].flatMap((v) => (Array.isArray(v) ? v : []));
if (!rows.length) throw new Error("expected library examples from Example Library, Combine Inputs, or Parse Examples");
const ids = new Set(rows.map((e) => e?.id).filter(Boolean));
for (const row of selected) {
  if (typeof row?.selection_reason !== "string" || !row.selection_reason.trim()) throw new Error("missing selection_reason");
  if (!ids.has(row?.id)) throw new Error(\`unknown example id \${row?.id} (library has: \${[...ids].sort().join(", ")})\`);
}`

describe("instrumentCodeLines (AST)", () => {
  it("compiles example-select assert with multi-line array + flatMap", () => {
    expect(() => compileInstrumented(SELECT_ASSERT, true)).not.toThrow()
    expect(() => compileInstrumented(SELECT_ASSERT, true, true)).not.toThrow()
  })

  it("keeps nested map callbacks sync under visual mode (assert id set)", async () => {
    const inst = instrumentCodeLines(SELECT_ASSERT, { visual: true })
    expect(inst).not.toMatch(/\.map\(\s*async\s*\(/)
    expect(inst).not.toMatch(/\.flatMap\(\s*async\s*\(/)
    const src = makeAsyncFunctionSource(buildCustomFnSource(wrapAssertTypeScript(inst)))
    const examples = [
      { id: "ex-bathroom-leak", title: "a", scope_text: "b" },
      { id: "ex-roof-storm", title: "c", scope_text: "d" },
    ]
    const selected = [
      {
        id: "ex-bathroom-leak",
        title: "a",
        scope_text: "b",
        selection_reason: "matches leak",
      },
    ]
    const state = {
      "Example Library": { examples },
      "Combine Inputs": { library: { examples }, case: { description: "x" } },
      "Parse Examples": examples,
      "Select Relevant Examples": selected,
    }
    const fn = new Function("__forgeTrace", `return ${src}`)(async () => {}) as (
      input: unknown,
      state: unknown,
    ) => Promise<unknown>
    await expect(fn(selected, state)).resolves.toBe(true)
  })

  it("instruments inline arrow callbacks with slots", () => {
    const inst = instrumentCodeLines(`const xs = [1, 2].map((n) => n + 1);`)
    expect(inst).toContain("__forgeTrace(1)")
    expect(inst).toContain("__forgeTrace(1, 1)")
    compileInstrumented(`const xs = [1, 2].map((n) => n + 1);`)
  })

  it("keeps expression-form arrow returning object (Normalize Case)", () => {
    const code = '(doc) => ({ description: String(doc?.content ?? "").trim() })'
    const inst = instrumentCodeLines(code)
    expect(inst.trim().startsWith("(")).toBe(true)
    expect(inst).not.toMatch(/^__forgeTrace/m)
    const fn = new Function("__forgeTrace", `return ${buildCustomFnSource(inst)}`)(() => {}) as (
      doc: { content?: string },
    ) => { description: string }
    expect(fn({ content: "  leak  " })).toEqual({ description: "leak" })
    compileInstrumented(code)
  })

  it("handles preamble + trailing arrow", () => {
    compileInstrumented(`const x = 1;\n(input) => x`)
  })
})
