import type { PipelineModule } from "@/lib/types";
import { WebhookMethod } from "@/lib/types";

// AI : TODO (n8n-stage-E-exec) — do NOT fold n8n into webhook; share only URL/env resolve helpers if useful.
// AI :   N8n step talks to n8n's node catalog + execute API (lib/server/n8n-roadmap.ts), not a raw URL body POST.
// AI : TODO (arch-export-webhook) — exportWebhookStepBody{Ts,Py,Go,Rust} is the same call shape four times;
// AI :   one IR then printers (same as pipeline exporters).

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;

type env_record = Record<string, string | undefined>;

export function resolveWebhookUrl(spec: string | undefined, env: env_record = process.env): string {
  const raw = spec?.trim();
  if (!raw) throw new Error("webhook URL not configured");
  if (raw.startsWith("env:")) {
    const key = raw.slice(4).trim();
    const val = env[key];
    if (!val?.trim()) throw new Error(`environment variable ${key} is not set`);
    return val.trim();
  }
  const envRef = raw.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  if (envRef) {
    const key = envRef[1]!;
    const val = env[key];
    if (!val?.trim()) throw new Error(`environment variable ${key} is not set`);
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
};

export function webhookCallSpecFromModule(m: PipelineModule): WebhookCallSpec {
  return {
    url: m.webhookUrl?.trim() ?? "",
    method: m.webhookMethod ?? WebhookMethod.Post,
    authEnv: m.webhookAuthEnv?.trim() || undefined,
    timeoutMs: m.webhookTimeoutMs ?? DEFAULT_WEBHOOK_TIMEOUT_MS,
    includeState: m.webhookIncludeState !== false,
    responsePath: m.webhookResponsePath?.trim() || undefined,
  };
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
  const resolvedUrl = resolveWebhookUrl(spec.url, env);
  const authKey = spec.authEnv?.trim();
  const authValue = authKey ? env[authKey]?.trim() : undefined;
  const body = buildWebhookBody(input, state, spec.includeState);
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (authValue) {
    headers.Authorization = authValue.startsWith("Bearer ") ? authValue : `Bearer ${authValue}`;
  }
  const init: RequestInit = {
    method: spec.method,
    headers,
    signal: AbortSignal.timeout(spec.timeoutMs),
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
  const raw = contentType.includes("application/json") ? await res.json() : await res.text();
  return getValueAtPath(raw, spec.responsePath);
}

export function webhookStepUsesPipelineState(m: PipelineModule): boolean {
  return webhookCallSpecFromModule(m).includeState;
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
  const parts = [
    `urlEnv: "${o.urlEnv}"`,
    `method: "${o.method}"`,
    o.authEnv ? `authEnv: "${o.authEnv}"` : "",
    o.includeState ? "" : "includeState: false",
    o.responsePath ? `responsePath: "${o.responsePath}"` : "",
    o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? `timeoutMs: ${o.timeoutMs}` : "",
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
