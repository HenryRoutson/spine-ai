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

  it("fills generic enum fields with the first value (this is why list_dir scored 0)", () => {
    const reply = JSON.parse(
      seedLlmReply(
        `Respond with ONLY a JSON value that validates against this JSON Schema:
{"type":"object","properties":{"tool":{"type":"string","enum":["list_dir","write_file"]}},"required":["tool"]}`,
        true,
      ),
    ) as { tool: string };
    expect(reply.tool).toBe("list_dir");
  });

  it("vibe harness schema writes pipeline.json instead of only list_dir", () => {
    const schema = `Respond with ONLY a JSON value that validates against this JSON Schema:
{"type":"object","properties":{"tools":{"type":"array","items":{"type":"object","properties":{"tool":{"enum":["write_file","read_file","run_tests","list_dir","delete_file","done"]}}}}}}`

    const first = JSON.parse(
      seedLlmReply(`${schema}\n\nTurn 1/8\nTask: Convert hundreds of unstructured receipts into a single Excel file\nWorkspace (already loaded):\npipeline.json\n[]\n`, true),
    ) as { tools: { tool: string; path?: string }[] };
    expect(first.tools.some((t) => t.tool === "write_file" && t.path === "pipeline.json")).toBe(true);
    expect(first.tools.some((t) => t.tool === "write_file" && t.path?.includes("ReceiptRow"))).toBe(true);

    const afterWrite = JSON.parse(
      seedLlmReply(`${schema}\n\nTurn 2/8\nTask: Convert hundreds of unstructured receipts into a single Excel file\nLast tool results:\n$ write_file pipeline.json\nwrote pipeline.json (120 chars)\n`, true),
    ) as { tools: { tool: string }[] };
    expect(afterWrite.tools.map((t) => t.tool)).toEqual(["run_tests"]);

    const afterTests = JSON.parse(
      seedLlmReply(
        `${schema}\n\nTurn 3/8\nTask: Convert hundreds of unstructured receipts into a single Excel file\nLast tool results:\n$ write_file pipeline.json\nwrote pipeline.json (120 chars)\n\n$ run_tests\nPASS\n`,
        true,
      ),
    ) as { tools: { tool: string }[] };
    expect(afterTests.tools.map((t) => t.tool)).toEqual(["done"]);
  });
});
