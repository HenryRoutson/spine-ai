// AI : n8n + custom-code on Windmill workers (nsjail) — never new Function on the Spine server.
import { customCodeMaxRunMs } from "@/lib/custom-code-max-run"
import { customCodeEntriesForModule } from "@/lib/custom_code_entries"
import { DEFAULT_N8N_TIMEOUT_MS } from "@/lib/n8n-catalog"
import { resolveN8nForExport } from "@/lib/n8n-step"
import type { PipelineModule } from "@/lib/types"
import type { PipelineState } from "@/lib/run-types"
import { shouldRunOnWindmill, windmillConfigured } from "./config"
import { windmillClient } from "./client"
import { bunMainForN8n, windmillContentForCustom, windmillLanguageForCustom } from "./scripts"

export { shouldRunOnWindmill, windmillConfigured }

export async function runN8nPieceOnWindmill(opts: {
  n8nNodeType: string
  n8nCode?: string
  n8nParameters?: Record<string, unknown>
  n8nTimeoutMs?: number
  input: unknown
}): Promise<unknown> {
  const client = windmillClient()
  if (!client) throw new Error("Windmill is not configured (set WINDMILL_URL and WINDMILL_TOKEN)")
  const resolved = resolveN8nForExport({
    n8nNodeType: opts.n8nNodeType,
    n8nCode: opts.n8nCode,
    n8nParameters: opts.n8nParameters,
    n8nTimeoutMs: opts.n8nTimeoutMs,
  } as PipelineModule)
  return client.runPreview({
    language: "bun",
    content: bunMainForN8n(resolved.code, resolved.params),
    args: { input: opts.input },
    timeoutMs: opts.n8nTimeoutMs ?? DEFAULT_N8N_TIMEOUT_MS,
  })
}

export async function runCustomCodeOnWindmill(
  m: PipelineModule,
  input: unknown,
  state: PipelineState,
): Promise<unknown> {
  const client = windmillClient()
  if (!client) throw new Error("Windmill is not configured (set WINDMILL_URL and WINDMILL_TOKEN)")
  const entries = customCodeEntriesForModule(m)
  const timeoutMs = customCodeMaxRunMs(m)
  let lastError: Error | undefined
  for (const entry of entries) {
    if (!entry.code.trim()) continue
    try {
      return await client.runPreview({
        language: windmillLanguageForCustom(entry.language),
        content: windmillContentForCustom(entry.language, entry.code),
        args: { input, state },
        timeoutMs,
      })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError ?? new Error(`custom-code step ${m.label} has no code`)
}
