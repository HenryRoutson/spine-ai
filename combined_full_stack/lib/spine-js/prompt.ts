// AI : JS authoring prompts — LLM writes Windmill-shaped workflow(); compileSpineJs converts to JSON IR.
import { buildVibeTopologyPromptBlock } from "@/lib/server/vibe-coding-topology"
import { payloadToSpineJs } from "./payload-to-js"
import { vibeExampleTasks } from "@/lib/server/vibe-coding-examples"

export function buildSpineJsFewShotBlock(): string {
  const tasks = vibeExampleTasks()
  const first = tasks.find((t) => t.id === "ex1") ?? tasks[0]
  if (!first) return ""
  return `Example (copy the shape, change names for the task):
Task: "${first.prompt}"
\`\`\`js
${payloadToSpineJs(first.payload)}
\`\`\`
`
}

export function buildSpineJsSystemPrompt(): string {
  return `You are authoring a Spine pipeline in ordinary TypeScript using workflow() / task() (Windmill workflows-as-code), not custom JSON.

Write a JS/TS module. Do not return a modules JSON array. Do not describe a node/edge graph.

API — ordinary async function. Each step helper takes ONE object (parsed by Zod). Put the I/O Zod schema in \`schema\`:
- model("Name", { field: z.string().describe("...") })
- input({ schema, note, type, label? })  // non-JSON types must use Document or z.array(Document)
- llm({ schema, note, prompt, in? })
- llmBatch({ schema, note, prompt, in? })  // schema is the ITEM type; kind already emits a list
- customCode({ schema, code, note?, in? })  // code is a TypeScript arrow (rows) => ...
- combine({ in, note, label? })  // in is the state structure, not list[...]
- assemble({ bindings, note })
- fork({ note, join, branches: [{ label, steps: [...] }] })  // at least 2 lanes
- output({ schema })
- task(fn) marks a named function as its own step (fn must call a step helper)
- workflow(async () => { ... }) as export const main

Rules:
- Many same-kind files → input({ schema: z.array(Document) }) + llmBatch, never a single llm.
- Non-JSON input schema is Document or z.array(Document). Typed rows belong on a later llm/llm-batch.
- llm-batch \`in\` is the item (Document), never z.array(Document).
- notes are required on input / llm / llm-batch / combine / assemble / fork.
- Caching, DAG mermaid, and per-step traces are library exports — do not encode them as JSON fields.
- Schema-valid is not done: include a real transforming step and distinct sample docs.
${buildVibeTopologyPromptBlock()}

Also export:
export const message = "I'll add…"  // present/future tense
export const docs = [{ name, type: "text"|"json"|"markdown"|"latex", content }]
export const documentation = "# ..."
export const projectName = "..."  // only when untitled

${buildSpineJsFewShotBlock()}
`
}

export function buildSpineJsUserPrompt(args: {
  task: string
  thinking: string
  extra: string
  fixErrors?: string
}): string {
  const thinking = args.thinking.trim()
    ? `\nPrior reasoning:\n${args.thinking.trim().slice(0, 6_000)}\n`
    : ""
  const fix = args.fixErrors?.trim()
    ? `\nYour previous JavaScript failed. Fix ALL errors and return a full corrected module:\n${args.fixErrors.trim()}\n`
    : ""
  return `Task: ${args.task}
${buildVibeTopologyPromptBlock()}
${thinking}${args.extra}${fix}

Return a JavaScript module with export const main = workflow(async () => { ... }). You may wrap it in a \`\`\`js fence. Do not return a JSON modules array.
`
}
