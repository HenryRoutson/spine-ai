// AI : Ink host — TTY uses render(); tests/CI/piped use renderToString (no hang).

import { render, renderToString } from "ink"
import type { SpineSession } from "@/lib/core/session"
import { createSpineSession } from "@/lib/core/session"
import { createThrowingEgress } from "@/lib/core/transport"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import type { CliCommandResult } from "@/lib/cli/types"
import { spineTuiTree } from "@/lib/cli/ink/app"

export function renderSpineTuiString(session: SpineSession, sessionPath?: string, columns = 80): string {
  return renderToString(spineTuiTree({ session, sessionPath, interactive: false }), { columns })
}

export function shouldLaunchInteractiveTui(
  flags: Record<string, string | boolean>,
  stdout: { isTTY?: boolean } = process.stdout,
): boolean {
  if (flags.once === true || flags.json === true) return false
  return Boolean(stdout.isTTY)
}

export async function runTuiCommand(flags: Record<string, string | boolean>): Promise<CliCommandResult> {
  const sessionPath = resolveSessionPath(typeof flags.session === "string" ? flags.session : undefined)
  const session = createSpineSession({
    persist: createFilePersist(sessionPath),
    egress: flags.offline === true ? createThrowingEgress() : undefined,
  })

  if (!shouldLaunchInteractiveTui(flags)) {
    const frame = renderSpineTuiString(session, sessionPath)
    return {
      ok: true,
      command: "tui",
      issues: [],
      data: { human: frame, sessionPath, interactive: false },
    }
  }

  const instance = render(spineTuiTree({ session, sessionPath, interactive: true }))
  await instance.waitUntilExit()
  return {
    ok: true,
    command: "tui",
    issues: [],
    data: { skipPrint: true, sessionPath, interactive: true },
  }
}
