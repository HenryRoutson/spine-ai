// AI : compose *_testing.json from golden fixtures + reference grade rows.
import { readFileSync, writeFileSync } from "node:fs";
import { resolveSeedDocPath } from "../lib/server/seed";

type GradeRow = {
  student_label: string;
  section_id: string;
  score: number;
  max_score: number;
  correct: boolean;
  mistake_explanation: string | null;
};

type GradeRowInput = Omit<GradeRow, "correct" | "mistake_explanation"> & { mistake_explanation?: string | null };

function gradeRow(row: GradeRowInput): GradeRow {
  const correct = row.score === row.max_score;
  return {
    student_label: row.student_label,
    section_id: row.section_id,
    score: row.score,
    max_score: row.max_score,
    correct,
    mistake_explanation: row.mistake_explanation ?? null,
  };
}

function readFixtureGrades(fixtureDir: string): GradeRow[] {
  const rows = readJson<GradeRowInput[]>(`${fixtureDir}/grade_each_section.json`);
  return rows.map(gradeRow);
}

function readJson<T>(relativeFile: string): T {
  return JSON.parse(readFileSync(resolveSeedDocPath(relativeFile), "utf8")) as T;
}

function writeTest(relativeFile: string, body: Record<string, unknown>): void {
  const path = resolveSeedDocPath(relativeFile);
  writeFileSync(path, `${JSON.stringify(body, null, 2)}\n`);
  console.log(`wrote ${relativeFile}`);
}

function gradesForPassthrough(rows: GradeRow[]): GradeRow[] {
  return rows.map((row) => ({ ...row, mistake_explanation: null }));
}

function buildTest(opts: {
  description: string;
  inputs: Record<string, string | string[]>;
  fixtureDir: string;
}): Record<string, unknown> {
  const dir = opts.fixtureDir;
  const markingQuestions = readJson<unknown>(`${dir}/marking_questions_list.json`);
  const assembleWork = readJson<unknown>(`${dir}/assemble_grader_work.json`);
  const flattenSections = readJson<unknown>(`${dir}/flatten_sections.json`);
  const grades = readFixtureGrades(dir);
  const passthrough = gradesForPassthrough(grades);

  return {
    description: opts.description,
    inputs: opts.inputs,
    // AI : input/combine steps are pinned under inputs — not scored in expectedOutputs
    expectedOutputs: {
      "Marking Questions List": markingQuestions,
      "Assemble Grader Work": assembleWork,
      "Flatten Sections": flattenSections,
      "Grade Each Section": grades,
      "Final Output": passthrough,
      "Grade Count Check": passthrough,
    },
  };
}

const homeworkTests: {
  outputFile: string;
  description: string;
  inputs: Record<string, string | string[]>;
  fixtureDir: string;
}[] = [
  {
    outputFile: "homework_grader/homework_grader_testing.json",
    description:
      "Homework Grader — Algebra II classroom sample. score compared with ±1 tolerance; mistake_explanation is LLM-checked when present.",
    inputs: {
      "Marking Schema": "homework_marking_schema.json",
      "Student Submissions": [
        "homework_student_sam.md",
        "homework_student_jordan.md",
        "homework_student_alex.md",
      ],
    },
    fixtureDir: "homework_grader/expected",
  },
  {
    outputFile: "homework_grader/homework_first_grade_testing.json",
    description:
      "Homework Grader — 1st grade worksheet smoke test. score compared exactly (testTolerance 0); mistake_explanation is LLM-checked when present.",
    inputs: {
      "Marking Schema": "homework_marking_schema_first_grade.json",
      "Student Submissions": ["homework_student_riley_first_grade.md"],
    },
    fixtureDir: "homework_grader/expected_first_grade",
  },
  {
    outputFile: "homework_grader/homework_university_testing.json",
    description:
      "Homework Grader — university real analysis (LaTeX). score compared exactly (testTolerance 0); mistake_explanation is LLM-checked when present.",
    inputs: {
      "Marking Schema": "homework_marking_schema_university.json",
      "Student Submissions": ["homework_student_priya_university.md"],
    },
    fixtureDir: "homework_grader/expected_university",
  },
];

for (const test of homeworkTests) {
  writeTest(test.outputFile, buildTest(test));
}
