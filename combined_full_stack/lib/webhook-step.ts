import { flattenPipelineModules } from "@/lib/fork-pipeline";
import type { ModuleId, PipelineModule } from "@/lib/types";
import { InputType, WebhookBodyMode, WebhookMethod } from "@/lib/types";

// AI : TODO (n8n-sidecar-S5-http) — do NOT fold live n8n into ModuleKind.Webhook; share URL/auth/timeout/poll helpers only.
// AI :   Sidecar execute lives in steps/n8n.ts (lib/server/n8n-roadmap.ts S2–S5), not a raw URL body POST.
// AI : TODO (arch-export-webhook) — exportWebhookStepBody{Ts,Py,Go,Rust} is the same call shape four times;
// AI :   one IR then printers (same as pipeline exporters).

export const DEFAULT_WEBHOOK_TIMEOUT_MS = 30_000;
export const DEFAULT_POLL_DONE_WHEN = ["completed"] as const;
export const DEFAULT_POLL_FAIL_WHEN = ["failed", "nsfw", "canceled", "cancelled"] as const;
export const DEFAULT_POLL_STATUS_PATH = "status";

// AI : public generate URLs — not secrets. env:HIGGSFIELD_GENERATE_URL falls back here so Inference runs
// AI : without a server .env; only HIGGSFIELD_API_KEY must be set (Library → Secrets).
export const WEBHOOK_URL_DEFAULTS: Record<string, string> = {
  HIGGSFIELD_GENERATE_URL: "https://platform.higgsfield.ai/higgsfield-ai/dop/standard",
  HIGGSFIELD_IMAGE_URL: "https://platform.higgsfield.ai/higgsfield-ai/soul/standard",
};

export function missingWebhookSecretMessage(key: string): string {
  return `${key} is not set. Add it in Library → Secrets, or as an environment variable.`;
}

type env_record = Record<string, string | undefined>;

export function webhookUrlEnvKey(url: string | undefined): string | undefined {
  const raw = url?.trim() ?? "";
  if (raw.startsWith("env:")) return raw.slice(4).trim() || undefined;
  const envRef = raw.match(/^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/);
  return envRef?.[1];
}

export function resolveWebhookUrl(spec: string | undefined, env: env_record = process.env): string {
  const raw = spec?.trim();
  if (!raw) throw new Error("webhook URL not configured");
  const key = webhookUrlEnvKey(raw);
  if (!key) return raw;
  const val = env[key]?.trim() || WEBHOOK_URL_DEFAULTS[key];
  if (!val?.trim()) throw new Error(missingWebhookSecretMessage(key));
  return val.trim();
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
  urlEnv?: string;
  url?: string;
  urlDefault?: string;
  method: WebhookMethod;
  authEnv?: string;
  includeState: boolean;
  responsePath?: string;
  timeoutMs: number;
  bodyMode: WebhookBodyMode;
  pollStatusUrlPath?: string;
  pollStatusPath: string;
  pollDoneWhen: string[];
  pollFailWhen: string[];
  ingestUrlPath?: string;
  ingestInputType: InputType;
};

function webhookExportOpts(m: PipelineModule): webhook_export_opts {
  const spec = webhookCallSpecFromModule(m);
  const envKey = webhookUrlEnvKey(m.webhookUrl) ?? (spec.url.startsWith("http") ? undefined : webhookEnvKeyForLabel(m.label));
  const literal = !envKey && spec.url.startsWith("http") ? spec.url : undefined;
  return {
    urlEnv: envKey,
    url: literal,
    urlDefault: envKey ? WEBHOOK_URL_DEFAULTS[envKey] : undefined,
    method: spec.method,
    authEnv: spec.authEnv,
    includeState: spec.includeState,
    responsePath: spec.responsePath,
    timeoutMs: spec.timeoutMs,
    bodyMode: spec.bodyMode,
    pollStatusUrlPath: spec.pollStatusUrlPath,
    pollStatusPath: spec.pollStatusPath,
    pollDoneWhen: spec.pollDoneWhen,
    pollFailWhen: spec.pollFailWhen,
    ingestUrlPath: spec.ingestUrlPath,
    ingestInputType: spec.ingestInputType,
  };
}

function webhookExportCallFieldsTs(o: webhook_export_opts): string[] {
  return [
    o.urlEnv ? `urlEnv: ${JSON.stringify(o.urlEnv)}` : "",
    o.url ? `url: ${JSON.stringify(o.url)}` : "",
    o.urlDefault ? `urlDefault: ${JSON.stringify(o.urlDefault)}` : "",
    `method: ${JSON.stringify(o.method)}`,
    o.authEnv ? `authEnv: ${JSON.stringify(o.authEnv)}` : "",
    o.includeState ? "" : "includeState: false",
    o.responsePath ? `responsePath: ${JSON.stringify(o.responsePath)}` : "",
    o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? `timeoutMs: ${o.timeoutMs}` : "",
    o.bodyMode === WebhookBodyMode.Raw ? `bodyMode: "raw"` : "",
    o.pollStatusUrlPath ? `pollStatusUrlPath: ${JSON.stringify(o.pollStatusUrlPath)}` : "",
    o.pollStatusUrlPath ? `pollStatusPath: ${JSON.stringify(o.pollStatusPath)}` : "",
    o.pollStatusUrlPath ? `pollDoneWhen: ${JSON.stringify(o.pollDoneWhen)}` : "",
    o.pollStatusUrlPath ? `pollFailWhen: ${JSON.stringify(o.pollFailWhen)}` : "",
    o.ingestUrlPath ? `ingestUrlPath: ${JSON.stringify(o.ingestUrlPath)}` : "",
    o.ingestUrlPath ? `ingestInputType: ${JSON.stringify(o.ingestInputType)}` : "",
  ].filter(Boolean);
}

export function exportWebhookStepBodyTs(m: PipelineModule, outTs: string): string {
  const o = webhookExportOpts(m);
  const stateArg = webhookStepUsesPipelineState(m) ? "state" : "undefined";
  return [
    `const raw = await callWebhook(input, ${stateArg}, { ${webhookExportCallFieldsTs(o).join(", ")} });`,
    `return raw as unknown as ${outTs};`,
  ].join("\n");
}

export function exportWebhookStepBodyPy(m: PipelineModule, outPy: string): string {
  const o = webhookExportOpts(m);
  const stateArg = webhookStepUsesPipelineState(m) ? "state" : "None";
  const kwargs = [
    o.urlEnv ? `url_env=${JSON.stringify(o.urlEnv)}` : "",
    o.url ? `url=${JSON.stringify(o.url)}` : "",
    o.urlDefault ? `url_default=${JSON.stringify(o.urlDefault)}` : "",
    `method=${JSON.stringify(o.method)}`,
    o.authEnv ? `auth_env=${JSON.stringify(o.authEnv)}` : "",
    o.includeState ? "" : "include_state=False",
    o.responsePath ? `response_path=${JSON.stringify(o.responsePath)}` : "",
    o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? `timeout_ms=${o.timeoutMs}` : "",
    o.bodyMode === WebhookBodyMode.Raw ? `body_mode="raw"` : "",
    o.pollStatusUrlPath ? `poll_status_url_path=${JSON.stringify(o.pollStatusUrlPath)}` : "",
    o.pollStatusUrlPath ? `poll_status_path=${JSON.stringify(o.pollStatusPath)}` : "",
    o.pollStatusUrlPath ? `poll_done_when=${JSON.stringify(o.pollDoneWhen)}` : "",
    o.pollStatusUrlPath ? `poll_fail_when=${JSON.stringify(o.pollFailWhen)}` : "",
    o.ingestUrlPath ? `ingest_url_path=${JSON.stringify(o.ingestUrlPath)}` : "",
    o.ingestUrlPath ? `ingest_input_type=${JSON.stringify(o.ingestInputType)}` : "",
  ].filter(Boolean);
  return [`raw = await call_webhook(input, ${stateArg}, ${kwargs.join(", ")})`, `return raw  # type: ignore[return-value]  # ${outPy}`].join("\n");
}

export function exportWebhookStepBodyGo(m: PipelineModule, zero: string): string {
  const o = webhookExportOpts(m);
  const stateArg = webhookStepUsesPipelineState(m) ? "state" : "nil";
  return [
    `raw, err := CallWebhook(input, ${stateArg}, WebhookOpts{`,
    ...(o.urlEnv ? [`\tURLEnv: ${JSON.stringify(o.urlEnv)},`] : []),
    ...(o.url ? [`\tURL: ${JSON.stringify(o.url)},`] : []),
    ...(o.urlDefault ? [`\tURLDefault: ${JSON.stringify(o.urlDefault)},`] : []),
    `\tMethod: ${JSON.stringify(o.method)},`,
    ...(o.authEnv ? [`\tAuthEnv: ${JSON.stringify(o.authEnv)},`] : []),
    ...(!o.includeState ? [`\tIncludeState: false,`] : []),
    ...(o.responsePath ? [`\tResponsePath: ${JSON.stringify(o.responsePath)},`] : []),
    ...(o.timeoutMs !== DEFAULT_WEBHOOK_TIMEOUT_MS ? [`\tTimeoutMs: ${o.timeoutMs},`] : []),
    ...(o.bodyMode === WebhookBodyMode.Raw ? [`\tBodyMode: "raw",`] : []),
    ...(o.pollStatusUrlPath ? [`\tPollStatusURLPath: ${JSON.stringify(o.pollStatusUrlPath)},`] : []),
    ...(o.ingestUrlPath ? [`\tIngestURLPath: ${JSON.stringify(o.ingestUrlPath)},`] : []),
    "})",
    "if err != nil {",
    `\treturn ${zero}, err`,
    "}",
    "return raw, nil",
  ].join("\n");
}

export function exportWebhookStepBodyRust(m: PipelineModule): string {
  const o = webhookExportOpts(m);
  const stateArg = webhookStepUsesPipelineState(m) ? "&state" : "&serde_json::json!({})";
  const fields = [
    o.urlEnv ? `url_env: Some(${JSON.stringify(o.urlEnv)}.to_string())` : "url_env: None",
    o.url ? `url: Some(${JSON.stringify(o.url)}.to_string())` : "url: None",
    o.urlDefault ? `url_default: Some(${JSON.stringify(o.urlDefault)}.to_string())` : "url_default: None",
    `method: ${JSON.stringify(o.method)}.to_string()`,
    o.authEnv ? `auth_env: Some(${JSON.stringify(o.authEnv)}.to_string())` : "auth_env: None",
    `include_state: ${o.includeState}`,
    o.bodyMode === WebhookBodyMode.Raw ? `body_mode: "raw".to_string()` : `body_mode: "wrap".to_string()`,
    o.pollStatusUrlPath ? `poll_status_url_path: Some(${JSON.stringify(o.pollStatusUrlPath)}.to_string())` : "poll_status_url_path: None",
    o.ingestUrlPath ? `ingest_url_path: Some(${JSON.stringify(o.ingestUrlPath)}.to_string())` : "ingest_url_path: None",
  ];
  return [
    `let raw = call_webhook(&input, ${stateArg}, WebhookOpts { ${fields.join(", ")} }).await?;`,
    "Ok(raw)",
  ].join("\n");
}

export type secret_role = "auth" | "url";

export type SecretRequirement = {
  name: string;
  stepId: ModuleId;
  stepLabel: string;
  role: secret_role;
  optional: boolean;
};

export type SecretRequirementStatus = SecretRequirement & {
  present: boolean;
};

export type GroupedSecretRequirement = {
  name: string;
  optional: boolean;
  steps: string[];
  roles: secret_role[];
};

export function collectSecretRequirements(modules: PipelineModule[]): SecretRequirement[] {
  const out: SecretRequirement[] = [];
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind !== "webhook") continue;
    const spec = webhookCallSpecFromModule(m);
    const urlKey = webhookUrlEnvKey(m.webhookUrl);
    if (urlKey) {
      out.push({
        name: urlKey,
        stepId: m.id,
        stepLabel: m.label,
        role: "url",
        optional: urlKey in WEBHOOK_URL_DEFAULTS,
      });
    }
    if (spec.authEnv) {
      out.push({
        name: spec.authEnv,
        stepId: m.id,
        stepLabel: m.label,
        role: "auth",
        optional: false,
      });
    }
  }
  return out;
}

export function groupSecretRequirements(reqs: SecretRequirement[]): GroupedSecretRequirement[] {
  const byName = new Map<string, GroupedSecretRequirement>();
  for (const r of reqs) {
    const existing = byName.get(r.name);
    if (!existing) {
      byName.set(r.name, {
        name: r.name,
        optional: r.optional,
        steps: [r.stepLabel],
        roles: [r.role],
      });
      continue;
    }
    existing.optional = existing.optional && r.optional;
    if (!existing.steps.includes(r.stepLabel)) existing.steps.push(r.stepLabel);
    if (!existing.roles.includes(r.role)) existing.roles.push(r.role);
  }
  return [...byName.values()];
}

export function secretValuePresent(env: env_record, name: string): boolean {
  return Boolean(env[name]?.trim());
}

export function missingRequiredSecrets(modules: PipelineModule[], env: env_record): SecretRequirement[] {
  return collectSecretRequirements(modules).filter((r) => !r.optional && !secretValuePresent(env, r.name));
}

export function formatMissingSecretsError(missing: SecretRequirement[]): string {
  const grouped = groupSecretRequirements(missing.filter((r) => !r.optional));
  return grouped
    .map((g) => `${missingWebhookSecretMessage(g.name)} Required by: ${g.steps.join(", ")}.`)
    .join("\n");
}

export function collectWebhookExportEnvKeys(
  modules: PipelineModule[],
): { label: string; envKey: string; authEnv?: string; optional?: boolean }[] {
  return collectSecretRequirements(modules).map((r) => ({
    label: r.stepLabel,
    envKey: r.name,
    optional: r.optional || undefined,
  }));
}
