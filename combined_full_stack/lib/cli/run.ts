// AI : spine CLI dispatcher — subcommands return structured results; exit codes for agents.

import { resolve } from "node:path"
import { loadProjectContext } from "@/lib/cli/project_context"
import { validateProjectCommand } from "@/lib/cli/validate_project"
import {
  loadContextAndValidateTest,
  loadContextAndValidateTests,
  parseTestCommand,
} from "@/lib/cli/validate_test"
import { loadContextAndValidateSetup } from "@/lib/cli/validate_setup"
import { profileLandingCommand } from "@/lib/cli/profile_landing"
import type { CliCommandResult } from "@/lib/cli/types"

export const SPINE_CLI_HELP = `spine — validate Spine projects and test files without React

Usage:
  npx tsx scripts/spine-cli.ts validate project <seed.json> [--json]
  npx tsx scripts/spine-cli.ts validate test --project <seed.json> --file <test.json> [--json]
  npx tsx scripts/spine-cli.ts validate tests --project <seed.json> [--json]
  npx tsx scripts/spine-cli.ts validate setup --project <seed.json> --file <setup.json> [--json]
  npx tsx scripts/spine-cli.ts parse test --file <test.json> [--json]
  npx tsx scripts/spine-cli.ts profile landing [--days 30] [--limit 50] [--backfill-local] [--json]

Flags:
  --json    machine-readable output (for agents)
  --help    show this help
  --days    landing profile window (default 30)
  --limit   max recent calls in landing profile (default 50)
  --backfill-local  sync data/landing_page_demo.json into Supabase before profiling

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

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key]
  return typeof v === "string" ? v : undefined
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

  if (cmd === "validate") {
    if (sub === "project") {
      const seedPath = rest[0] ?? flagString(flags, "project")
      if (!seedPath) return usageError("validate project requires <seed.json>")
      return validateProjectCommand(loadProjectContext(resolve(seedPath)))
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

  return usageError(`unknown command: ${positional.join(" ")}`)
}
