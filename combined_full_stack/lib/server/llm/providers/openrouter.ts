// AI : OpenRouter is one wrapped provider — default for Spine and exported pipelines.
import {
  chat,
  visionChat,
  streamTextChat,
  parallelChat,
  fetchStreamingChat,
  type ModelSlug,
} from "../../openrouter_http";
import { OPENROUTER_PROVIDER_ID } from "../../openrouter_slugs";
import { type ServerLogger } from "../../server_logger";
import {
  type LlmProvider,
  type LlmProviderCapabilities,
  type LlmProviderId,
  type LlmTransportOptions,
  type ParallelChatResult,
  type RawReply,
  type VisionAttachment,
} from "../types";

export { OPENROUTER_PROVIDER_ID };

const CAPABILITIES: LlmProviderCapabilities = {
  batch: true,
  streaming: true,
  vision: true,
};

function toOpenRouterOpts(opts: LlmTransportOptions) {
  return { ...opts, model: opts.providerModel as unknown as ModelSlug };
}

export class OpenRouterProvider implements LlmProvider {
  readonly id = OPENROUTER_PROVIDER_ID as LlmProviderId;
  readonly capabilities = CAPABILITIES;

  chat(
    prompt: string,
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<RawReply> {
    return chat(prompt, toOpenRouterOpts(opts), jsonMode, log);
  }

  visionChat(
    prompt: string,
    attachments: readonly VisionAttachment[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<RawReply> {
    return visionChat(prompt, attachments, toOpenRouterOpts(opts), jsonMode, log);
  }

  streamTextChat(
    prompt: string,
    opts: LlmTransportOptions,
    onDelta: (delta: string) => void,
    log?: ServerLogger,
  ): Promise<RawReply> {
    return streamTextChat(prompt, toOpenRouterOpts(opts), onDelta, log!);
  }

  parallelChat(
    prompts: readonly string[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<ParallelChatResult[]> {
    return parallelChat(prompts, toOpenRouterOpts(opts), jsonMode, log);
  }

  fetchStreamingChat(
    prompt: string,
    opts: LlmTransportOptions,
    onDelta: (delta: string) => void,
    log: ServerLogger,
    jsonMode = false,
  ): Promise<RawReply> {
    return fetchStreamingChat(prompt, toOpenRouterOpts(opts), onDelta, log, jsonMode);
  }
}

let cached: OpenRouterProvider | null = null;

export function getOpenRouterProvider(): OpenRouterProvider {
  if (!cached) cached = new OpenRouterProvider();
  return cached;
}
