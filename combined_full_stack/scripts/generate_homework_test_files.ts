// AI : compose *_testing.json from golden fixtures + reference grade rows.
import { readFileSync, writeFileSync } from "node:fs";
import { resolveSeedDocPath } from "../lib/server/seed";

type GradeRow = {
  student_label: string;
  section_id: string;
  score: number;
  max_score: number;
  correct: boolean;
  mistake_explanation: string;
};

type LegacyGradeRow = Omit<GradeRow, "correct" | "mistake_explanation"> & { feedback: string };

function gradeRow(
  row: Omit<GradeRow, "correct" | "mistake_explanation"> & { mistake_explanation?: string },
): GradeRow {
  const correct = row.score === row.max_score;
  return {
    student_label: row.student_label,
    section_id: row.section_id,
    score: row.score,
    max_score: row.max_score,
    correct,
    mistake_explanation: row.mistake_explanation ?? (correct ? "" : ""),
  };
}

function fromLegacyFeedback(row: LegacyGradeRow): GradeRow {
  const correct = row.score === row.max_score;
  return {
    student_label: row.student_label,
    section_id: row.section_id,
    score: row.score,
    max_score: row.max_score,
    correct,
    mistake_explanation: correct ? "" : row.feedback,
  };
}

function readJson<T>(relativeFile: string): T {
  return JSON.parse(readFileSync(resolveSeedDocPath(relativeFile), "utf8")) as T;
}

function stripDocIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDocIds);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "doc_id") continue;
      out[k] = stripDocIds(v);
    }
    return out;
  }
  return value;
}

function writeTest(relativeFile: string, body: Record<string, unknown>): void {
  const path = resolveSeedDocPath(relativeFile);
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`wrote ${relativeFile}`);
}

function buildTest(opts: {
  description: string;
  inputs: Record<string, string | string[]>;
  fixtureDir: string;
  grades: GradeRow[];
}): Record<string, unknown> {
  const dir = opts.fixtureDir;
  const markingSchema = readJson<unknown>(`${dir}/marking_schema.json`);
  const markingQuestions = readJson<unknown>(`${dir}/marking_questions_list.json`);
  const studentSubmissions = stripDocIds(readJson<unknown>(`${dir}/student_submissions.json`));
  const combineInputs = stripDocIds(readJson<unknown>(`${dir}/combine_inputs.json`));
  const assembleWork = readJson<unknown>(`${dir}/assemble_grader_work.json`);
  const flattenSections = readJson<unknown>(`${dir}/flatten_sections.json`);

  return {
    description: opts.description,
    inputs: opts.inputs,
    expectedOutputs: {
      "Marking Schema": markingSchema,
      "Marking Questions List": markingQuestions,
      "Student Submissions": studentSubmissions,
      "Combine Inputs": combineInputs,
      "Assemble Grader Work": assembleWork,
      "Flatten Sections": flattenSections,
      "Grade Each Section": opts.grades,
      "Final Output": opts.grades,
      "Grade Count Check": opts.grades,
    },
  };
}

function readGradeRows(relativeFile: string): GradeRow[] {
  const rows = readJson<{ expectedOutputs: { "Final Output": (GradeRow | LegacyGradeRow)[] } }>(
    relativeFile,
  ).expectedOutputs["Final Output"];
  return rows.map((row) => ("feedback" in row ? fromLegacyFeedback(row) : row));
}

const algebraGrades: GradeRow[] = readGradeRows("homework_grader/homework_grader_testing.json");

writeTest(
  "homework_grader/homework_grader_testing.json",
  buildTest({
    description:
      "Homework Grader — Algebra II classroom sample. Full step-by-step expected JSON; mistake_explanation is LLM-checked.",
    inputs: {
      "Marking Schema": "homework_marking_schema.json",
      "Student Submissions": [
        "homework_student_sam.md",
        "homework_student_jordan.md",
        "homework_student_alex.md",
      ],
    },
    fixtureDir: "homework_grader/expected",
    grades: algebraGrades,
  }),
);

const firstGradeGrades: GradeRow[] = [
  gradeRow({
    student_label: "Riley Park",
    section_id: "A",
    score: 2,
    max_score: 2,
  }),
  gradeRow({
    student_label: "Riley Park",
    section_id: "A",
    score: 2,
    max_score: 2,
  }),
  gradeRow({
    student_label: "Riley Park",
    section_id: "A",
    score: 1,
    max_score: 2,
    mistake_explanation: "Good counting-back attempt but final answer 5 is incorrect (should be 4).",
  }),
  gradeRow({
    student_label: "Riley Park",
    section_id: "B",
    score: 2,
    max_score: 2,
  }),
  gradeRow({
    student_label: "Riley Park",
    section_id: "B",
    score: 2,
    max_score: 2,
  }),
];

writeTest(
  "homework_grader/homework_first_grade_testing.json",
  buildTest({
    description:
      "Homework Grader — 1st grade worksheet smoke test. Scores and correct are exact; mistake_explanation is LLM-checked.",
    inputs: {
      "Marking Schema": "homework_marking_schema_first_grade.json",
      "Student Submissions": ["homework_student_riley_first_grade.md"],
    },
    fixtureDir: "homework_grader/expected_first_grade",
    grades: firstGradeGrades,
  }),
);

const universityGrades: GradeRow[] = [
  gradeRow({
    student_label: "Priya Nair",
    section_id: "A",
    score: 10,
    max_score: 10,
  }),
  gradeRow({
    student_label: "Priya Nair",
    section_id: "A",
    score: 10,
    max_score: 10,
  }),
  gradeRow({
    student_label: "Priya Nair",
    section_id: "B",
    score: 10,
    max_score: 10,
  }),
  gradeRow({
    student_label: "Priya Nair",
    section_id: "B",
    score: 2,
    max_score: 10,
    mistake_explanation:
      "Invalid comparison with ∑1/n² — comparison test hypotheses not satisfied; at most 2 pts per rubric.",
  }),
];

writeTest(
  "homework_grader/homework_university_testing.json",
  buildTest({
    description:
      "Homework Grader — university real analysis (LaTeX). Full pipeline test; mistake_explanation is LLM-checked.",
    inputs: {
      "Marking Schema": "homework_marking_schema_university.json",
      "Student Submissions": ["homework_student_priya_university.md"],
    },
    fixtureDir: "homework_grader/expected_university",
    grades: universityGrades,
  }),
);
