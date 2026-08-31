import { describe, expect, it } from "vitest"
import { buildHostedSiteFileTree, visibleHostedSiteFileTree } from "@/lib/hosted-site-file-tree"
import { canDeleteHostedSiteReactPath } from "@/lib/hosted-site-react"

describe("hosted site file tree (bolt.diy workbench)", () => {
  it("inserts folders and sorts folders before files", () => {
    const tree = buildHostedSiteFileTree([
      "src/App.tsx",
      "package.json",
      "src/components/RunPipeline.tsx",
      "src/Hero.tsx",
    ])
    expect(tree.map((n) => `${n.kind}:${n.path}`)).toEqual([
      "folder:src",
      "folder:src/components",
      "file:src/components/RunPipeline.tsx",
      "file:src/App.tsx",
      "file:src/Hero.tsx",
      "file:package.json",
    ])
    expect(tree.find((n) => n.path === "src/components")?.depth).toBe(1)
  })

  it("hides children of collapsed folders", () => {
    const tree = buildHostedSiteFileTree(["src/App.tsx", "src/components/Hero.tsx", "vite.config.ts"])
    const visible = visibleHostedSiteFileTree(tree, new Set(["src"]))
    expect(visible.map((n) => n.path)).toEqual(["src", "vite.config.ts"])
  })

  it("protects host widget files from delete", () => {
    expect(canDeleteHostedSiteReactPath("src/App.tsx")).toBe(false)
    expect(canDeleteHostedSiteReactPath("src/components/RunPipeline.tsx")).toBe(false)
    expect(canDeleteHostedSiteReactPath("src/Hero.tsx")).toBe(true)
  })
})
