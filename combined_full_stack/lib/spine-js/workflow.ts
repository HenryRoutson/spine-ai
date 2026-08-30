// AI : Windmill-shaped authoring — ordinary async TS; compileSpineJs lowers it to Spine JSON IR.
import { pipeline, takeLastSpineProgram, type SpineProgram, type StepHandle } from "./api"
import {
  beginWorkflowTrace,
  endWorkflowTrace,
  isWorkflowTracing,
  peekWorkflowTrace,
} from "./trace"

export type WorkflowFn = () => unknown

function rootTracedSteps(steps: StepHandle[]): StepHandle[] {
  // AI : fork/ifElse eval nested llm() before the parent call — drop those from the linear spine.
  const nested = new Set<unknown>()
  for (const s of steps) {
    const branches = (s.spec as { forkBranches?: { modules?: unknown[] }[] }).forkBranches
    if (!Array.isArray(branches)) continue
    for (const b of branches) {
      for (const m of b.modules ?? []) nested.add(m)
    }
  }
  return nested.size ? steps.filter((s) => !nested.has(s.spec)) : steps
}

export function workflow(fn: WorkflowFn): SpineProgram {
  beginWorkflowTrace()
  try {
    fn()
    const captured = takeLastSpineProgram()
    if (captured?.modules.length) return captured
    const steps = rootTracedSteps(peekWorkflowTrace<StepHandle>())
    if (!steps.length) {
      throw new Error("workflow() recorded no steps — call input/llm/llmBatch/task inside the function")
    }
    return pipeline(...steps)
  } finally {
    endWorkflowTrace()
  }
}

export function task<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  return (...args: A) => {
    if (!isWorkflowTracing()) return fn(...args)
    const before = peekWorkflowTrace().length
    const result = fn(...args)
    if (peekWorkflowTrace().length === before) {
      throw new Error(
        `task(${fn.name || "anonymous"}) called no Spine steps — use input/llm/llmBatch/customCode inside it`,
      )
    }
    return result
  }
}

export function step<R>(name: string, fn: () => R): R {
  if (!isWorkflowTracing()) return fn()
  const before = peekWorkflowTrace().length
  const result = fn()
  if (peekWorkflowTrace().length === before) {
    throw new Error(`step(${JSON.stringify(name)}) called no Spine steps — use input/llm/customCode inside it`)
  }
  return result
}
