#!/usr/bin/env npx tsx
// AI : TODO refactor — add vitest for validity, run-fingerprint, quotation, billing (no runtime tests yet).
// AI : generate models.py + pipeline_types from a seed/project JSON and optionally run pyright/tsc.
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { spawnSync } from "child_process";
import { loadProjectSeed } from "../lib/server/seed";
import { generatePipelineTypes } from "../lib/server/type_codegen";
import { computeInvalid, invalidIssuesForModule } from "../lib/server/validity";

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
writeFileSync(join(outDir, "pipeline_types.d.ts"), generated.pipelineDts);

const modelsDts = [
  "export type Quote = { doc_id: string; start: number; end: number };",
  "export type TextQuote = { text: string; quote: Quote };",
  "export type Document = { content: string; filename: string };",
  "export type FileInput = Document;",
  "",
  ...project.models.map((m) => {
    const fields = m.fields
      .map((f) => `  ${f.name}: unknown;`)
      .join("\n");
    return `export type ${m.name} = {\n${fields}\n};`;
  }),
  "",
].join("\n");
writeFileSync(join(outDir, "models.d.ts"), modelsDts);

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

const invalid = computeInvalid(project.modules, project.models);
let staticErrors = 0;
console.log(`\n=== static pipeline type errors (${project.name}) ===\n`);
for (const m of project.modules) {
  const issues = invalidIssuesForModule(invalid, m.id);
  for (const issue of issues) {
    staticErrors++;
    console.log(`[${m.label}] (${m.kind}) ${issue.kind}: ${issue.expectsType ?? issue.missingLabel ?? issue.expects ?? ""}`);
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
