import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_WEBHOOK_TIMEOUT_MS } from "@/lib/webhook-step"
import { InvalidKind, type InvalidStep } from "@/lib/validity"
import { WebhookMethod, type PipelineModule } from "@/lib/types"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"

type WebhookModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  invalid?: InvalidStep
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

const METHODS = [WebhookMethod.Post, WebhookMethod.Put, WebhookMethod.Patch] as const

export function WebhookModuleFields({ selected, edit, invalid, onUpdate }: WebhookModuleFieldsProps) {
  const missingUrl = invalid?.kind === InvalidKind.MissingWebhookUrl

  return (
    <>
      <PipelineField
        label="Webhook URL"
        hint='HTTPS endpoint or env:VAR / ${VAR} — for n8n, Zapier, search APIs, etc.'
        hintTone={missingUrl ? "error" : undefined}
      >
        {edit ? (
          <Input
            value={selected.webhookUrl ?? ""}
            onChange={(e) => onUpdate!({ webhookUrl: e.target.value || undefined })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              if (trimmed !== (selected.webhookUrl ?? "")) onUpdate!({ webhookUrl: trimmed || undefined })
            }}
            placeholder="https://… or env:N8N_WEBHOOK_URL"
            className="h-8 font-mono text-xs"
          />
        ) : selected.webhookUrl?.trim() ? (
          <StaticValue mono>{selected.webhookUrl}</StaticValue>
        ) : null}
      </PipelineField>

      <PipelineField label="HTTP method">
        {edit ? (
          <select
            value={selected.webhookMethod ?? WebhookMethod.Post}
            onChange={(e) => onUpdate!({ webhookMethod: e.target.value as WebhookMethod })}
            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        ) : (
          <StaticValue mono>{selected.webhookMethod ?? WebhookMethod.Post}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Auth env var"
        hint="Optional — env var holding Bearer token or full Authorization value"
      >
        {edit ? (
          <Input
            value={selected.webhookAuthEnv ?? ""}
            onChange={(e) => onUpdate!({ webhookAuthEnv: e.target.value || undefined })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              if (trimmed !== (selected.webhookAuthEnv ?? "")) onUpdate!({ webhookAuthEnv: trimmed || undefined })
            }}
            placeholder="TAVILY_API_KEY"
            className="h-8 font-mono text-xs"
          />
        ) : selected.webhookAuthEnv?.trim() ? (
          <StaticValue mono>{selected.webhookAuthEnv}</StaticValue>
        ) : (
          <StaticValue mono>—</StaticValue>
        )}
      </PipelineField>

      <PipelineField label="Timeout (ms)" hint={`default ${DEFAULT_WEBHOOK_TIMEOUT_MS}`}>
        {edit ? (
          <Input
            type="number"
            min={1_000}
            max={600_000}
            value={selected.webhookTimeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS}
            onChange={(e) => {
              const n = Number(e.target.value)
              onUpdate!({ webhookTimeoutMs: Number.isFinite(n) ? n : undefined })
            }}
            className="h-8 font-mono text-xs"
          />
        ) : (
          <StaticValue mono>{selected.webhookTimeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Response JSON path"
        hint="Optional dot path into the response body — e.g. data.results"
      >
        {edit ? (
          <Input
            value={selected.webhookResponsePath ?? ""}
            onChange={(e) => onUpdate!({ webhookResponsePath: e.target.value || undefined })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              if (trimmed !== (selected.webhookResponsePath ?? "")) {
                onUpdate!({ webhookResponsePath: trimmed || undefined })
              }
            }}
            placeholder="data"
            className="h-8 font-mono text-xs"
          />
        ) : selected.webhookResponsePath?.trim() ? (
          <StaticValue mono>{selected.webhookResponsePath}</StaticValue>
        ) : (
          <StaticValue mono>whole body</StaticValue>
        )}
      </PipelineField>

      {edit ? (
        <PipelineField label="Include pipeline state" hint="POST body also sends prior step outputs keyed by label">
          <div className="flex items-center gap-2.5">
            <Switch
              checked={selected.webhookIncludeState !== false}
              onCheckedChange={(checked) => onUpdate!({ webhookIncludeState: checked ? undefined : false })}
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              {selected.webhookIncludeState !== false ? "On — { input, state }" : "Off — { input } only"}
            </span>
          </div>
        </PipelineField>
      ) : (
        <PipelineField label="Include pipeline state">
          <StaticValue>{selected.webhookIncludeState !== false ? "On" : "Off"}</StaticValue>
        </PipelineField>
      )}
    </>
  )
}
