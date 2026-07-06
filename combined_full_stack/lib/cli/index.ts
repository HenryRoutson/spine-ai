// AI : public CLI surface — UI and agents import the same validators the spine script runs.

export type { CliCommandResult, CliIssue } from "@/lib/cli/types"
export { loadProjectContext, type ProjectContext } from "@/lib/cli/project_context"
export { validateProjectCommand } from "@/lib/cli/validate_project"
export {
  parseTestCommand,
  validateTestCommand,
  validateTestContent,
  validateTestsCommand,
} from "@/lib/cli/validate_test"
export { validateSetupCommand } from "@/lib/cli/validate_setup"
export { runSpineCli, SPINE_CLI_HELP } from "@/lib/cli/run"
export { formatHuman, formatJson, printResult, exitCodeForResult } from "@/lib/cli/format"
