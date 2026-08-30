// AI : JS authoring prompts — LLM writes ordinary async TypeScript; compileSpineJs traces workflow/task into JSON IR.
import { buildVibeTopologyPromptBlock } from "@/lib/server/vibe-coding-topology"
import { payloadToWorkflow } from "./payload-to-workflow"
import { retrieveVibeExamples, vibeExampleTasks } from "@/lib/server/vibe-coding-examples"

export function buildSpineJsFewShotBlock(task?: string): string {
  const examples = task?.trim() ? retrieveVibeExamples(task, 3) : [vibeExampleTasks().find((t) => t.id === "ex1") ?? vibeExampleTasks()[0]].filter(Boolean)
  if (!examples.length) return ""
  const blocks = examples.map(
    (ex) => `Task: "${ex.prompt}"
\`\`\`ts
${payloadToWorkflow(ex.payload)}
\`\`\``,
  )
  return `Nearest working examples (copy the TypeScript shape, change names for the task):\n${blocks.join("\n\n")}\n`
}

export function buildSpineJsSystemPrompt(task?: string): string {
  return `You are authoring a Spine pipeline in ordinary TypeScript (Windmill-style workflows as code). Do not emit a JSON modules array or OpenFlow graph.

API:
import { z, model, workflow, task, step, generateObject, Document } from "spine"

- model("Name", { field: z.string().describe("...") }) — Zod schema with a name
- generateObject({ schema, prompt, note? }) — structured LLM call (Vercel AI SDK shape)
- task(fn) — checkpointed job; types come from fn's signature
- step("name", () => ...) — inline custom-code (split, flatten, join)
- workflow(async (input) => { ... }) as export const main
- for (const item of files) { rows.push(await task(fn)(item)) } — many files → batch
- Promise.all([task(a)(doc), task(b)(doc)]) — independent extracts (fork)
- two workflow args — two uploads; process the first, keep the second raw until you need it
- try/catch is ordinary TypeScript

Rules:
- Many same-kind files → for-loop + task(generateObject), never one generateObject over the whole list.
- Non-JSON uploads are Document (filename + content). Parsed rows belong in generateObject schemas.
- Export const message = "I'll add…" (present/future tense).
- Export const docs = [{ name, type: "text"|"json"|"markdown", content }] — at least TWO files with different contents.
- Caching / DAG / traces are library exports — do not encode them as fields.

${buildVibeTopologyPromptBlock()}

${buildSpineJsFewShotBlock(task)}
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
    ? `\nYour previous TypeScript failed to compile. Fix ALL errors and return a full corrected module:\n${args.fixErrors.trim()}\n`
    : ""
  return `Task: ${args.task}
${buildVibeTopologyPromptBlock()}
${thinking}${args.extra}${fix}

Return a TypeScript module with export const main = workflow(...). You may wrap it in a \`\`\`ts fence. Do not return a JSON modules array.
`
}
