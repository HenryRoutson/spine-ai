import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { DEFAULT_WEBHOOK_TIMEOUT_MS } from "@/lib/webhook-step"
import { InvalidKind, type InvalidStep } from "@/lib/validity"
import { InputType, WebhookBodyMode, WebhookMethod, type PipelineModule } from "@/lib/types"
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
        hint="HTTPS endpoint, env:VAR, or ${VAR}. Public Higgsfield generate URLs have built-in defaults — set HIGGSFIELD_API_KEY in Settings → Secrets."
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
        hint="Settings → Secrets name, or process env. Value is sent as Authorization (`Key id:secret`, `Bearer …`)."
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

      <PipelineField
        label="JSON body"
        hint="Wrap keeps { input, state }. Raw posts the typed spine (use this for generate APIs)."
      >
        {edit ? (
          <select
            value={selected.webhookBodyMode ?? WebhookBodyMode.Wrap}
            onChange={(e) =>
              onUpdate!({ webhookBodyMode: e.target.value as WebhookBodyMode })
            }
            className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
          >
            <option value={WebhookBodyMode.Wrap}>wrap — {"{ input, state }"}</option>
            <option value={WebhookBodyMode.Raw}>raw — spine JSON</option>
          </select>
        ) : (
          <StaticValue mono>{selected.webhookBodyMode ?? WebhookBodyMode.Wrap}</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Poll status URL path"
        hint="Dot path on the submit JSON to a GET URL (e.g. status_url). Empty = one-shot. Not a vendor connector."
      >
        {edit ? (
          <Input
            value={selected.webhookPollStatusUrlPath ?? ""}
            onChange={(e) => onUpdate!({ webhookPollStatusUrlPath: e.target.value || undefined })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              if (trimmed !== (selected.webhookPollStatusUrlPath ?? "")) {
                onUpdate!({ webhookPollStatusUrlPath: trimmed || undefined })
              }
            }}
            placeholder="status_url"
            className="h-8 font-mono text-xs"
          />
        ) : selected.webhookPollStatusUrlPath?.trim() ? (
          <StaticValue mono>{selected.webhookPollStatusUrlPath}</StaticValue>
        ) : (
          <StaticValue mono>—</StaticValue>
        )}
      </PipelineField>

      <PipelineField
        label="Store media URL path"
        hint="Dot path on the completed JSON to a file URL — fetched into Documents and typed as VideoClip/AudioClip"
      >
        {edit ? (
          <Input
            value={selected.webhookIngestUrlPath ?? ""}
            onChange={(e) => onUpdate!({ webhookIngestUrlPath: e.target.value || undefined })}
            onBlur={(e) => {
              const trimmed = e.target.value.trim()
              if (trimmed !== (selected.webhookIngestUrlPath ?? "")) {
                onUpdate!({ webhookIngestUrlPath: trimmed || undefined })
              }
            }}
            placeholder="video.url"
            className="h-8 font-mono text-xs"
          />
        ) : selected.webhookIngestUrlPath?.trim() ? (
          <StaticValue mono>{selected.webhookIngestUrlPath}</StaticValue>
        ) : (
          <StaticValue mono>—</StaticValue>
        )}
      </PipelineField>

      {selected.webhookIngestUrlPath?.trim() ? (
        <PipelineField label="Stored media type">
          {edit ? (
            <select
              value={selected.webhookIngestInputType ?? InputType.Video}
              onChange={(e) => onUpdate!({ webhookIngestInputType: e.target.value as InputType })}
              className="h-8 w-full rounded-md border border-input bg-background px-2 font-mono text-xs"
            >
              <option value={InputType.Video}>video</option>
              <option value={InputType.Audio}>audio</option>
              <option value={InputType.Image}>image</option>
            </select>
          ) : (
            <StaticValue mono>{selected.webhookIngestInputType ?? InputType.Video}</StaticValue>
          )}
        </PipelineField>
      ) : null}
    </>
  )
}
