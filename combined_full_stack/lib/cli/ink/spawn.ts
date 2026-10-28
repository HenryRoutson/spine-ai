// AI : tsx cannot load Ink (yoga-layout TLA) — spawn vite-node so `spine tui` still works.

import { spawn } from "node:child_process"
import { resolve } from "node:path"
import type { CliCommandResult } from "@/lib/cli/types"

export function spawnSpineTui(forwardedArgv: string[]): Promise<CliCommandResult> {
  const viteNode = resolve(process.cwd(), "node_modules/vite-node/vite-node.mjs")
  const child = spawn(
    process.execPath,
    [
      viteNode,
      "-c",
      "vite.cli.config.ts",
      "scripts/spine-tui.mts",
      "--",
      ...forwardedArgv.filter((a) => a !== "tui" && a !== "ui"),
    ],
    { stdio: "inherit", cwd: process.cwd(), env: process.env },
  )
  return new Promise((resolveResult) => {
    child.on("error", (err) => {
      resolveResult({
        ok: false,
        command: "tui",
        issues: [{ level: "error", where: "tui", message: err.message }],
      })
    })
    child.on("exit", (code) => {
      resolveResult({
        ok: code === 0,
        command: "tui",
        issues: [],
        data: { skipPrint: true, exitCode: code ?? 1 },
      })
    })
  })
}
