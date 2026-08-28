import { describe, expect, it } from "vitest";
import {
  extractContextFromPrompt,
  extractJsonSchemaFromPrompt,
  seedLlmReply,
  seedNamedFunctionFromPrompt,
} from "@/lib/server/llm/seed_response";

describe("seed LLM reply", () => {
  it("fills summary from INPUT DATA text (UI schema-first prompt)", () => {
    const prompt = `Respond with ONLY a JSON value that validates against this JSON Schema:
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "summary": { "type": "string" }
  },
  "required": ["id", "summary"]
}

Summarize the line.

INPUT DATA:
{
  "id": "1",
  "text": "Product launch checklist"
}`;
    expect(JSON.parse(seedLlmReply(prompt, true))).toEqual({
      id: "1",
      summary: "Summary of: Product launch checklist",
    });
  });

  it("fills summary from export schema-last prompt", () => {
    const prompt = `Summarize the checklist line.

INPUT DATA:
{"id":"2","text":"Write onboarding emails"}

Respond with ONLY a JSON value that validates against this JSON Schema:
{"type":"object","properties":{"id":{"type":"string"},"summary":{"type":"string"}},"required":["id","summary"]}`;
    expect(JSON.parse(seedLlmReply(prompt, true))).toEqual({
      id: "2",
      summary: "Summary of: Write onboarding emails",
    });
  });

  it("marks example-select relevance true", () => {
    const schema = extractJsonSchemaFromPrompt(
      `Respond with ONLY a JSON value that validates against this JSON Schema:\n{"type":"object","properties":{"chain_of_thought":{"type":"string"},"is_relevant":{"type":"boolean"}},"required":["chain_of_thought","is_relevant"]}\n\nhi`,
    );
    expect(schema?.properties?.is_relevant).toBeTruthy();
    const reply = JSON.parse(
      seedLlmReply(
        `Respond with ONLY a JSON value that validates against this JSON Schema:\n{"type":"object","properties":{"chain_of_thought":{"type":"string"},"is_relevant":{"type":"boolean"}},"required":["chain_of_thought","is_relevant"]}\n\n{"id":"ex1"}`,
        true,
      ),
    );
    expect(reply.is_relevant).toBe(true);
  });

  it("extractContext prefers INPUT DATA", () => {
    const ctx = extractContextFromPrompt('noise {"a":1}\nINPUT DATA:\n{"b":2}');
    expect(ctx).toEqual({ b: 2 });
  });

  it("parses a second function name from a non-technical ask", () => {
    expect(
      seedNamedFunctionFromPrompt(
        "Keep Main. Also add a second function named Hello Notes that greets pasted text.",
      ),
    ).toBe("Hello Notes");
  });

  it("fills a valid project-assistant proposal for a named second function", () => {
    const prompt = `Respond with ONLY a JSON value that validates against this JSON Schema:
{"type":"object","properties":{"message":{"type":"string"},"modules":{"type":"array"},"modulePatch":{},"models":{},"typeAliases":{},"docs":{},"documentationUpdate":{},"projectNameUpdate":{},"targetFunctionName":{},"proposedActions":{}}}

Project: Untitled Pipeline (blank)

User request: Keep Main. Also add a second function named Hello Notes that greets pasted text.`;
    const reply = JSON.parse(seedLlmReply(prompt, true)) as {
      targetFunctionName: string | null;
      modules: unknown[];
      modulePatch: unknown;
    };
    expect(reply.targetFunctionName).toBe("Hello Notes");
    expect(reply.modules.length).toBe(3);
    expect(reply.modulePatch).toBeNull();
  });
});
