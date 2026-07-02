// AI : generate golden expected/*.json fixtures for seed pipelines — run after changing deterministic steps.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { compileCustomFn } from "../lib/custom_code";
import { loadProjectSeed, resolveSeedDocPath, SEEDS_DIR } from "../lib/server/seed";
import { readFileSync } from "node:fs";

type StepState = Record<string, unknown>;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

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

function generateHomeworkGrader(): void {
  const seed = loadProjectSeed(join(SEEDS_DIR, "homework_grader.json"));
  const schema = readJson(resolveSeedDocPath("homework_grader/homework_marking_schema.json"));
  const studentFiles = [
    "homework_grader/homework_student_sam.md",
    "homework_grader/homework_student_jordan.md",
    "homework_grader/homework_student_alex.md",
  ];
  const students = studentFiles.map((f) => {
    const name = f.split("/").pop()!;
    const content = readText(resolveSeedDocPath(f));
    return { filename: name, content, doc_id: `seed_${name}` };
  });

  const state: StepState = { "Marking Schema": schema };
  writeFixture("homework_grader/expected/marking_schema.json", schema);

  const flattenMod = seed.project.modules.find((m) => m.id === "mod_questions")!;
  const flattenCode = flattenMod.fallbackList?.[0]?.typescript ?? "";
  const questions = runTs(flattenCode, schema, state);
  state["Marking Questions List"] = questions;
  writeFixture("homework_grader/expected/marking_questions_list.json", questions);

  state["Student Submissions"] = students;
  writeFixture("homework_grader/expected/student_submissions.json", students);

  const combineValue = {
    student_submission: students[0],
    marking_questions: questions,
  };
  state["Combine Inputs"] = combineValue;
  writeFixture("homework_grader/expected/combine_inputs.json", combineValue);

  const assembleMod = seed.project.modules.find((m) => m.id === "mod_assemble")!;
  const assembleCode = assembleMod.fallbackList?.[0]?.typescript ?? "";
  const work = runTs(assembleCode, combineValue, state);
  state["Assemble Grader Work"] = work;
  writeFixture("homework_grader/expected/assemble_grader_work.json", work);

  const flatMod = seed.project.modules.find((m) => m.id === "mod_flatten")!;
  const flatCode = flatMod.fallbackList?.[0]?.typescript ?? "";
  const gradable = runTs(flatCode, work, state);
  state["Flatten Sections"] = gradable;
  writeFixture("homework_grader/expected/flatten_sections.json", gradable);
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
