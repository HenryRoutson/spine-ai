import { describe, it, expect } from "vitest";
import { computeInvalid, isPipelineValid, canRunStep } from "./validity.js";
import { legalModules } from "./seed.js";
import type { PipelineModule, StructureModelId } from "./types.js";

describe("computeInvalid", () => {
  it("the seeded legal pipeline is valid", () => {
    expect(isPipelineValid(legalModules)).toBe(true);
    expect(computeInvalid(legalModules).size).toBe(0);
  });

  it("flags a step whose input model != upstream output model", () => {
    const broken: PipelineModule[] = legalModules.map((m) =>
      m.id === "mod_extract_rules" ? { ...m, inStructureId: "m_report" as StructureModelId } : m,
    );
    const invalid = computeInvalid(broken);
    expect(invalid.has("mod_extract_rules" as PipelineModule["id"])).toBe(true);
  });

  it("never flags input or combine steps", () => {
    const invalid = computeInvalid(legalModules);
    expect(invalid.has("mod_input_company" as PipelineModule["id"])).toBe(false);
    expect(invalid.has("mod_combine" as PipelineModule["id"])).toBe(false);
  });

  it("run button is dark when the pipeline is invalid", () => {
    const broken: PipelineModule[] = legalModules.map((m) =>
      m.id === "mod_extract_rules" ? { ...m, inStructureId: "m_report" as StructureModelId } : m,
    );
    expect(canRunStep(broken, "mod_doc2text" as PipelineModule["id"], true)).toBe(false);
  });
});
