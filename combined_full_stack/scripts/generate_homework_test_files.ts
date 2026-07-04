// AI : compose *_testing.json from golden fixtures + reference grade rows.
import { readFileSync, writeFileSync } from "node:fs";
import { resolveSeedDocPath } from "../lib/server/seed";

type GradeRow = {
  student_label: string;
  section_id: string;
  score: number;
  max_score: number;
  feedback: string;
};

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

const algebraGrades: GradeRow[] = readJson("homework_grader/homework_grader_testing.json").expectedOutputs[
  "Final Output"
];

writeTest(
  "homework_grader/homework_grader_testing.json",
  buildTest({
    description:
      "Homework Grader — Algebra II classroom sample. Full step-by-step expected JSON; feedback fields are LLM-checked.",
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
  {
    student_label: "Riley Park",
    section_id: "A",
    score: 2,
    max_score: 2,
    feedback: "Correct addition with working shown; total is 5.",
  },
  {
    student_label: "Riley Park",
    section_id: "A",
    score: 2,
    max_score: 2,
    feedback: "Correct answer 7 with counting shown.",
  },
  {
    student_label: "Riley Park",
    section_id: "A",
    score: 1,
    max_score: 2,
    feedback: "Good counting-back attempt but final answer 5 is incorrect (should be 4).",
  },
  {
    student_label: "Riley Park",
    section_id: "B",
    score: 2,
    max_score: 2,
    feedback: "Correct — a triangle has 3 sides.",
  },
  {
    student_label: "Riley Park",
    section_id: "B",
    score: 2,
    max_score: 2,
    feedback: "Correct — 8 is bigger than 5.",
  },
];

writeTest(
  "homework_grader/homework_first_grade_testing.json",
  buildTest({
    description:
      "Homework Grader — 1st grade worksheet smoke test. Deterministic scores exact; feedback is LLM-checked.",
    inputs: {
      "Marking Schema": "homework_marking_schema_first_grade.json",
      "Student Submissions": ["homework_student_riley_first_grade.md"],
    },
    fixtureDir: "homework_grader/expected_first_grade",
    grades: firstGradeGrades,
  }),
);

const universityGrades: GradeRow[] = [
  {
    student_label: "Priya Nair",
    section_id: "A",
    score: 10,
    max_score: 10,
    feedback: "Clear u-substitution, correct bounds, and final value e − 1.",
  },
  {
    student_label: "Priya Nair",
    section_id: "A",
    score: 10,
    max_score: 10,
    feedback: "Correct exponential rewrite and limit e².",
  },
  {
    student_label: "Priya Nair",
    section_id: "B",
    score: 10,
    max_score: 10,
    feedback: "Ratio test set up correctly with limit 1/e < 1.",
  },
  {
    student_label: "Priya Nair",
    section_id: "B",
    score: 2,
    max_score: 10,
    feedback:
      "Invalid comparison with ∑1/n² — comparison test hypotheses not satisfied; at most 2 pts per rubric.",
  },
];

writeTest(
  "homework_grader/homework_university_testing.json",
  buildTest({
    description:
      "Homework Grader — university real analysis (LaTeX). Full pipeline test including LLM grading feedback.",
    inputs: {
      "Marking Schema": "homework_marking_schema_university.json",
      "Student Submissions": ["homework_student_priya_university.md"],
    },
    fixtureDir: "homework_grader/expected_university",
    grades: universityGrades,
  }),
);
