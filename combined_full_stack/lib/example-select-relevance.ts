import { z } from "zod"

// AI : fixed relevance schema — shared by runtime LLM calls and pipeline builder preview.
export const exampleSelectRelevanceSchema = z.object({
  chain_of_thought: z
    .string()
    .describe("Why this example might or might not be useful for the task"),
  is_relevant: z.boolean().describe("Whether to include this example in the filtered output"),
})

export type ExampleSelectRelevanceResult = z.infer<typeof exampleSelectRelevanceSchema>

export function exampleSelectRelevanceSchemaJson(): string {
  return JSON.stringify(z.toJSONSchema(exampleSelectRelevanceSchema), null, 2)
}

export function exampleSelectStructuredPrompt(userPrompt: string): string {
  return `Respond with ONLY a JSON value that validates against this JSON Schema:\n${exampleSelectRelevanceSchemaJson()}\n\n${userPrompt}`
}

export function fillExampleSelectPrompt(
  template: string,
  description: string,
  example: unknown,
): string {
  // AI : TODO (example-select-view) — stringify the prompt view (examplePromptFields / template), not the
  // AI :   full spine item. Opaque nested FKs (billed_items.work_item_id) must not land in the uncached suffix.
  // AI : TODO (sql-schema) — example text is the view row (SELECT); stringify JSON or format columns.
  const exampleText =
    typeof example === "string" ? example : JSON.stringify(example, null, 2)
  return template
    .replace(/\{description\}/g, description)
    .replace(/\{example\}/g, exampleText)
    .replace(/\{input_to_prompt\}/g, exampleText)
  // AI : TODO (sql-schema) — also .replace(/\{input_to_prompt\}/g, exampleText). Caller already projected.
}
