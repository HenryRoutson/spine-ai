import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectSeed } from "@/lib/server/seed";
import { computeInvalid } from "@/lib/server/validity";
import { lintPipelineExportTs } from "@/lib/server/pipeline_export_lint";
import { SEEDS_DIR } from "@/lib/server/seed";

describe("pipeline TS export lint", () => {
  const seeds = readdirSync(SEEDS_DIR).filter((f) => f.endsWith(".json"));

  it.each(seeds)("generates lint-clean TS for %s", (file) => {
    const { project } = loadProjectSeed(resolve(SEEDS_DIR, file));
    const invalid = computeInvalid(project.modules, project.models, {
      typeAliases: project.typeAliases ?? [],
    });
    if (invalid.size > 0) return;

    const result = lintPipelineExportTs(project);
    expect(result.ok, `${file} export lint failed:\n${result.diagnostics.join("\n")}`).toBe(true);
  });
});
