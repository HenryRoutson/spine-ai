// AI : enterprise internal LLMs — OpenAI-compatible chat/completions by default; override wire model via config.
import { FailureKind } from "../../types";
import { logger, type ServerLogger } from "../../server_logger";
import {
  type CustomLlmProviderConfig,
  type LlmProvider,
  type LlmProviderCapabilities,
  type LlmTransportOptions,
  type ParallelChatResult,
  type ProviderModelId,
  type RawReply,
  type RawUsage,
  type VisionAttachment,
} from "../types";

const customLog = logger("llm:custom");

const DEFAULT_MAX_TOKENS = 8192;

type JsonModeOn = boolean;

function wireModel(config: CustomLlmProviderConfig, providerModel: ProviderModelId): string {
  return config.resolveWireModel?.(providerModel) ?? providerModel;
}

function authHeaders(config: CustomLlmProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const header = config.authHeader ?? "Authorization";
  if (config.apiKey) headers[header] = header === "Authorization" ? `Bearer ${config.apiKey}` : config.apiKey;
  if (config.siteUrl) headers["HTTP-Referer"] = config.siteUrl;
  if (config.appTitle) headers["X-Title"] = config.appTitle;
  return headers;
}

function buildBody(
  messages: { role: string; content: unknown }[],
  config: CustomLlmProviderConfig,
  opts: LlmTransportOptions,
  jsonMode: JsonModeOn,
  stream = false,
): string {
  return JSON.stringify({
    model: wireModel(config, opts.providerModel),
    messages,
    temperature: opts.temperature ?? 0,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    ...(stream ? { stream: true } : {}),
  });
}

async function postChat(
  config: CustomLlmProviderConfig,
  body: string,
  inputChars: number,
  opts: LlmTransportOptions,
  log: ServerLogger,
): Promise<RawReply> {
  const t0 = Date.now();
  const res = await fetch(config.baseUrl, { method: "POST", headers: authHeaders(config), body });
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const errText = await res.text();
    const detail = `HTTP ${res.status}: ${errText.slice(0, 500)}`;
    opts.onRoundTrip?.(inputChars, 0, false, latencyMs, {
      attempt: 1,
      promptIndex: opts.promptIndex,
      round: opts.round,
      httpStatus: res.status,
      failureKind: FailureKind.Provider,
      failureDetail: detail,
    });
    throw new Error(`${config.id} ${detail}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    const detail = `${config.id} returned no message content`;
    opts.onRoundTrip?.(inputChars, 0, false, latencyMs, {
      attempt: 1,
      failureKind: FailureKind.Provider,
      failureDetail: detail,
    });
    throw new Error(detail);
  }
  opts.onUsage?.({
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  });
  opts.onRoundTrip?.(inputChars, content.length, true, latencyMs, { attempt: 1 });
  log.info(`custom chat success`, { provider: config.id, replyChars: content.length });
  return content as RawReply;
}

export class CustomLlmProvider implements LlmProvider {
  readonly id;
  readonly capabilities: LlmProviderCapabilities;

  constructor(private readonly config: CustomLlmProviderConfig) {
    this.id = config.id;
    this.capabilities = {
      batch: config.capabilities?.batch ?? true,
      streaming: config.capabilities?.streaming ?? false,
      vision: config.capabilities?.vision ?? false,
    };
  }

  async chat(
    prompt: string,
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log: ServerLogger = customLog,
  ): Promise<RawReply> {
    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content: prompt },
    ];
    return postChat(this.config, buildBody(messages, this.config, opts, jsonMode), prompt.length, opts, log);
  }

  async parallelChat(
    prompts: readonly string[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log: ServerLogger = customLog,
  ): Promise<ParallelChatResult[]> {
    if (!this.capabilities.batch) {
      const out: ParallelChatResult[] = [];
      for (let i = 0; i < prompts.length; i++) {
        const t0 = Date.now();
        const content = await this.chat(prompts[i]!, { ...opts, promptIndex: i }, jsonMode, log);
        out.push({ index: i, content, latencyMs: Date.now() - t0 });
      }
      return out;
    }
    return Promise.all(
      prompts.map(async (prompt, index) => {
        const t0 = Date.now();
        const content = await this.chat(prompt, { ...opts, promptIndex: index }, jsonMode, log);
        return { index, content, latencyMs: Date.now() - t0 };
      }),
    );
  }

  async visionChat(
    prompt: string,
    attachments: readonly VisionAttachment[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log: ServerLogger = customLog,
  ): Promise<RawReply> {
    if (!this.capabilities.vision) {
      throw new Error(`${this.id} does not support vision`);
    }
    const content: unknown[] = [{ type: "text", text: prompt }];
    for (const a of attachments) {
      content.push({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.base64}` } });
    }
    const messages = [
      ...(opts.system ? [{ role: "system", content: opts.system }] : []),
      { role: "user", content },
    ];
    const inputChars = prompt.length + attachments.reduce((n, a) => n + a.base64.length, 0);
    return postChat(this.config, buildBody(messages, this.config, opts, jsonMode), inputChars, opts, log);
  }
}
