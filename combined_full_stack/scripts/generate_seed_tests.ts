// AI : one-shot — give every example seed a *_testing.json test file (spec § Testing).
// AI : golden expectedOutputs are inlined where the seed ships them; otherwise output steps
// AI : get null placeholders (partial tests are by design — only listed steps are checked).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildDefaultInputDocs, orderedInputModules } from "../lib/inference-input";
import { loadProjectSeed, SEEDS_DIR } from "../lib/server/seed";
import { validateTestFile, type SpineTestFile } from "../lib/testing-files";
import { DocLabel } from "../lib/server/types";
import type { DocId, DocRef, Project } from "../lib/server/types";

function seedDocRefs(project: Project, rawDocs: { name: string; type: string; label: string }[]): DocRef[] {
  return rawDocs.map((d) => ({
    id: d.name as DocId,
    name: d.name,
    type: d.type as DocRef["type"],
    label: d.label as DocRef["label"],
    sizeKb: 0,
    uploadedAt: 0,
    preview: "",
  }));
}

function buildInputs(project: Project, docRefs: DocRef[]): Record<string, string | string[]> {
  const inputModules = orderedInputModules(project.modules);
  const assignment = buildDefaultInputDocs(docRefs, project, inputModules);
  const inputs: Record<string, string | string[]> = {};
  for (const m of inputModules) {
    const v = assignment[m.id];
    if (Array.isArray(v)) inputs[m.label.trim()] = v.map((d) => d.name);
    else if (v) inputs[m.label.trim()] = v.name;
    // AI : type-mismatch seeds (e.g. json doc on a text input) — fall back to the first inference doc.
    else inputs[m.label.trim()] = docRefs.find((d) => d.label === DocLabel.Inference)?.name ?? "";
  }
  return inputs;
}

function buildExpectedOutputs(project: Project): Record<string, unknown> {
  const golden = project.expectedOutputs ?? {};
  if (Object.keys(golden).length) {
    // AI : input steps log doc refs; combine logs a field summary — same data, not scored in tests.
    const unpinnable = new Set(
      project.modules.filter((m) => m.kind === "input" || m.kind === "combine").map((m) => m.label.trim()),
    );
    return Object.fromEntries(Object.entries(golden).filter(([label]) => !unpinnable.has(label.trim())));
  }
  const out: Record<string, unknown> = {};
  for (const m of project.modules) {
    if (m.kind === "output" && m.label.trim()) out[m.label.trim()] = null;
  }
  return out;
}

let wrote = 0;
for (const f of readdirSync(SEEDS_DIR).filter((x) => x.endsWith(".json")).sort()) {
  const seedPath = join(SEEDS_DIR, f);
  const seed = loadProjectSeed(seedPath);
  const raw = JSON.parse(readFileSync(seedPath, "utf8")) as {
    docs: { name: string; type: string; label: string; file: string }[];
  };
  const base = basename(f, ".json");
  const testName = `${base}_testing.json`;
  const docsDir = raw.docs[0]?.file.split("/")[0] ?? base;
  const testRelFile = `${docsDir}/${testName}`;

  const sourceDocs = raw.docs.filter((d) => !d.name.endsWith("_testing.json"));
  const docRefs = seedDocRefs(seed.project, sourceDocs);
  const hasGolden = !!seed.project.expectedOutputs && Object.keys(seed.project.expectedOutputs).length > 0;
  const test: SpineTestFile = {
    description: hasGolden
      ? `Step-by-step test for ${seed.project.name} — expected outputs from the bundled golden fixtures.`
      : `Test scaffold for ${seed.project.name} — inputs are pinned; fill the null expected outputs from a verified run (only listed steps are checked).`,
    inputs: buildInputs(seed.project, docRefs),
    expectedOutputs: buildExpectedOutputs(seed.project),
  };

  writeFileSync(join(SEEDS_DIR, "..", "documents", testRelFile), `${JSON.stringify(test, null, 2)}\n`);
  if (!raw.docs.some((d) => d.name === testName)) {
    raw.docs.push({ name: testName, type: "json", label: DocLabel.Training, file: testRelFile });
    writeFileSync(seedPath, `${JSON.stringify(raw, null, 2)}\n`);
  }
  wrote += 1;

  const issues = validateTestFile(test, seed.project, docRefs);
  const errors = issues.filter((i) => i.level === "error");
  console.log(
    `${testRelFile} — ${hasGolden ? "golden" : "placeholder"}; ${errors.length} error(s), ${issues.length - errors.length} warning(s)`,
  );
  for (const i of errors) console.log(`  ERROR ${i.where}: ${i.message.split("\n")[0]}`);
}
console.log(`done — ${wrote} test file(s)`);
