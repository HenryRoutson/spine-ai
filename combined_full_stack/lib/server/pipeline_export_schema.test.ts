import { describe, expect, it } from "vitest"
import { join } from "node:path"
import { loadProjectSeed, SEEDS_DIR } from "@/lib/server/seed"
import { generatePipelineSourceTs } from "@/lib/server/pipeline_ts_export"
import { generatePipelineSourcePy } from "@/lib/server/pipeline_py_export"
import { generatePipelineSourceRust } from "@/lib/server/pipeline_rs_export"
import { generatePipelineSourceGo } from "@/lib/server/pipeline_go_export"
import { ModuleKind } from "@/lib/server/types"

describe("LLM export JSON schemas", () => {
  it("inlines structure JSON schema instead of empty stubs", () => {
    const { project } = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"))
    const hasLlm = project.modules.some((m) => m.kind === ModuleKind.Llm || m.kind === ModuleKind.LlmBatch)
    expect(hasLlm).toBe(true)
    const ts = generatePipelineSourceTs(project)
    const py = generatePipelineSourcePy(project)
    const rs = generatePipelineSourceRust(project)
    const go = generatePipelineSourceGo(project)
    expect(ts).not.toMatch(/\/\* JSON schema for .* \*\/ \{\}/)
    expect(py).not.toMatch(/schema = None  # JSON schema/)
    expect(rs).not.toMatch(/serde_json::json!\(\{\}\}.*JSON schema/)
    expect(go).not.toMatch(/json\.RawMessage\(\[\]byte\("\{\}"\)\).*JSON schema/)
    expect(ts).toMatch(/"type":/)
    expect(py).toMatch(/json\.loads\("/)
    expect(rs).toMatch(/serde_json::from_str\("/)
    expect(go).toMatch(/json\.RawMessage\(\[\]byte\("/)
  })
})
