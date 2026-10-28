// AI : deterministic LLM provider for parity tests — no network, stable across UI + exports.
import { FailureKind } from "../../types";
import { logger, type ServerLogger } from "../../server_logger";
import { seedLlmReply } from "../seed_response";
import {
  type LlmProvider,
  type LlmProviderCapabilities,
  type LlmProviderId,
  type LlmTransportOptions,
  type ParallelChatResult,
  type RawReply,
  type VisionAttachment,
} from "../types";

export const SEED_LLM_PROVIDER_ID = "seed" as const;

const seedLog = logger("llm:seed");

const CAPABILITIES: LlmProviderCapabilities = {
  batch: true,
  streaming: true,
  vision: true,
};

export class SeedLlmProvider implements LlmProvider {
  readonly id = SEED_LLM_PROVIDER_ID as LlmProviderId;
  readonly capabilities = CAPABILITIES;

  chat = async (
    prompt: string,
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log: ServerLogger = seedLog,
  ): Promise<RawReply> => {
    const t0 = Date.now();
    const content = seedLlmReply(prompt, jsonMode);
    opts.onUsage?.({
      promptTokens: Math.ceil(prompt.length / 4),
      completionTokens: Math.ceil(content.length / 4),
    });
    opts.onRoundTrip?.(prompt.length, content.length, true, Date.now() - t0, { attempt: 1 });
    log.debug(`seed chat`, { replyChars: content.length, jsonMode });
    return content as RawReply;
  };

  visionChat = async (
    prompt: string,
    _attachments: readonly VisionAttachment[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<RawReply> => {
    return this.chat(prompt, opts, jsonMode, log);
  };

  streamTextChat = async (
    prompt: string,
    opts: LlmTransportOptions,
    onDelta: (delta: string) => void,
    log?: ServerLogger,
  ): Promise<RawReply> => {
    const content = await this.chat(prompt, opts, false, log);
    onDelta(content);
    return content;
  };

  parallelChat = async (
    prompts: readonly string[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<ParallelChatResult[]> => {
    const out: ParallelChatResult[] = [];
    for (let i = 0; i < prompts.length; i++) {
      const t0 = Date.now();
      const content = await this.chat(prompts[i]!, opts, jsonMode, log);
      out.push({ index: i, content, latencyMs: Date.now() - t0 });
    }
    return out;
  };

  fetchStreamingChat = async (
    prompt: string,
    opts: LlmTransportOptions,
    onDelta: (delta: string) => void,
    log: ServerLogger = seedLog,
    jsonMode = false,
  ): Promise<RawReply> => {
    try {
      const content = await this.chat(prompt, opts, jsonMode, log);
      onDelta(content);
      return content;
    } catch (e) {
      opts.onRoundTrip?.(prompt.length, 0, false, 0, {
        attempt: 1,
        failureKind: FailureKind.Provider,
        failureDetail: (e as Error).message,
      });
      throw e;
    }
  };
}

export function getSeedLlmProvider(): SeedLlmProvider {
  return new SeedLlmProvider();
}
