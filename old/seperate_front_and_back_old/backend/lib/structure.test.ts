import { describe, it, expect } from "vitest";
import { zodFromModel, validate, llmSchema, hasQuoteField, inferModel } from "./structure.js";
import { allModelsToPydantic } from "./pydantic.js";
import { legalModels } from "./seed.js";
import type { StructureModel, StructureModelId } from "./types.js";

const ruleModel = legalModels.find((m) => m.name === "AtomicRule")!;
const combinedModel = legalModels.find((m) => m.name === "EvaluationInput")!;

describe("zodFromModel + validate", () => {
  it("validates a well-formed AtomicRule", () => {
    const value = {
      rule_id: "R-01",
      description: "EU data must stay in the EEA.",
      source: { text: "Personal data of EU residents", quote: { doc_id: "sha_x", start: 5, end: 35 } },
      severity: 5,
    };
    expect(validate(value, ruleModel, legalModels).ok).toBe(true);
  });

  it("rejects a rule with a wrong field type", () => {
    const bad = { rule_id: "R-01", description: "x", source: "not-an-object", severity: "high" };
    expect(validate(bad, ruleModel, legalModels).ok).toBe(false);
  });

  it("resolves list[model] refs (EvaluationInput → AtomicRule[])", () => {
    const schema = zodFromModel(combinedModel, legalModels);
    const parsed = schema.safeParse({
      company_data: { doc_id: "d", purpose: "p", body: "b" },
      company_legal_requirements: [
        { rule_id: "R-1", description: "d", source: { text: "t", quote: { doc_id: "d", start: 0, end: 1 } }, severity: 1 },
      ],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("llmSchema", () => {
  it("collapses quote fields to plain strings for the model to fill", () => {
    const schema = llmSchema(ruleModel, legalModels, false);
    const parsed = schema.safeParse({ rule_id: "R", description: "d", source: "a verbatim quote", severity: 2 });
    expect(parsed.success).toBe(true);
  });

  it("flags models that carry quote fields", () => {
    expect(hasQuoteField(ruleModel)).toBe(true);
    expect(hasQuoteField(combinedModel)).toBe(false);
  });
});

describe("allModelsToPydantic", () => {
  it("emits Quote/Document bases and a class per model", () => {
    const py = allModelsToPydantic(legalModels);
    expect(py).toContain("class Quote(BaseModel):");
    expect(py).toContain("class AtomicRule(BaseModel):");
    expect(py).toContain("class LegalConsiderations(BaseModel):");
  });
});

describe("inferModel (auto-structure)", () => {
  it("infers field types from a sample json value", () => {
    const m: StructureModel = inferModel({ name: "x", count: 3, ratio: 1.5, ok: true }, "Sample", "m_auto" as StructureModelId);
    expect(m.auto).toBe(true);
    expect(m.fields.map((f) => `${f.name}:${f.type}`)).toEqual(["name:text", "count:int", "ratio:float", "ok:bool"]);
  });
});
