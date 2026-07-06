// AI : human + JSON formatters — agents rely on stable --json keys.

import type { CliCommandResult, CliIssue } from "@/lib/cli/types"

export function hasErrors(issues: CliIssue[]): boolean {
  return issues.some((i) => i.level === "error")
}

export function exitCodeForResult(result: CliCommandResult): 0 | 1 | 2 {
  if (result.command === "help" || result.ok) return 0
  return hasErrors(result.issues) ? 1 : 0
}

export function formatHuman(result: CliCommandResult): string {
  const lines: string[] = []
  if (result.data?.projectName) lines.push(`project: ${result.data.projectName}`)
  if (result.data?.testFile) lines.push(`test: ${result.data.testFile}`)
  if (result.data?.summary) lines.push(String(result.data.summary))
  lines.push("")

  if (!result.issues.length) {
    lines.push(result.ok ? "ok" : "failed")
    return lines.join("\n")
  }

  for (const issue of result.issues) {
    const tag = issue.level.toUpperCase()
    lines.push(`[${tag}] ${issue.where}: ${issue.message}`)
  }
  return lines.join("\n")
}

export function formatJson(result: CliCommandResult): string {
  return `${JSON.stringify(result, null, 2)}\n`
}

export function printResult(result: CliCommandResult, json: boolean): void {
  process.stdout.write(json ? formatJson(result) : formatHuman(result))
}
