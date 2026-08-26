// AI : Headless Nango — Spine never sends users to nango.dev. Vendor OAuth popup only.
// AI : load repo-root .env so NANGO_SECRET_KEY works when Next only auto-loads this app dir.
import "@/lib/server/config"
import { getConnectAction, type connect_action_id_string } from "@/lib/connect-catalog"
import { buildConnectProxyCall } from "@/lib/connect-request"

export const NANGO_SECRET_KEY_ENV = "NANGO_SECRET_KEY"
export const NANGO_HOST_ENV = "NANGO_HOST"
export const DEFAULT_NANGO_HOST = "http://127.0.0.1:3003"

export type nango_session_token_string = string & { __brand: "nango_session_token" }
export type nango_connection_id_string = string & { __brand: "nango_connection_id" }

export function nangoHost(): string {
  return (process.env[NANGO_HOST_ENV]?.trim() || DEFAULT_NANGO_HOST).replace(/\/$/, "")
}

export function nangoConfigured(): boolean {
  return Boolean(process.env[NANGO_SECRET_KEY_ENV]?.trim())
}

function secretHeader(): Record<string, string> {
  const key = process.env[NANGO_SECRET_KEY_ENV]?.trim()
  if (!key) throw new Error("NANGO_SECRET_KEY is not set — self-host Nango next to Spine")
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }
}

export async function createNangoConnectSession(opts: {
  endUserId: string
  actionId: connect_action_id_string
}): Promise<{ sessionToken: nango_session_token_string; host: string; provider: string }> {
  const entry = getConnectAction(opts.actionId)
  if (!entry) throw new Error(`unknown connect action: ${opts.actionId}`)
  if (entry.auth === "none") {
    throw new Error(`${entry.displayName} does not need an account connection`)
  }
  const host = nangoHost()
  const res = await fetch(`${host}/connect/sessions`, {
    method: "POST",
    headers: secretHeader(),
    body: JSON.stringify({
      end_user: { id: opts.endUserId },
      allowed_integrations: [entry.provider],
    }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Nango session failed (${res.status}): ${text.slice(0, 240)}`)
  }
  const body = (await res.json()) as { data?: { token?: string }; token?: string }
  const token = body.data?.token ?? body.token
  if (!token) throw new Error("Nango session response had no token")
  return {
    sessionToken: token as nango_session_token_string,
    host,
    provider: entry.provider,
  }
}

export async function nangoProxy(opts: {
  actionId: string
  connectionId: string
  input: unknown
  parameters?: Record<string, unknown>
}): Promise<unknown> {
  const entry = getConnectAction(opts.actionId)
  if (!entry) throw new Error(`unknown connect action: ${opts.actionId}`)
  const call = buildConnectProxyCall(opts.actionId, opts.parameters, opts.input)
  if (call.kind === "http") {
    const res = await fetch(call.url, {
      method: call.method,
      headers: { "Content-Type": "application/json" },
      body: call.method.toUpperCase() === "GET" ? undefined : JSON.stringify(call.body),
      signal: AbortSignal.timeout(30_000),
    })
    const text = await res.text()
    try {
      return JSON.parse(text) as unknown
    } catch {
      return { status: res.status, body: text.slice(0, 2_000) }
    }
  }
  const host = nangoHost()
  const res = await fetch(`${host}/proxy${call.endpoint}`, {
    method: call.method,
    headers: {
      ...secretHeader(),
      "Connection-Id": opts.connectionId,
      "Provider-Config-Key": call.provider,
    },
    body: call.method === "GET" ? undefined : JSON.stringify(call.body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  if (res.status === 401 || res.status === 403) {
    throw new Error(`Reconnect ${entry.displayName} — the app login expired`)
  }
  if (!res.ok) throw new Error(`Connect ${entry.displayName} failed (${res.status}): ${text.slice(0, 400)}`)
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { ok: true, body: text.slice(0, 2_000) }
  }
}
