// AI : Headless Activepieces CE — one piece action over HTTP. Testing must mock this module.
import "@/lib/server/config"
import { buildApActionInput, getApAllowlistPiece } from "@/lib/ap-catalog"

export const AP_API_URL_ENV = "AP_API_URL"
export const AP_API_KEY_ENV = "AP_API_KEY"
export const AP_FRONTEND_URL_ENV = "AP_FRONTEND_URL"
export const DEFAULT_AP_API_URL = "http://127.0.0.1:3080"

export function apApiUrl(): string {
  return (process.env[AP_API_URL_ENV]?.trim() || DEFAULT_AP_API_URL).replace(/\/$/, "")
}

export function apFrontendUrl(): string {
  return (process.env[AP_FRONTEND_URL_ENV]?.trim() || apApiUrl()).replace(/\/$/, "")
}

export function apConfigured(): boolean {
  return Boolean(process.env[AP_API_KEY_ENV]?.trim())
}

function secretHeader(): Record<string, string> {
  const key = process.env[AP_API_KEY_ENV]?.trim()
  if (!key) throw new Error("AP_API_KEY is not set — python3 scripts/setup_local.py ap")
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

export async function apRunAction(opts: {
  actionId: string
  connectionId: string
  input: unknown
  parameters?: Record<string, unknown>
}): Promise<unknown> {
  const piece = getApAllowlistPiece(opts.actionId)
  if (!piece) throw new Error(`unknown Activepieces action: ${opts.actionId}`)
  const body = {
    pieceName: piece.pieceName,
    actionName: piece.actionName,
    input: buildApActionInput(piece, opts.parameters, opts.input),
    connectionExternalId: opts.connectionId,
  }
  const host = apApiUrl()
  const paths = [
    `/api/v1/pieces/${encodeURIComponent(piece.pieceName)}/actions/${encodeURIComponent(piece.actionName)}/execute`,
    "/api/v1/mcp/run-action",
  ]
  let lastText = ""
  let lastStatus = 0
  for (const path of paths) {
    const res = await fetch(`${host}${path}`, {
      method: "POST",
      headers: secretHeader(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    })
    lastStatus = res.status
    lastText = await res.text()
    if (res.status === 404) continue
    if (!res.ok) {
      throw new Error(`Activepieces ${piece.displayName} failed (${res.status}): ${lastText.slice(0, 400)}`)
    }
    try {
      return JSON.parse(lastText) as unknown
    } catch {
      return { ok: true, body: lastText.slice(0, 2_000) }
    }
  }
  throw new Error(
    `Activepieces has no execute-action API (${lastStatus}). Testing still mocks. Use slack.postMessage (Nango) for live send, or upgrade the CE image. ${lastText.slice(0, 200)}`,
  )
}
