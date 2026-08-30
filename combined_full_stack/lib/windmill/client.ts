// AI : Windmill REST preview — sandboxed bun/python without deploying a saved script.
import { readWindmillConfig, type WindmillConfig } from "./config"

export type WindmillPreviewLanguage = "bun" | "python3" | "deno" | "nativets"

export type WindmillPreviewRequest = {
  language: WindmillPreviewLanguage
  content: string
  args: Record<string, unknown>
  timeoutMs?: number
}

export type WindmillClient = {
  runPreview: (req: WindmillPreviewRequest) => Promise<unknown>
}

function previewUrl(cfg: WindmillConfig): string {
  return `${cfg.url}/api/w/${encodeURIComponent(cfg.workspace)}/jobs/run_wait_result/preview`
}

const DEFAULT_PREVIEW_TIMEOUT_MS = 60_000

export function createWindmillClient(cfg: WindmillConfig, fetchImpl: typeof fetch = fetch): WindmillClient {
  return {
    async runPreview(req) {
      const timeoutMs = req.timeoutMs && req.timeoutMs > 0 ? req.timeoutMs : DEFAULT_PREVIEW_TIMEOUT_MS
      const url = `${previewUrl(cfg)}?timeout=${timeoutMs}`
      let res: Response
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${cfg.token}`,
          },
          body: JSON.stringify({
            language: req.language,
            content: req.content,
            args: req.args,
          }),
          signal: AbortSignal.timeout(timeoutMs + 5_000),
        })
      } catch (err) {
        if (err instanceof Error && err.name === "TimeoutError") {
          throw new Error(`Windmill preview timed out after ${timeoutMs}ms`)
        }
        throw err
      }
      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Windmill preview failed (${res.status}): ${text.slice(0, 800)}`)
      }
      return res.json() as Promise<unknown>
    },
  }
}

let injected: WindmillClient | null = null

export function setWindmillClientForTests(client: WindmillClient | null): void {
  injected = client
}

export function windmillClient(env: Record<string, string | undefined> = process.env): WindmillClient | null {
  if (injected) return injected
  const cfg = readWindmillConfig(env)
  if (!cfg) return null
  return createWindmillClient(cfg)
}
