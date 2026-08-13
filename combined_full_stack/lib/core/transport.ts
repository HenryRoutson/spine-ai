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
  request: (url: string, init?: RequestInit) => Promise<Response>
}

export function createThrowingEgress(): EgressPort {
  return {
    bytesSent: 0,
    request: () => {
      throw new EgressBlockedError()
    },
  }
}

export function createRecordingEgress(inner: typeof fetch = fetch): EgressPort {
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
