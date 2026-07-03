// AI : generate golden expected/*.json fixtures for seed pipelines — run after changing deterministic steps.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileCustomFn } from "../lib/custom_code";
import { loadProjectSeed, resolveSeedDocPath, SEEDS_DIR } from "../lib/server/seed";
import { materializeInputDocument } from "../lib/server/structure";
import { readFileSync } from "node:fs";

type StepState = Record<string, unknown>;

function readText(path: string): string {
  return readFileSync(path, "utf8");
}

function runTs(code: string, input: unknown, state: StepState): unknown {
  const fn = compileCustomFn(code);
  return fn.length >= 2 ? fn(input, state) : fn(input);
}

function writeFixture(relativeFile: string, value: unknown): void {
  const path = resolveSeedDocPath(relativeFile);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  console.log(`wrote ${relativeFile}`);
}

// AI : one fixture set per pre-selected run — the default sample plus each seed inferencePreset.
function generateHomeworkFixtures(schemaFile: string, studentFiles: string[], outDir: string): void {
  const seed = loadProjectSeed(join(SEEDS_DIR, "homework_grader.json"));
  // AI : materialize like the run engine (not plain JSON.parse) — field order is rebuilt per the
  // AI : StructureModel, and downstream fixtures embed JSON.stringify(schema) as a string.
  const schemaMod = seed.project.modules.find((m) => m.id === "mod_in_schema")!;
  const schemaName = schemaFile.split("/").pop()!;
  const schema = materializeInputDocument(
    readText(resolveSeedDocPath(schemaFile)),
    `seed_${schemaName}`,
    schemaMod,
    seed.project.models,
    { docName: schemaName, label: schemaMod.label, note: schemaMod.note },
  );
  const students = studentFiles.map((f) => {
    const name = f.split("/").pop()!;
    const content = readText(resolveSeedDocPath(f));
    return { filename: name, content, doc_id: `seed_${name}` };
  });

  const state: StepState = { "Marking Schema": schema };
  writeFixture(`${outDir}/marking_schema.json`, schema);

  const flattenMod = seed.project.modules.find((m) => m.id === "mod_questions")!;
  const flattenCode = flattenMod.fallbackList?.[0]?.typescript ?? "";
  const questions = runTs(flattenCode, schema, state);
  state["Marking Questions List"] = questions;
  writeFixture(`${outDir}/marking_questions_list.json`, questions);

  state["Student Submissions"] = students;
  writeFixture(`${outDir}/student_submissions.json`, students);

  const combineValue = {
    student_submission: students[0],
    marking_questions: questions,
  };
  state["Combine Inputs"] = combineValue;
  writeFixture(`${outDir}/combine_inputs.json`, combineValue);

  const assembleMod = seed.project.modules.find((m) => m.id === "mod_assemble")!;
  const assembleCode = assembleMod.fallbackList?.[0]?.typescript ?? "";
  const work = runTs(assembleCode, combineValue, state);
  state["Assemble Grader Work"] = work;
  writeFixture(`${outDir}/assemble_grader_work.json`, work);

  const flatMod = seed.project.modules.find((m) => m.id === "mod_flatten")!;
  const flatCode = flatMod.fallbackList?.[0]?.typescript ?? "";
  const gradable = runTs(flatCode, work, state);
  state["Flatten Sections"] = gradable;
  writeFixture(`${outDir}/flatten_sections.json`, gradable);
}

function generateHomeworkGrader(): void {
  generateHomeworkFixtures(
    "homework_grader/homework_marking_schema.json",
    [
      "homework_grader/homework_student_sam.md",
      "homework_grader/homework_student_jordan.md",
      "homework_grader/homework_student_alex.md",
    ],
    "homework_grader/expected",
  );
  generateHomeworkFixtures(
    "homework_grader/homework_marking_schema_first_grade.json",
    ["homework_grader/homework_student_riley_first_grade.md"],
    "homework_grader/expected_first_grade",
  );
  generateHomeworkFixtures(
    "homework_grader/homework_marking_schema_university.json",
    ["homework_grader/homework_student_priya_university.md"],
    "homework_grader/expected_university",
  );
}

function generateBatchLlm(): void {
  const seed = loadProjectSeed(join(SEEDS_DIR, "batch_llm_example.json"));
  const bullets = readText(resolveSeedDocPath("batch_llm_example/sample_bullets.txt"));
  const doc = { content: bullets, filename: "sample_bullets.txt", doc_id: "seed_sample_bullets" };
  const state: StepState = { "Bullet List": doc };

  const wrapInMod = seed.project.modules.find((m) => m.id === "mod_wrap_in")!;
  const wrapInCode = wrapInMod.fallbackList?.[0]?.typescript ?? "";
  const chunks = runTs(wrapInCode, doc, state);
  state["Wrap → List"] = chunks;
  writeFixture("batch_llm_example/expected/wrap_list.json", chunks);

  const mockSummaries = (chunks as { id: string; text: string }[]).map((c) => ({
    id: c.id,
    summary: `Summary of: ${c.text}`,
  }));
  state["Summarize Each Line"] = mockSummaries;

  const wrapOutMod = seed.project.modules.find((m) => m.id === "mod_wrap_out")!;
  const wrapOutCode = wrapOutMod.fallbackList?.[0]?.typescript ?? "";
  const report = runTs(wrapOutCode, mockSummaries, state);
  state["Unwrap List → Report"] = report;
  writeFixture("batch_llm_example/expected/summary_report.json", report);
}

for (const fn of [generateHomeworkGrader, generateBatchLlm]) {
  try {
    fn();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
}
