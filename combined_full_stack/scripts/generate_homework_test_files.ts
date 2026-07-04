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
  const markingQuestions = readJson<unknown>(`${dir}/marking_questions_list.json`);
  const assembleWork = readJson<unknown>(`${dir}/assemble_grader_work.json`);
  const flattenSections = readJson<unknown>(`${dir}/flatten_sections.json`);

  return {
    description: opts.description,
    inputs: opts.inputs,
    // AI : input/combine steps are pinned under inputs — not scored in expectedOutputs
    expectedOutputs: {
      "Marking Questions List": markingQuestions,
      "Assemble Grader Work": assembleWork,
      "Flatten Sections": flattenSections,
      "Grade Each Section": opts.grades,
      "Final Output": opts.grades,
      "Grade Count Check": opts.grades,
    },
  };
}

function readGradeRows(relativeFile: string): GradeRow[] | undefined {
  const rows = readJson<{ expectedOutputs: { "Final Output"?: (GradeRow | LegacyGradeRow)[] | null } }>(
    relativeFile,
  ).expectedOutputs["Final Output"];
  if (!Array.isArray(rows)) return undefined;
  return rows.map((row) => ("feedback" in row ? fromLegacyFeedback(row) : row));
}

// AI : canonical algebra II grade rows — also read from an existing test file when present.
const algebraGrades: GradeRow[] = readGradeRows("homework_grader/homework_grader_testing.json") ?? [
  gradeRow({ student_label: "Sam Rivera", section_id: "A", score: 5, max_score: 5 }),
  gradeRow({ student_label: "Sam Rivera", section_id: "A", score: 5, max_score: 5 }),
  gradeRow({ student_label: "Sam Rivera", section_id: "B", score: 5, max_score: 5 }),
  gradeRow({
    student_label: "Sam Rivera",
    section_id: "B",
    score: 5,
    max_score: 10,
    mistake_explanation: "Only x = 3 given — missing the negative root x = −3.",
  }),
  gradeRow({
    student_label: "Sam Rivera",
    section_id: "C",
    score: 0,
    max_score: 15,
    mistake_explanation: "Incorrect meeting time with no working or diagram shown.",
  }),
  gradeRow({ student_label: "Jordan Lee", section_id: "A", score: 5, max_score: 5 }),
  gradeRow({
    student_label: "Jordan Lee",
    section_id: "A",
    score: 2,
    max_score: 5,
    mistake_explanation: "Good method but final answer y = 8 is incorrect (should be 9).",
  }),
  gradeRow({ student_label: "Jordan Lee", section_id: "B", score: 5, max_score: 5 }),
  gradeRow({ student_label: "Jordan Lee", section_id: "B", score: 10, max_score: 10 }),
  gradeRow({ student_label: "Jordan Lee", section_id: "C", score: 15, max_score: 15 }),
  gradeRow({
    student_label: "Alex Kim",
    section_id: "A",
    score: 3,
    max_score: 5,
    mistake_explanation: "Correct answer x = 5 but no intermediate steps shown.",
  }),
  gradeRow({
    student_label: "Alex Kim",
    section_id: "A",
    score: 3,
    max_score: 5,
    mistake_explanation: "Correct answer y = 9 but no working shown.",
  }),
  gradeRow({ student_label: "Alex Kim", section_id: "B", score: 5, max_score: 5 }),
  gradeRow({ student_label: "Alex Kim", section_id: "B", score: 10, max_score: 10 }),
  gradeRow({
    student_label: "Alex Kim",
    section_id: "C",
    score: 8,
    max_score: 15,
    mistake_explanation: "Good diagram and equation setup but meeting time (~3:24pm) is incorrect.",
  }),
];

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
