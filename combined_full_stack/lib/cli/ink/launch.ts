// AI : Ink host — TTY uses render(); tests/CI/piped use renderToString (no hang).

import { render, renderToString } from "ink"
import type { SpineSession } from "@/lib/core/session"
import { createSpineSession } from "@/lib/core/session"
import { createThrowingEgress } from "@/lib/core/transport"
import { createFilePersist, resolveSessionPath } from "@/lib/cli/session_persist"
import type { CliCommandResult } from "@/lib/cli/types"
import { spineTuiTree } from "@/lib/cli/ink/app"
import { TUI_TABS, type TuiTab } from "@/lib/core/view"

export function parseTuiTab(raw?: string): TuiTab {
  if (raw && (TUI_TABS as readonly string[]).includes(raw)) return raw as TuiTab
  return "build"
}

export function renderSpineTuiString(
  session: SpineSession,
  sessionPath?: string,
  opts: { columns?: number; tab?: TuiTab } = {},
): string {
  return renderToString(
    spineTuiTree({ session, sessionPath, interactive: false, initialTab: opts.tab ?? "build" }),
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
  const session = createSpineSession({
    persist: createFilePersist(sessionPath),
    egress: flags.offline === true ? createThrowingEgress() : undefined,
  })

  if (!shouldLaunchInteractiveTui(flags)) {
    const tab = parseTuiTab(typeof flags.tab === "string" ? flags.tab : undefined)
    const frame = renderSpineTuiString(session, sessionPath, { tab })
    return {
      ok: true,
      command: "tui",
      issues: [],
      data: { human: frame, sessionPath, interactive: false, tab },
    }
  }

  const instance = render(
    spineTuiTree({
      session,
      sessionPath,
      interactive: true,
      initialTab: parseTuiTab(typeof flags.tab === "string" ? flags.tab : undefined),
    }),
  )
  await instance.waitUntilExit()
  return {
    ok: true,
    command: "tui",
    issues: [],
    data: { skipPrint: true, sessionPath, interactive: true },
  }
}
