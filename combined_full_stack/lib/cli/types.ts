// AI : shared CLI result shapes — human text and --json agents use the same payloads.

export type cli_issue_level = "error" | "warning"

export type CliIssue = {
  level: cli_issue_level
  where: string
  message: string
}

export type CliCommandResult = {
  ok: boolean
  command: string
  issues: CliIssue[]
  data?: Record<string, unknown>
}

export type CliExitCode = 0 | 1 | 2

export const CLI_EXIT_OK: CliExitCode = 0
export const CLI_EXIT_VALIDATION: CliExitCode = 1
export const CLI_EXIT_USAGE: CliExitCode = 2
