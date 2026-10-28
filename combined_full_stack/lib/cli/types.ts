// AI : shared CLI result shapes — human text and --json agents use the same payloads.
// AI : DONE (arch-cli-result) — flagString / cliOk / cliUsage live here; session/agent wrap usage with their help.

export function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key]
  return typeof v === "string" ? v : undefined
}

export function cliOk(command: string, data: Record<string, unknown>): CliCommandResult {
  return { ok: true, command, issues: [], data }
}

export function cliUsage(message: string, help: string): CliCommandResult {
  return {
    ok: false,
    command: "usage",
    issues: [{ level: "error", where: "argv", message }],
    data: { help },
  }
}

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
