// AI : *_testing.json parse + validate — same rules as the Testing tab sidebar badges.

import { resolve } from "node:path"
import {
  analyzeTestPipelineAlignment,
  parseTestFile,
  validateTestFile,
  type TestFileIssue,
} from "@/lib/testing-files"
import {
  loadTestInputContents,
  verifyExpectFailurePrecondition,
} from "@/lib/test-expect-failure"
import { loadProjectContext, readTextFile, type ProjectContext } from "@/lib/cli/project_context"
import type { CliCommandResult, CliIssue } from "@/lib/cli/types"

function toCliIssues(issues: TestFileIssue[]): CliIssue[] {
  return issues.map((i) => ({ level: i.level, where: i.where, message: i.message }))
}

export function parseTestCommand(testPath: string): CliCommandResult {
  const abs = resolve(testPath)
  const content = readTextFile(abs)
  const parsed = parseTestFile(content)
  if (!parsed.ok) {
    return {
      ok: false,
      command: "parse test",
      issues: [{ level: "error", where: abs, message: parsed.error }],
      data: { testFile: abs },
    }
  }
  return {
    ok: true,
    command: "parse test",
    issues: [],
    data: {
      testFile: abs,
      test: parsed.test,
    },
  }
}

export function validateTestContent(
  ctx: ProjectContext,
  content: string,
  testLabel: string,
): CliCommandResult {
  const parsed = parseTestFile(content)
  if (!parsed.ok) {
    return {
      ok: false,
      command: "validate test",
      issues: [{ level: "error", where: testLabel, message: parsed.error }],
      data: { projectName: ctx.project.name, testFile: testLabel },
    }
  }
  const issues = toCliIssues(validateTestFile(parsed.test, ctx.project, ctx.docRefs))
  const contentByDocId = loadTestInputContents(parsed.test, ctx.project.modules, ctx.docRefs, (name) => {
    const spec = ctx.seed.docSpecs.find((d) => d.name === name)
    return spec ? readTextFile(spec.path) : undefined
  })
  const expectCheck = verifyExpectFailurePrecondition(
    parsed.test,
    ctx.project,
    ctx.docRefs,
    contentByDocId,
  )
  if (expectCheck && !expectCheck.ok) {
    issues.push({ level: "error", where: "expectFailure", message: expectCheck.message })
  } else if (expectCheck) {
    issues.push({ level: "warning", where: "expectFailure", message: expectCheck.message })
  }
  const alignment = analyzeTestPipelineAlignment(parsed.test, ctx.project)
  return {
    ok: !issues.some((i) => i.level === "error"),
    command: "validate test",
    issues,
    data: {
      projectName: ctx.project.name,
      testFile: testLabel,
      alignment: {
        orphanedExpected: alignment.orphanedExpected,
        orphanedInputs: alignment.orphanedInputs,
        untrackedSteps: alignment.stepRows
          .filter((r) => r.trackStatus === "untracked")
          .map((r) => r.module.label),
      },
    },
  }
}

export function validateTestCommand(ctx: ProjectContext, testPath: string): CliCommandResult {
  const abs = resolve(testPath)
  return validateTestContent(ctx, readTextFile(abs), abs)
}

export function validateTestsCommand(ctx: ProjectContext): CliCommandResult {
  const docs = ctx.seed.docSpecs.filter((d) => d.name.endsWith("_testing.json"))
  const allIssues: CliIssue[] = []
  const perFile: Record<string, { ok: boolean; errors: number; warnings: number }> = {}

  for (const doc of docs) {
    const content = readTextFile(doc.path)
    const result = validateTestContent(ctx, content, doc.path)
    const errors = result.issues.filter((i) => i.level === "error").length
    const warnings = result.issues.filter((i) => i.level === "warning").length
    perFile[doc.name] = { ok: result.ok, errors, warnings }
    for (const issue of result.issues) {
      allIssues.push({ ...issue, where: `${doc.name} → ${issue.where}` })
    }
  }

  return {
    ok: !allIssues.some((i) => i.level === "error"),
    command: "validate tests",
    issues: allIssues,
    data: {
      projectName: ctx.project.name,
      seedPath: ctx.seedPath,
      testCount: docs.length,
      perFile,
      summary: `${docs.length} test file(s)`,
    },
  }
}

export function loadContextAndValidateTest(seedPath: string, testPath: string): CliCommandResult {
  return validateTestCommand(loadProjectContext(seedPath), testPath)
}

export function loadContextAndValidateTests(seedPath: string): CliCommandResult {
  return validateTestsCommand(loadProjectContext(seedPath))
}
