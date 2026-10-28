import { describe, expect, it } from "vitest"
import { ModuleKind, type PipelineModule, type PipelineModuleOf } from "@/lib/types"
import {
  applyPipelineModulePatch,
  normalizePipelineModule,
} from "@/lib/server/pipeline-module-union"

const llmBase = {
  id: "mod_llm" as PipelineModule["id"],
  kind: ModuleKind.Llm,
  label: "Extract",
  note: "pull fields",
  cached: true,
  avgMs: 0,
  avgCostCents: 0,
  prompt: "extract the invoice",
}

describe("normalizePipelineModule", () => {
  it("strips webhook fields off an LLM step", () => {
    const raw = {
      ...llmBase,
      webhookUrl: "https://example.com/hook",
      sql: "SELECT 1",
      connectActionId: "slack.postMessage",
    }
    const out = normalizePipelineModule(raw)
    expect(out.kind).toBe(ModuleKind.Llm)
    expect(out.prompt).toBe("extract the invoice")
    expect(out).not.toHaveProperty("webhookUrl")
    expect(out).not.toHaveProperty("sql")
    expect(out).not.toHaveProperty("connectActionId")
  })

  it("keeps webhook fields on a webhook step and strips prompt", () => {
    const out = normalizePipelineModule({
      id: "mod_wh" as PipelineModule["id"],
      kind: ModuleKind.Webhook,
      label: "Call",
      note: "",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
      webhookUrl: "https://example.com/hook",
      prompt: "should not persist",
    })
    expect(out.kind).toBe(ModuleKind.Webhook)
    expect(out.webhookUrl).toBe("https://example.com/hook")
    expect(out).not.toHaveProperty("prompt")
  })

  it("strips nested fork-lane leftovers", () => {
    const out = normalizePipelineModule({
      id: "mod_fork" as PipelineModule["id"],
      kind: ModuleKind.Fork,
      label: "Fork",
      note: "split",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
      forkJoin: "product",
      forkBranches: [
        {
          id: "b1",
          label: "A",
          modules: [
            {
              ...llmBase,
              webhookUrl: "https://evil.example",
            },
          ],
        },
      ],
    })
    expect(out.kind).toBe(ModuleKind.Fork)
    const lane = out.forkBranches?.[0]?.modules[0]
    expect(lane?.kind).toBe(ModuleKind.Llm)
    expect(lane).not.toHaveProperty("webhookUrl")
  })

  it("applyPipelineModulePatch drops fields that do not belong after a kind change", () => {
    const llm = normalizePipelineModule(llmBase)
    const webhook = applyPipelineModulePatch(llm, {
      kind: ModuleKind.Webhook,
      webhookUrl: "https://example.com/hook",
    })
    expect(webhook.kind).toBe(ModuleKind.Webhook)
    expect(webhook.webhookUrl).toBe("https://example.com/hook")
    expect(webhook).not.toHaveProperty("prompt")
  })

  it("keeps authored OCR flags on Input and strips webhook leftovers", () => {
    const out = normalizePipelineModule({
      id: "mod_in" as PipelineModule["id"],
      kind: ModuleKind.Input,
      label: "PDF",
      note: "",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
      useOcr: true,
      prompt: "read the scan",
      webhookUrl: "https://example.com/hook",
    })
    expect(out.kind).toBe(ModuleKind.Input)
    expect(out.useOcr).toBe(true)
    expect(out.prompt).toBe("read the scan")
    expect(out).not.toHaveProperty("webhookUrl")
  })

  it("keeps generated fallbackList on Chunk", () => {
    const out = normalizePipelineModule({
      id: "mod_ch" as PipelineModule["id"],
      kind: ModuleKind.Chunk,
      label: "Chunk",
      note: "",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
      chunkSize: 2000,
      fallbackList: [{ typescript: "(input) => input" }],
      webhookUrl: "https://example.com/hook",
    })
    expect(out.kind).toBe(ModuleKind.Chunk)
    expect(out.fallbackList?.[0]?.typescript).toBe("(input) => input")
    expect(out).not.toHaveProperty("webhookUrl")
  })
})

describe("PipelineModule discriminated union", () => {
  it("rejects a webhookUrl on an LLM module at the type level", () => {
    const llm: PipelineModuleOf<ModuleKind.Llm> = {
      id: "mod_t" as PipelineModule["id"],
      kind: ModuleKind.Llm,
      label: "T",
      note: "",
      cached: true,
      avgMs: 0,
      avgCostCents: 0,
      prompt: "hi",
    }
    const _check: undefined = llm.webhookUrl
    expect(_check).toBeUndefined()
  })
})
