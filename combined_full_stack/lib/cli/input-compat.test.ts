import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { evaluateCompatKey, evaluateInputCompat, inputCompatHasMismatch } from "@/lib/input-compat"
import type { InputDocsAssignment } from "@/lib/inference-input-core"
import type { DocRef, PipelineModule } from "@/lib/types"
import { InputType } from "@/lib/types"

const HW_DIR = join(process.cwd(), "documents/homework_grader")

describe("input-compat", () => {
  const schemaContent = readFileSync(join(HW_DIR, "homework_marking_schema.json"), "utf8")
  const jordanContent = readFileSync(join(HW_DIR, "homework_student_jordan.md"), "utf8")

  it("matches jordan homework against the bundled marking schema", () => {
    const title = evaluateCompatKey(schemaContent, jordanContent, {
      label: "assignment title",
      upstream: { kind: "json-path", path: "assignment_title", normalize: "lower-trim" },
      local: {
        kind: "text-regex",
        pattern: "^#\\s*(.+?)\\s+—\\s+Student",
        group: 1,
        normalize: "lower-trim",
      },
    })
    expect(title.status).toBe("match")

    const questions = evaluateCompatKey(schemaContent, jordanContent, {
      label: "question IDs",
      compare: "set-equal",
      upstream: {
        kind: "json-path",
        path: "sections[].questions[].question_id",
        normalize: "question-id-set",
      },
      local: { kind: "question-ids-text" },
    })
    expect(questions.status).toBe("match")
  })

  it("flags mismatched assignment titles", () => {
    const wrongStudent = jordanContent.replace("Homework 7", "Homework 99")
    const title = evaluateCompatKey(schemaContent, wrongStudent, {
      label: "assignment title",
      upstream: { kind: "json-path", path: "assignment_title", normalize: "lower-trim" },
      local: {
        kind: "text-regex",
        pattern: "^#\\s*(.+?)\\s+—\\s+Student",
        group: 1,
        normalize: "lower-trim",
      },
    })
    expect(title.status).toBe("mismatch")
  })

  it("evaluates full pairing from homework grader module config", () => {
    const studentModule = {
      id: "mod_in_students",
      kind: "input",
      label: "Student Submissions",
      inputCompatWith: {
        moduleId: "mod_in_schema",
        keys: [
          {
            label: "assignment title",
            upstream: { kind: "json-path", path: "assignment_title", normalize: "lower-trim" },
            local: {
              kind: "text-regex",
              pattern: "^#\\s*(.+?)\\s+—\\s+Student",
              group: 1,
              normalize: "lower-trim",
            },
          },
          {
            label: "question IDs",
            compare: "set-equal",
            upstream: {
              kind: "json-path",
              path: "sections[].questions[].question_id",
              normalize: "question-id-set",
            },
            local: { kind: "question-ids-text" },
          },
        ],
      },
    } as PipelineModule

    const schemaDoc = { id: "schema", name: "homework_marking_schema.json" } as DocRef
    const studentDoc = { id: "jordan", name: "homework_student_jordan.md", type: InputType.Text } as DocRef

    const schemaModule = {
      id: "mod_in_schema",
      kind: "input",
      label: "Marking Schema",
    } as PipelineModule

    const pairs = evaluateInputCompat(
      [schemaModule, studentModule],
      {
        mod_in_schema: schemaDoc,
        mod_in_students: [studentDoc],
      } as InputDocsAssignment,
      { schema: schemaContent, jordan: jordanContent },
    )
    expect(inputCompatHasMismatch(pairs)).toBe(false)
    expect(pairs[0]?.keys.every((k) => k.status === "match")).toBe(true)
  })
})
