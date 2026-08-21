import type { PipelineModule } from "@/lib/types";
import { InputType, WebhookBodyMode, WebhookMethod } from "@/lib/types";

// AI : TODO (n8n-stage-E-exec) — do NOT fold n8n into webhook; share only URL/env resolve helpers if useful.
// AI :   N8n step talks to n8n's node catalog + execute API (lib/server/n8n-roadmap.ts), not a raw URL body POST.
// AI : TODO (arch-export-webhook) — exportWebhookStepBody{Ts,Py,Go,Rust} is the same call shape four times;
// AI :   one IR then printers (same as pipeline exporters).

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;
export const DEFAULT_POLL_DONE_WHEN = ["completed"] as const;
export const DEFAULT_POLL_FAIL_WHEN = ["failed", "nsfw", "canceled", "cancelled"] as const;
export const DEFAULT_POLL_STATUS_PATH = "status";

// AI : public generate URLs — not secrets. env:HIGGSFIELD_GENERATE_URL falls back here so Inference runs
// AI : without a server .env; only HIGGSFIELD_API_KEY must be set (Settings → Secrets).
export const WEBHOOK_URL_DEFAULTS: Record<string, string> = {
  HIGGSFIELD_GENERATE_URL: "https://platform.higgsfield.ai/higgsfield-ai/dop/standard",
  HIGGSFIELD_IMAGE_URL: "https://platform.higgsfield.ai/higgsfield-ai/soul/standard",
};

export function missingWebhookSecretMessage(key: string): string {
  return `${key} is not set. Add it in Settings → Secrets, or as an environment variable.`;
}

type env_record = Record<string, string | undefined>;

export function resolveWebhookUrl(spec: string | undefined, env: env_record = process.env): string {
  const raw = spec?.trim();
  if (!raw) throw new Error("webhook URL not configured");
  if (raw.startsWith("env:")) {
    const key = raw.slice(4).trim();
    const val = env[key]?.trim() || WEBHOOK_URL_DEFAULTS[key];
    if (!val?.trim()) throw new Error(missingWebhookSecretMessage(key));
    return val.trim();
  }
  const envRef = raw.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  if (envRef) {
    const key = envRef[1]!;
    const val = env[key]?.trim() || WEBHOOK_URL_DEFAULTS[key];
    if (!val?.trim()) throw new Error(missingWebhookSecretMessage(key));
    return val.trim();
  }
  return raw;
}

export function getValueAtPath(root: unknown, path: string | undefined): unknown {
  if (!path?.trim()) return root;
  let cur: unknown = root;
  for (const segment of path.split(".").map((s) => s.trim()).filter(Boolean)) {
    if (cur == null || typeof cur !== "object") {
      throw new Error(`webhook response path "${path}" failed at "${segment}"`);
    }
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

export function webhookEnvKeyForLabel(label: string): string {
  const slug =
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "STEP";
  return `WEBHOOK_URL_${slug}`;
}

export type WebhookCallSpec = {
  url: string;
  method: WebhookMethod;
  authEnv?: string;
  timeoutMs: number;
  includeState: boolean;
  responsePath?: string;
  bodyMode: WebhookBodyMode;
  pollStatusUrlPath?: string;
  pollStatusPath: string;
  pollDoneWhen: string[];
  pollFailWhen: string[];
  ingestUrlPath?: string;
  ingestInputType: InputType;
};

export function webhookCallSpecFromModule(m: PipelineModule): WebhookCallSpec {
  return {
    url: m.webhookUrl?.trim() ?? "",
    method: m.webhookMethod ?? WebhookMethod.Post,
    authEnv: m.webhookAuthEnv?.trim() || undefined,
    timeoutMs: m.webhookTimeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS,
    includeState: m.webhookIncludeState !== false,
    responsePath: m.webhookResponsePath?.trim() || undefined,
    bodyMode: m.webhookBodyMode === WebhookBodyMode.Raw ? WebhookBodyMode.Raw : WebhookBodyMode.Wrap,
    pollStatusUrlPath: m.webhookPollStatusUrlPath?.trim() || undefined,
    pollStatusPath: m.webhookPollStatusPath?.trim() || DEFAULT_POLL_STATUS_PATH,
    pollDoneWhen: m.webhookPollDoneWhen?.length ? m.webhookPollDoneWhen : [...DEFAULT_POLL_DONE_WHEN],
    pollFailWhen: m.webhookPollFailWhen?.length ? m.webhookPollFailWhen : [...DEFAULT_POLL_FAIL_WHEN],
    ingestUrlPath: m.webhookIngestUrlPath?.trim() || undefined,
    ingestInputType: m.webhookIngestInputType ?? InputType.Video,
  };
}

export function authorizationHeader(authValue: string): string {
  const v = authValue.trim();
  if (/^(Bearer|Key|Basic|Digest)\s+/i.test(v)) return v;
  // AI : Higgsfield Cloud keys are KEY_ID:KEY_SECRET — Bearer would 401.
  if (/^[A-Za-z0-9._-]+:[A-Za-z0-9._-]+$/.test(v)) return `Key ${v}`;
  return `Bearer ${v}`;
}

export function buildWebhookFetchBody(
  input: unknown,
  state: Record<string, unknown> | undefined,
  spec: Pick<WebhookCallSpec, "bodyMode" | "includeState">,
): unknown {
  if (spec.bodyMode === WebhookBodyMode.Raw) return input;
  return buildWebhookBody(input, state, spec.includeState);
}

export function buildWebhookBody(
  input: unknown,
  state: Record<string, unknown> | undefined,
  includeState: boolean,
): unknown {
  if (includeState && state) return { input, state };
  return { input };
}

export async function callWebhook(
  spec: WebhookCallSpec,
  input: unknown,
  state: Record<string, unknown> | undefined,
  env: env_record = process.env,
): Promise<unknown> {
  const { sliced } = await runWebhookCall(spec, input, state, env);
  return sliced;
}

export async function runWebhookCall(
  spec: WebhookCallSpec,
  input: unknown,
  state: Record<string, unknown> | undefined,
  env: env_record = process.env,
): Promise<{ terminal: unknown; sliced: unknown; authHeader?: string }> {
  const resolvedUrl = resolveWebhookUrl(spec.url, env);
  const authKey = spec.authEnv?.trim();
  const authValue = authKey ? env[authKey]?.trim() : undefined;
  if (authKey && !authValue) {
    throw new Error(missingWebhookSecretMessage(authKey));
  }
  const authHeader = authValue ? authorizationHeader(authValue) : undefined;
  const body = buildWebhookFetchBody(input, state, spec);
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (authHeader) headers.Authorization = authHeader;
  const init: RequestInit = {
    method: spec.method,
    headers,
    signal: AbortSignal.timeout(Math.min(spec.timeoutMs, 30_000)),
  };
  if (spec.method !== WebhookMethod.Post && spec.method !== WebhookMethod.Put && spec.method !== WebhookMethod.Patch) {
    throw new Error(`unsupported webhook method ${spec.method}`);
  }
  init.body = JSON.stringify(body);
  const res = await fetch(resolvedUrl, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `webhook ${res.status} ${res.statusText}${text ? `: ${text.slice(0, 240)}` : ""}`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  const submitted = contentType.includes("application/json") ? await res.json() : await res.text();
  const terminal = spec.pollStatusUrlPath
    ? await pollWebhookUntilDone(submitted, spec, authHeader, Date.now() + spec.timeoutMs)
    : submitted;
  return { terminal, sliced: getValueAtPath(terminal, spec.responsePath), authHeader };
}

function statusStringAt(root: unknown, path: string): string {
  const v = getValueAtPath(root, path);
  return typeof v === "string" ? v : String(v ?? "");
}

export async function pollWebhookUntilDone(
  submitted: unknown,
  spec: WebhookCallSpec,
  authHeader: string | undefined,
  deadlineMs: number,
): Promise<unknown> {
  const path = spec.pollStatusUrlPath;
  if (!path) return submitted;
  let current = submitted;
  let delayMs = 2_000;
  while (true) {
    const status = statusStringAt(current, spec.pollStatusPath).toLowerCase();
    if (spec.pollDoneWhen.some((s) => s.toLowerCase() === status)) return current;
    if (spec.pollFailWhen.some((s) => s.toLowerCase() === status)) {
      const err = getValueAtPath(current, "error");
      throw new Error(`webhook job ${status}${err ? `: ${String(err).slice(0, 240)}` : ""}`);
    }
    const remain = deadlineMs - Date.now();
    if (remain <= 0) throw new Error(`webhook poll timed out after ${spec.timeoutMs}ms (last status ${status || "unknown"})`);
    const statusUrl = getValueAtPath(current, path);
    if (typeof statusUrl !== "string" || !statusUrl.trim()) {
      throw new Error(`webhook poll: no URL at path "${path}"`);
    }
    await new Promise((r) => setTimeout(r, Math.min(delayMs, remain)));
    const pollHeaders: Record<string, string> = { Accept: "application/json" };
    if (authHeader) pollHeaders.Authorization = authHeader;
    const res = await fetch(statusUrl.trim(), {
      method: "GET",
      headers: pollHeaders,
      signal: AbortSignal.timeout(Math.min(30_000, Math.max(1_000, deadlineMs - Date.now()))),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`webhook poll ${res.status}${text ? `: ${text.slice(0, 240)}` : ""}`);
    }
    current = await res.json();
    delayMs = Math.min(Math.round(delayMs * 1.5), 10_000);
  }
}

export function webhookStepUsesPipelineState(m: PipelineModule): boolean {
  const spec = webhookCallSpecFromModule(m);
  return spec.bodyMode !== WebhookBodyMode.Raw && spec.includeState;
}

type webhook_export_opts = {
  urlEnv: string;
  method: WebhookMethod;
  authEnv?: string;
  includeState: boolean;
  responsePath?: string;
  timeoutMs: number;
};

function webhookExportOpts(m: PipelineModule): webhook_export_opts {
  const spec = webhookCallSpecFromModule(m);
  return {
    urlEnv: webhookEnvKeyForLabel(m.label),
    method: spec.method,
    authEnv: spec.authEnv,
    includeState: spec.includeState,
    responsePath: spec.responsePath,
    timeoutMs: spec.timeoutMs,
  };
}

export function exportWebhookStepBodyTs(m: PipelineModule, outTs: string): string {
  const o = webhookExportOpts(m);
  const spec = webhookCallSpecFromModule(m);
  const parts = [
    `urlEnv: "${o.urlEnv}"`,
    `method: "${o.method}"`,
    o.authEnv ? `authEnv: "${o.authEnv}"` : "",
    o.includeState ? "" : "includeState: false",
    o.responsePath ? `responsePath: "${o.responsePath}"` : "",
    o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? `timeoutMs: ${o.timeoutMs}` : "",
    spec.bodyMode === WebhookBodyMode.Raw ? `bodyMode: "raw"` : "",
  ].filter(Boolean);
  return [
    `const raw = await callWebhook(input, state, { ${parts.join(", ")} });`,
    `return raw as unknown as ${outTs};`,
  ].join("\n");
}

export function exportWebhookStepBodyPy(m: PipelineModule, outPy: string): string {
  const o = webhookExportOpts(m);
  const kwargs = [
    `url_env="${o.urlEnv}"`,
    `method="${o.method}"`,
    o.authEnv ? `auth_env="${o.authEnv}"` : "",
    o.includeState ? "" : "include_state=False",
    o.responsePath ? `response_path="${o.responsePath}"` : "",
    o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? `timeout_ms=${o.timeoutMs}` : "",
  ].filter(Boolean);
  return [`raw = await call_webhook(input, state, ${kwargs.join(", ")})`, `return raw  # type: ignore[return-value]  # ${outPy}`].join("\n");
}

export function exportWebhookStepBodyGo(m: PipelineModule, zero: string): string {
  const o = webhookExportOpts(m);
  return [
    `raw, err := CallWebhook(input, state, WebhookOpts{`,
    `\tURLEnv: "${o.urlEnv}",`,
    `\tMethod: "${o.method}",`,
    ...(o.authEnv ? [`\tAuthEnv: "${o.authEnv}",`] : []),
    ...(!o.includeState ? [`\tIncludeState: false,`] : []),
    ...(o.responsePath ? [`\tResponsePath: "${o.responsePath}",`] : []),
    ...(o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? [`\tTimeoutMs: ${o.timeoutMs},`] : []),
    "})",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return raw, nil",
  ].join("\n");
}

export function exportWebhookStepBodyRust(): string {
  return ["let raw = call_webhook(&input, &state).await?;", "Ok(raw)"].join("\n");
}

export function collectWebhookExportEnvKeys(
  modules: PipelineModule[],
): { label: string; envKey: string; authEnv?: string }[] {
  return modules
    .filter((m) => m.kind === "webhook")
    .map((m) => ({
      label: m.label,
      envKey: webhookEnvKeyForLabel(m.label),
      authEnv: m.webhookAuthEnv?.trim() || undefined,
    }));
}
