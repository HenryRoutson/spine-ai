// AI : Ink host — TTY uses render(); tests/CI/piped use renderToString (no hang).

import { render, renderToString } from "ink"
import type { SpineSession } from "@/lib/core/session"
import { resolveTuiTab, type TuiTab } from "@/lib/core/view"
import { openCliSession, attachCliRealtime } from "@/lib/cli/session_open"
import { resolveSessionPath } from "@/lib/cli/session_persist"
import type { CliCommandResult } from "@/lib/cli/types"
import { spineTuiTree } from "@/lib/cli/ink/app"

export function parseTuiTab(raw?: string): TuiTab {
  return resolveTuiTab(raw)
}

export function renderSpineTuiString(
  session: SpineSession,
  sessionPath?: string,
  opts: { columns?: number; tab?: TuiTab | string } = {},
): string {
  return renderToString(
    spineTuiTree({ session, sessionPath, interactive: false, initialTab: resolveTuiTab(opts.tab) }),
    { columns: opts.columns ?? 80 },
  )
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
  const session = openCliSession(flags)
  const tab = parseTuiTab(typeof flags.tab === "string" ? flags.tab : undefined)

  if (!shouldLaunchInteractiveTui(flags)) {
    const frame = renderSpineTuiString(session, sessionPath, { tab })
    return {
      ok: true,
      command: "tui",
      issues: [],
      data: { human: frame, sessionPath, interactive: false, tab },
    }
  }

  const stopRealtime = await attachCliRealtime(session)
  const instance = render(
    spineTuiTree({
      session,
      sessionPath,
      interactive: true,
      initialTab: tab,
    }),
  )
  await instance.waitUntilExit()
  stopRealtime()
  return {
    ok: true,
    command: "tui",
    issues: [],
    data: { skipPrint: true, sessionPath, interactive: true },
  }
}
