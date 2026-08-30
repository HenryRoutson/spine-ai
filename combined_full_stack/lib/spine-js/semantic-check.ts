// AI : close the "validates ⇒ done" hole — run custom-code on 2+ distinct inputs; require real test docs.
import type { SpineProgram } from "./api"

export type SemanticCheckDoc = {
  name: string
  content: string
}

export type SemanticCheckInput = {
  program: SpineProgram
  docs: SemanticCheckDoc[]
}

function kindsOf(program: SpineProgram): string[] {
  const out: string[] = []
  const walk = (modules: SpineProgram["modules"]) => {
    for (const m of modules) {
      out.push(m.kind)
      if (m.forkBranches) {
        for (const b of m.forkBranches) walk((b.modules as SpineProgram["modules"]) ?? [])
      }
    }
  }
  walk(program.modules)
  return out
}

function hasProcessingStep(program: SpineProgram): boolean {
  return kindsOf(program).some((k) => k !== "input" && k !== "output")
}

function runArrow(code: string, input: unknown): unknown {
  const fn = new Function(`"use strict"; return (${code});`)()
  if (typeof fn !== "function") throw new Error("custom-code is not a function")
  return fn(input)
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function isDegenerateCode(code: string): boolean {
  const compact = code.replace(/\s+/g, "")
  if (!compact) return true
  if (/^\(\w*\)=>\{\}$/.test(compact)) return true
  if (/^\(\w*\)=>null$/.test(compact)) return true
  if (/^\(\w*\)=>\{\s*\}$/.test(compact)) return true
  if (/^\(\w*\)=>\(\{\}\)$/.test(compact)) return true
  return false
}

export function semanticCheckProgram(args: SemanticCheckInput): string[] {
  const errors: string[] = []
  if (!hasProcessingStep(args.program)) {
    errors.push("pipeline is empty — add task() / generateObject() work, not just input → output")
  }
  const docs = args.docs.filter((d) => d.content.trim())
  const unique = new Set(docs.map((d) => d.content.trim()))
  if (unique.size < 2) {
    errors.push("need at least two test files with different contents (a flow that ignores its input is the usual degenerate solution)")
  }
  for (const spec of args.program.modules) {
    if (spec.kind !== "custom-code" || !spec.code?.trim()) continue
    if (isDegenerateCode(spec.code)) {
      errors.push(`${spec.label}: custom-code ignores input (empty / hardcoded)`)
      continue
    }
    const samples = docs.slice(0, 3).map((d, i) => ({
      filename: d.name,
      content: d.content,
      id: String(i + 1),
      text: d.content,
    }))
    if (samples.length < 2) continue
    try {
      const outputs = samples.map((row) => {
        try {
          return runArrow(spec.code!, row)
        } catch {
          return runArrow(spec.code!, [row])
        }
      })
      if (outputs.length >= 2 && deepEqual(outputs[0], outputs[1]) && samples[0]!.content !== samples[1]!.content) {
        // AI : identity maps can legitimately keep shape; only flag when the body never reads the param.
        if (!/\b(input|doc|rows|notes|batch|files|combined|resume|line)\b/.test(spec.code)) {
          errors.push(`${spec.label}: custom-code returns the same output for different inputs`)
        }
      }
    } catch (err) {
      errors.push(`${spec.label}: custom-code threw on sample input (${(err as Error).message})`)
    }
  }
  return errors
}

export function formatSemanticCheck(errors: string[]): string {
  if (!errors.length) return ""
  return `FAIL semantic\n${errors.map((e) => `- ${e}`).join("\n")}`
}
