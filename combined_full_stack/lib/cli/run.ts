// AI : spine CLI dispatcher — subcommands return structured results; exit codes for agents.
// AI : DONE (arch-cli-result) — flagString / cliOk / cliUsage live in cli/types.ts.

import { resolve } from "node:path"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateProjectCommand } from "@/lib/cli/validate_project"
import { lintPipelineCommand } from "@/lib/cli/lint_pipeline"
import {
  loadContextAndValidateTest,
  loadContextAndValidateTests,
  parseTestCommand,
} from "@/lib/cli/validate_test"
import { loadContextAndValidateSetup } from "@/lib/cli/validate_setup"
import { profileLandingCommand } from "@/lib/cli/profile_landing"
import { runSessionCommand } from "@/lib/cli/session_cli"
import { runAgentCommand } from "@/lib/cli/agent_cli"
import { runDemoCommand } from "@/lib/cli/demo"
import { flagString, type CliCommandResult } from "@/lib/cli/types"

export const SPINE_CLI_HELP = `spine — validate Spine projects and run the headless workspace / agent

Usage:
  npx tsx scripts/spine-cli.ts validate project <seed.json> [--json]
  npx tsx scripts/spine-cli.ts lint pipeline <seed.json> [--json]
  npx tsx scripts/spine-cli.ts validate test --project <seed.json> --file <test.json> [--json]
  npx tsx scripts/spine-cli.ts validate tests --project <seed.json> [--json]
  npx tsx scripts/spine-cli.ts validate setup --project <seed.json> --file <setup.json> [--json]
  npx tsx scripts/spine-cli.ts parse test --file <test.json> [--json]
  npx tsx scripts/spine-cli.ts profile landing [--days 30] [--limit 50] [--backfill-local] [--json]
  npx tsx scripts/spine-cli.ts session <list|add-project|open|rename|clone|delete|import-seed|seeds|set-docs|add-model|add-field|add-step|assign-structure|add-doc|docs|pipeline|structure|pydantic|mermaid|tests|logs|assign-input|start-run|run-test|pull|push|billing|cache|share|link-quotes|validate|snapshot|actions> [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts agent <ask|structure|testing|diagnose|apply|reject|history|apply-file> [--message "..."] [--apply] [--run] [--session <path>] [--json]
  npx tsx scripts/spine-cli.ts tui [--session <path>] [--once] [--tab structure|pipeline|testing|vibe|...] [--offline] [--json]
  npx tsx scripts/spine-cli.ts demo [--json]

Flags:
  --json    machine-readable output (for agents)
  --help    show this help
  --days    landing profile window (default 30)
  --limit   max recent calls in landing profile (default 50)
  --backfill-local  sync data/landing_page_demo.json into Supabase before profiling
  --session path to .spine-session.json (or SPINE_SESSION_PATH)
  --offline  local-only; egress throws (session/demo/tui). agent ask is blocked.
  --once    Ink TUI: print one frame and exit (CI / non-TTY default)
  --tab     Ink TUI starting tab (aliases: build=pipeline, agent=vibe, tests=testing, logs=logging)
            Keys 1–0 match the web UI; b billing, i run, t test, f errors-only, e inspect
  --message agent ask prompt
  --apply   agent ask: apply the proposal immediately
  --run     after apply, execute proposedActions via HTTP
  --file    seed JSON, proposal JSON, or test file
  --assistant vibe|structure|testing|diagnosis

Exit codes:
  0  success / no validation errors
  1  validation errors
  2  usage / parse failure
`

type ParsedArgs = {
  json: boolean
  help: boolean
  positional: string[]
  flags: Record<string, string | boolean>
}

function parseArgs(argv: string[]): ParsedArgs {
  const json = argv.includes("--json")
  const help = argv.includes("--help") || argv.includes("-h")
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--json" || arg === "--help" || arg === "-h") continue
    if (arg.startsWith("--")) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith("-")) {
        flags[key] = next
        i++
      } else {
        flags[key] = true
      }
      continue
    }
    positional.push(arg)
  }
  return { json, help, positional, flags }
}

function usageError(message: string): CliCommandResult {
  return {
    ok: false,
    command: "usage",
    issues: [{ level: "error", where: "argv", message }],
    data: { help: SPINE_CLI_HELP },
  }
}

function flagNumber(flags: Record<string, string | boolean>, key: string, fallback: number): number {
  const raw = flagString(flags, key)
  if (raw == null) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export async function runSpineCli(argv: string[]): Promise<CliCommandResult> {
  const { json: _json, help, positional, flags } = parseArgs(argv)
  if (help || !positional.length) {
    return { ok: true, command: "help", issues: [], data: { help: SPINE_CLI_HELP } }
  }

  const [cmd, sub, ...rest] = positional

  if (cmd === "help") {
    return { ok: true, command: "help", issues: [], data: { help: SPINE_CLI_HELP } }
  }

  if (cmd === "parse" && sub === "test") {
    const file = flagString(flags, "file") ?? rest[0]
    if (!file) return usageError('parse test requires --file <test.json>')
    return parseTestCommand(file)
  }

  if (cmd === "lint") {
    if (sub === "pipeline") {
      const seedPath = rest[0] ?? flagString(flags, "project")
      if (!seedPath) return usageError("lint pipeline requires <seed.json>")
      return lintPipelineCommand(loadProjectContext(resolve(seedPath)))
    }
    return usageError("lint requires: pipeline")
  }

  if (cmd === "validate") {
    if (sub === "project") {
      const seedPath = rest[0] ?? flagString(flags, "project")
      if (!seedPath) return usageError("validate project requires <seed.json>")
      return validateProjectCommand(loadProjectContext(resolve(seedPath)))
    }

    if (sub === "pipeline") {
      return usageError("did you mean: lint pipeline <seed.json>")
    }

    if (sub === "test") {
      const seedPath = flagString(flags, "project") ?? rest[0]
      const testPath = flagString(flags, "file") ?? rest[1]
      if (!seedPath || !testPath) {
        return usageError("validate test requires --project <seed.json> --file <test.json>")
      }
      return loadContextAndValidateTest(resolve(seedPath), resolve(testPath))
    }

    if (sub === "tests") {
      const seedPath = flagString(flags, "project") ?? rest[0]
      if (!seedPath) return usageError("validate tests requires --project <seed.json>")
      return loadContextAndValidateTests(resolve(seedPath))
    }

    if (sub === "setup") {
      const seedPath = flagString(flags, "project") ?? rest[0]
      const setupPath = flagString(flags, "file") ?? rest[1]
      if (!seedPath || !setupPath) {
        return usageError("validate setup requires --project <seed.json> --file <setup.json>")
      }
      return loadContextAndValidateSetup(resolve(seedPath), resolve(setupPath))
    }
  }

  if (cmd === "profile" && sub === "landing") {
    return profileLandingCommand({
      days: flagNumber(flags, "days", 30),
      limit: flagNumber(flags, "limit", 50),
      backfillLocal: flags["backfill-local"] === true,
    })
  }

  if (cmd === "session") {
    return runSessionCommand(positional, flags)
  }

  if (cmd === "agent") {
    return runAgentCommand(positional, flags)
  }

  if (cmd === "demo") {
    return runDemoCommand({
      keepSession: flags["keep-session"] === true,
      sessionPath: flagString(flags, "session"),
    })
  }

  if (cmd === "tui" || cmd === "ui") {
    const tuiFlags = { ...flags, ...(_json ? { json: true } : {}) }
    if (process.env.VITEST) {
      const { runTuiCommand } = await import("@/lib/cli/ink/launch")
      return runTuiCommand(tuiFlags)
    }
    const { spawnSpineTui } = await import("@/lib/cli/ink/spawn")
    return spawnSpineTui(process.argv.slice(2))
  }

  return usageError(`unknown command: ${positional.join(" ")}`)
}
