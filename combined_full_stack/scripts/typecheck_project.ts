#!/usr/bin/env npx tsx
// AI : TODO (linter-first) — primary path: generate models.py + pipeline_types.py (+ optional .rs), run pyright/cargo.
// AI : TODO (linter-first) — drop computeInvalid static pass once pyright/cargo is source of truth for spine IO.
// AI : TODO (linter-first) — add --cargo / --pyright-only flags; deprioritize tsc (TS stubs are secondary).
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { spawnSync } from "child_process";
import { loadProjectSeed } from "../lib/server/seed";
import { generatePipelineTypes } from "../lib/server/type_codegen";
import { computeInvalid, invalidIssuesForModule } from "../lib/server/validity";
import { invalidStepMessage } from "../lib/server/validity-messages";
import { withSharedModels } from "../lib/server/builtin_models";

const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith("-"));
const outDir = resolve(args.includes("--out") ? args[args.indexOf("--out") + 1]! : ".typecheck/generated");
const runPyright = args.includes("--pyright");
const runTsc = args.includes("--tsc");

if (!jsonPath) {
  console.error("Usage: npx tsx scripts/typecheck_project.ts <seed.json> [--out dir] [--pyright] [--tsc]");
  process.exit(1);
}

const abs = resolve(jsonPath);
const { project } = loadProjectSeed(abs);
const generated = generatePipelineTypes(project);

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "models.py"), generated.modelsPy);
writeFileSync(join(outDir, "pipeline_types.py"), generated.pipelinePy);
writeFileSync(join(outDir, "models.d.ts"), generated.modelsDts);
writeFileSync(join(outDir, "pipeline_types.d.ts"), generated.pipelineDts);

const tsconfig = {
  compilerOptions: {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    moduleResolution: "bundler" as const,
    target: "ES2022",
    module: "ESNext",
  },
  include: ["*.d.ts"],
};
writeFileSync(join(outDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2));

const pyrightconfig = {
  include: ["."],
  typeCheckingMode: "basic",
  pythonVersion: "3.11",
};
writeFileSync(join(outDir, "pyrightconfig.json"), JSON.stringify(pyrightconfig, null, 2));

const invalid = computeInvalid(project.modules, project.models, {
  typeAliases: project.typeAliases ?? [],
});
const modelsForMessages = withSharedModels(project.models);
let staticErrors = 0;
console.log(`\n=== static pipeline type errors (${project.name}) ===\n`);
for (const m of project.modules) {
  const issues = invalidIssuesForModule(invalid, m.id);
  for (const issue of issues) {
    staticErrors++;
    const msg =
      issue.kind === "structure-field"
        ? (issue.structureMessage ?? "structure field error")
        : invalidStepMessage(issue, modelsForMessages, project.modules);
    console.log(`[${m.label}] (${m.kind}) ${issue.kind}: ${msg}`);
  }
}
if (staticErrors === 0) console.log("(none)");

console.log(`\nWrote ${outDir}/models.py, pipeline_types.py, pipeline_types.d.ts\n`);

if (runPyright) {
  const pyright = spawnSync("pyright", [outDir], { encoding: "utf8" });
  if (pyright.stdout) process.stdout.write(pyright.stdout);
  if (pyright.stderr) process.stderr.write(pyright.stderr);
  if (pyright.status !== 0) process.exit(pyright.status ?? 1);
}

if (runTsc) {
  const tsc = spawnSync("npx", ["tsc", "-p", join(outDir, "tsconfig.json")], { encoding: "utf8" });
  if (tsc.stdout) process.stdout.write(tsc.stdout);
  if (tsc.stderr) process.stderr.write(tsc.stderr);
  if (tsc.status !== 0) process.exit(tsc.status ?? 1);
}

if (staticErrors > 0) process.exit(1);
