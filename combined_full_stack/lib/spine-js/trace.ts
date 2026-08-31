// AI : tiny trace sink so workflow.ts and api.ts share recording without an import cycle.
type TraceSink = { steps: unknown[] }

const stack: TraceSink[] = []

export function beginWorkflowTrace(): void {
  stack.push({ steps: [] })
}

export function isWorkflowTracing(): boolean {
  return stack.length > 0
}

export function recordWorkflowStep(step: unknown): void {
  stack.at(-1)?.steps.push(step)
}

export function peekWorkflowTrace<T>(): T[] {
  return (stack.at(-1)?.steps ?? []) as T[]
}

export function takeWorkflowTrace<T>(): T[] {
  const sink = stack.pop()
  return (sink?.steps ?? []) as T[]
}

export function endWorkflowTrace(): void {
  stack.pop()
}
