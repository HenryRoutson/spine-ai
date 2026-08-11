import { describe, expect, it } from "vitest"
import { MarkupKind } from "@/lib/markup-kinds"
import { convertMarkupToPdf } from "@/lib/markup-to-pdf"
import { validateLatex, validateMarkdown, validateMarkup } from "@/lib/markup-validate"
import { PrimName, typeExprToZod } from "@/lib/server/type_expr"

describe("markup validate", () => {
  it("accepts balanced markdown with mermaid", () => {
    const src = ["# Title", "", "```mermaid", "flowchart LR", "  A-->B", "```", ""].join("\n")
    expect(validateMarkdown(src).ok).toBe(true)
  })

  it("rejects unclosed fence", () => {
    const r = validateMarkdown("# x\n```js\nconst a = 1\n")
    expect(r.ok).toBe(false)
    expect(r.issues[0]?.message).toMatch(/unclosed/)
  })

  it("rejects empty mermaid", () => {
    const r = validateMarkdown("```mermaid\n\n```")
    expect(r.ok).toBe(false)
  })

  it("accepts allowlisted latex packages", () => {
    const src = ["\\documentclass{article}", "\\usepackage{amsmath}", "\\begin{document}", "$x$", "\\end{document}"].join(
      "\n",
    )
    expect(validateLatex(src).ok).toBe(true)
  })

  it("rejects banned latex commands", () => {
    const r = validateLatex("\\write18{rm -rf /}")
    expect(r.ok).toBe(false)
    expect(r.issues.some((i) => /forbidden/.test(i.message))).toBe(true)
  })

  it("rejects non-allowlisted packages", () => {
    const r = validateLatex("\\usepackage{shellesc}")
    expect(r.ok).toBe(false)
  })

  it("routes validateMarkup by kind", () => {
    expect(validateMarkup(MarkupKind.Markdown, "# ok").ok).toBe(true)
    expect(validateMarkup(MarkupKind.Latex, "\\usepackage{amsmath}").ok).toBe(true)
  })
})

describe("markup prim zod", () => {
  it("validates markdown and latex prims", () => {
    const md = typeExprToZod({ kind: "prim", name: PrimName.Markdown }, [])
    const tex = typeExprToZod({ kind: "prim", name: PrimName.Latex }, [])
    expect(md.safeParse("# hi\n").success).toBe(true)
    expect(md.safeParse("```js\n").success).toBe(false)
    expect(tex.safeParse("\\usepackage{amsmath}").success).toBe(true)
    expect(tex.safeParse("\\write18{x}").success).toBe(false)
  })
})

describe("convertMarkupToPdf", () => {
  it("fails validation before engine", async () => {
    const r = await convertMarkupToPdf({ kind: MarkupKind.Latex, source: "\\write18{x}" })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe("validation")
  })

  it("routes to engine stub after validation", async () => {
    const r = await convertMarkupToPdf({ kind: MarkupKind.Markdown, source: "# ok\n" })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.reason).toBe("engine")
      if (r.reason === "engine") expect(r.engine).toBe(MarkupKind.Markdown)
    }
  })
})
