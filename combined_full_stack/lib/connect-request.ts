// AI : Build the live Nango/HTTP call from catalog + step params. Export bakes this shape; never tokens.
import {
  getConnectAction,
  type ConnectAction,
  type nango_provider_config_key_string,
} from "@/lib/connect-catalog"

export function connectInputField(input: unknown, field: string): unknown {
  if (input && typeof input === "object" && !Array.isArray(input) && field in (input as Record<string, unknown>)) {
    return (input as Record<string, unknown>)[field]
  }
  return undefined
}

export function assertHttpConnectUrl(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("http.request needs a valid URL")
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("http.request only allows http(s) URLs")
  }
  return url
}

export function fillNangoEndpoint(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{(\w+)\}/g, (_full, key: string) =>
    encodeURIComponent(String(params[key] ?? "")),
  )
}

function utf8ToBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function encodeGmailRaw(to: unknown, subject: unknown, body: unknown): string {
  const msg = [
    `To: ${String(to ?? "")}`,
    `Subject: ${String(subject ?? "")}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    String(body ?? ""),
  ].join("\r\n")
  return utf8ToBase64Url(msg)
}

function sheetRows(input: unknown): unknown[][] {
  if (Array.isArray(input) && input.every((row) => Array.isArray(row))) return input as unknown[][]
  if (Array.isArray(input)) return [input]
  if (input && typeof input === "object") return [Object.values(input as Record<string, unknown>)]
  return [[input]]
}

export type ConnectHttpCall = {
  kind: "http"
  method: string
  url: string
  body: unknown
}

export type ConnectNangoCall = {
  kind: "nango"
  method: ConnectAction["method"]
  provider: nango_provider_config_key_string
  endpoint: string
  body: unknown
}

export type ConnectProxyCall = ConnectHttpCall | ConnectNangoCall

export function buildConnectProxyCall(
  actionId: string,
  params: Record<string, unknown> | undefined,
  input: unknown,
): ConnectProxyCall {
  const entry = getConnectAction(actionId)
  if (!entry) throw new Error(`unknown connect action: ${actionId}`)
  const p = params ?? {}
  if (entry.auth === "none") {
    const url = assertHttpConnectUrl(typeof p.url === "string" ? p.url : "")
    const method = typeof p.method === "string" ? p.method : entry.method
    return { kind: "http", method, url, body: { ...p, input } }
  }
  if (entry.id === "slack.postMessage") {
    const textField = String(p.textField ?? "text")
    const text = connectInputField(input, textField)
    return {
      kind: "nango",
      method: entry.method,
      provider: entry.provider,
      endpoint: fillNangoEndpoint(entry.nangoEndpoint, p),
      body: {
        channel: p.channel ?? "#general",
        text: typeof text === "string" ? text : JSON.stringify(input),
      },
    }
  }
  if (entry.id === "gmail.send") {
    return {
      kind: "nango",
      method: entry.method,
      provider: entry.provider,
      endpoint: fillNangoEndpoint(entry.nangoEndpoint, p),
      body: {
        raw: encodeGmailRaw(
          connectInputField(input, String(p.toField ?? "to")),
          connectInputField(input, String(p.subjectField ?? "subject")),
          connectInputField(input, String(p.bodyField ?? "body")),
        ),
      },
    }
  }
  if (entry.id === "sheets.append") {
    const endpoint = fillNangoEndpoint(entry.nangoEndpoint, p)
    const withQuery = endpoint.includes("valueInputOption")
      ? endpoint
      : `${endpoint}${endpoint.includes("?") ? "&" : "?"}valueInputOption=USER_ENTERED`
    return {
      kind: "nango",
      method: entry.method,
      provider: entry.provider,
      endpoint: withQuery,
      body: { majorDimension: "ROWS", values: sheetRows(input) },
    }
  }
  return {
    kind: "nango",
    method: entry.method,
    provider: entry.provider,
    endpoint: fillNangoEndpoint(entry.nangoEndpoint, p),
    body: { ...p, input },
  }
}
