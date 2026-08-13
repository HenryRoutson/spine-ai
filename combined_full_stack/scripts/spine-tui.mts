#!/usr/bin/env npx tsx
// AI : ESM entry — Ink/yoga-layout use top-level await; the main spine-cli.ts stays CJS for Next.

import { exitCodeForResult, printResult } from "@/lib/cli/format"
import { runTuiCommand } from "@/lib/cli/ink/launch"
import { CLI_EXIT_USAGE } from "@/lib/cli/types"

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === "--json" || arg === "--help" || arg === "-h") continue
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith("-")) {
      flags[key] = next
      i++
    } else {
      flags[key] = true
    }
  }
  if (argv.includes("--json")) flags.json = true
  const result = await runTuiCommand(flags)
  if (!result.data?.skipPrint) printResult(result, argv.includes("--json"))
  const code = result.command === "usage" ? CLI_EXIT_USAGE : exitCodeForResult(result)
  process.exit(code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
