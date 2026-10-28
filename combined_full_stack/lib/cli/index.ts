// AI : public CLI surface — UI and agents import the same validators the spine script runs.

export type { CliCommandResult, CliIssue } from "@/lib/cli/types"
export { loadProjectContext, type ProjectContext } from "@/lib/cli/project_context"
export { validateProjectCommand } from "@/lib/cli/validate_project"
export { lintPipelineCommand } from "@/lib/cli/lint_pipeline"
export {
  parseTestCommand,
  validateTestCommand,
  validateTestContent,
  validateTestsCommand,
} from "@/lib/cli/validate_test"
export { validateSetupCommand } from "@/lib/cli/validate_setup"
export { runSpineCli, SPINE_CLI_HELP } from "@/lib/cli/run"
export { runSessionCommand } from "@/lib/cli/session_cli"
export { runAgentCommand } from "@/lib/cli/agent_cli"
export { runDemoCommand } from "@/lib/cli/demo"
export { runTuiCommand, renderSpineTuiString } from "@/lib/cli/ink/launch"
export { openCliSession } from "@/lib/cli/session_open"
export { profileLandingCommand, formatLandingProfileHuman } from "@/lib/cli/profile_landing"
export { formatHuman, formatJson, printResult, exitCodeForResult } from "@/lib/cli/format"
