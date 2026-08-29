import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createSpineSession } from "@/lib/core/session"
import { DEFAULT_MODEL } from "@/lib/types"
import { proposePipelineChange } from "@/lib/server/pipeline_assistant"
import { clearLlmProviderCache } from "@/lib/server/llm/registry"
import {
  buildGreenfieldPipelineUserMessage,
  buildProjectAssistantSystemPrompt,
} from "@/lib/server/assistant-prompt"
import { buildVibeTopologyPromptBlock, topologyAdvice } from "@/lib/server/vibe-coding-topology"
import { seedVibeWorkspace } from "@/lib/server/vibe-coding-workspace"

function heldOutPrompts(): string[] {
  const md = readFileSync(resolve(process.cwd(), "../docs/example_prompts.md"), "utf8")
  return [...md.matchAll(/```(?:\w*)\n([\s\S]*?)```/g)]
    .map((m) => m[1]!.trim())
    .filter(Boolean)
}

function livePromptSurfaces(task = "build a workspace"): string[] {
  const session = createSpineSession()
  session.addProject({ open: true })
  const workspace = seedVibeWorkspace({ project: session.project!, globalModel: DEFAULT_MODEL })
  return [
    buildVibeTopologyPromptBlock(),
    buildProjectAssistantSystemPrompt(DEFAULT_MODEL, session.project!.name),
    buildGreenfieldPipelineUserMessage(task),
    workspace.files.get("AGENTS.md") ?? "",
  ]
}

describe("held-out vibe prompts stay out of live builders", () => {
  const prompts = heldOutPrompts()

  it("loads messy prompts from docs/example_prompts.md", () => {
    expect(prompts.length).toBeGreaterThanOrEqual(5)
    expect(prompts.some((p) => /quantum/i.test(p))).toBe(true)
    expect(prompts.some((p) => /know your customer/i.test(p))).toBe(true)
  })

  it("does not leak held-out phrasing into live system / topology / AGENTS.md", () => {
    const surfaces = livePromptSurfaces("hello").join("\n---\n").toLowerCase()
    for (const prompt of prompts) {
      const needle = prompt.trim()
      if (needle.length < 8) continue
      expect(surfaces, `leaked held-out prompt:\n${needle.slice(0, 80)}`).not.toContain(needle.toLowerCase())
    }
    expect(surfaces).not.toContain("know your customer requiremnts")
    expect(surfaces).not.toContain("please build me quantum")
    expect(surfaces).not.toContain("prt stanard")
    expect(surfaces).not.toContain("coal mine is being aquired")
  })

  it("does not score held-out tasks as few-shot topology failures", () => {
    for (const prompt of prompts) {
      expect(topologyAdvice(prompt, ["llm", "input", "output"])).toEqual([])
    }
  })
})

describe("seed LLM can ingest a held-out prompt", () => {
  const prevProvider = process.env.LLM_PROVIDER

  beforeAll(() => {
    process.env.LLM_PROVIDER = "seed"
    clearLlmProviderCache()
  })

  afterAll(() => {
    if (prevProvider === undefined) delete process.env.LLM_PROVIDER
    else process.env.LLM_PROVIDER = prevProvider
    clearLlmProviderCache()
  })

  it("proposePipelineChange does not crash on a messy held-out task", async () => {
    const session = createSpineSession()
    session.addProject({ open: true })
    const result = await proposePipelineChange(session.project!, "Please build me quantum", [])
    expect(result.message.length).toBeGreaterThan(0)
    expect(result).toHaveProperty("proposal")
  })
})
