import { describe, expect, it } from "vitest"
import { findReactFileForText, patchReactFilesText } from "@/lib/hosted-site-react-select"

const FILES = [
  { path: "src/App.tsx", contents: `export default function App() { return <h1>Invoice ops</h1> }` },
  { path: "src/components/RunPipeline.tsx", contents: `export function RunPipeline() { return <div>Invoice ops</div> }` },
  { path: "src/Hero.tsx", contents: `export function Hero() { return <p>Workspace</p> }` },
]

describe("hosted site react click-to-edit", () => {
  it("finds unique text in App.tsx and ignores host widget files", () => {
    expect(findReactFileForText(FILES, "Invoice ops")).toBe("src/App.tsx")
    expect(findReactFileForText(FILES, "Workspace")).toBe("src/Hero.tsx")
    expect(findReactFileForText(FILES, "missing")).toBeNull()
  })

  it("patches unique preview text without an LLM", () => {
    const next = patchReactFilesText(FILES, "Invoice ops", "Payroll ops")
    expect(next?.find((f) => f.path === "src/App.tsx")?.contents).toContain("Payroll ops")
    expect(next?.find((f) => f.path === "src/App.tsx")?.contents).not.toContain("Invoice ops")
    expect(next?.find((f) => f.path === "src/Hero.tsx")?.contents).toContain("Workspace")
  })

  it("refuses to patch when the string is not unique", () => {
    const dup = [...FILES, { path: "src/Copy.tsx", contents: `<h1>Invoice ops</h1>` }]
    expect(patchReactFilesText(dup, "Invoice ops", "X")).toBeNull()
  })
})
