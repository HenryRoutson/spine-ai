// AI : single network chokepoint — local actions never receive this; --offline injects a thrower.

export class EgressBlockedError extends Error {
  readonly locality = "blocked" as const
  constructor(message = "egress blocked (--offline / no-network test)") {
    super(message)
    this.name = "EgressBlockedError"
  }
}

export type EgressPort = {
  bytesSent: number
  blocked?: boolean
  request: (url: string, init?: RequestInit) => Promise<Response>
}

export function createThrowingEgress(): EgressPort {
  return {
    bytesSent: 0,
    blocked: true,
    request: () => {
      throw new EgressBlockedError()
    },
  }
}

export const SPINE_API_URL_ENV = "SPINE_API_URL"
export const SPINE_API_TOKEN_ENV = "SPINE_API_TOKEN"
// AI : Bearer SPINE_API_TOKEN is sent here; requireAuth() accepts that header or Supabase cookies.

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export function createApiEgress(
  baseUrl: string,
  token?: string,
  inner: FetchLike = fetch,
  opts?: { timeoutMs?: number },
): EgressPort {
  const origin = baseUrl.replace(/\/$/, "")
  const timeoutMs = opts?.timeoutMs
  return createRecordingEgress(async (url, init) => {
    const headers = new Headers(init?.headers)
    if (token) headers.set("Authorization", `Bearer ${token}`)
    const path = url
    const abs = path.startsWith("http") ? path : `${origin}${path.startsWith("/") ? path : `/${path}`}`
    // AI : MCP/CLI must not hang forever when Next is listening but stuck.
    if (!timeoutMs || timeoutMs <= 0) {
      return inner(abs, { ...init, headers })
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const onAbort = () => controller.abort()
    init?.signal?.addEventListener("abort", onAbort, { once: true })
    try {
      return await inner(abs, { ...init, headers, signal: controller.signal })
    } finally {
      clearTimeout(timer)
      init?.signal?.removeEventListener("abort", onAbort)
    }
  })
}

export function createRecordingEgress(inner: FetchLike = fetch): EgressPort {
  const port: EgressPort = {
    bytesSent: 0,
    request: async (url, init) => {
      const body = init?.body
      if (typeof body === "string") port.bytesSent += body.length
      else if (body instanceof Uint8Array) port.bytesSent += body.byteLength
      return inner(url, init)
    },
  }
  return port
}
