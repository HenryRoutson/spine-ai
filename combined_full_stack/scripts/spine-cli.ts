#!/usr/bin/env npx tsx
// AI : agent-facing CLI — wraps the same validation libs as the Testing / Structure tabs.

import { exitCodeForResult, printResult } from "@/lib/cli/format"
import { runSpineCli } from "@/lib/cli/run"
import { CLI_EXIT_USAGE } from "@/lib/cli/types"

async function main(): Promise<void> {
  const result = await runSpineCli(process.argv.slice(2))
  printResult(result, process.argv.includes("--json"))
  const code = result.command === "usage" ? CLI_EXIT_USAGE : exitCodeForResult(result)
  process.exit(code)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
