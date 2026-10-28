// AI : modular LLM layer — provider (infrastructure) vs model (catalog id) are separate concepts.
import type { FailureKind, LlmProviderId, ProviderModelId } from "../types";
import type { ServerLogger } from "../server_logger";

export type { LlmProviderId, ProviderModelId };
export type RawReply = string & { __brand: "RawReply" };

export type RawUsage = {
  promptTokens: number;
  completionTokens: number;
};

export type VisionAttachment = {
  mime: string;
  base64: string;
};

export type ParallelChatResult = {
  index: number;
  content: RawReply;
  latencyMs: number;
};

export type LlmProviderCapabilities = {
  batch: boolean;
  streaming: boolean;
  vision: boolean;
};

export type LlmTransportOptions = {
  providerModel: ProviderModelId;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  seed?: number;
  promptIndex?: number;
  round?: number;
  onUsage?: (usage: RawUsage) => void;
  onRoundTrip?: (
    inputChars: number,
    outputChars: number,
    ok: boolean,
    latencyMs: number,
    meta?: {
      attempt: number;
      promptIndex?: number;
      round?: number;
      httpStatus?: number;
      willRetry?: boolean;
      failureKind?: FailureKind;
      failureDetail?: string;
    },
  ) => void;
  onStructuredFailure?: (detail: {
    kind: Extract<FailureKind, "json_parse" | "schema">;
    error: string;
    attempt: number;
    promptIndex?: number;
    round?: number;
    inputChars: number;
    replyChars: number;
    willRetry: boolean;
  }) => void;
};

// AI : app-level call opts — providerId + providerModel required at call time (set via catalog in llm.ts).
export type LlmCallOptions = Partial<LlmTransportOptions> & {
  providerId?: LlmProviderId;
  providerModel?: ProviderModelId;
};

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly capabilities: LlmProviderCapabilities;
  chat(
    prompt: string,
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<RawReply>;
  visionChat?(
    prompt: string,
    attachments: readonly VisionAttachment[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<RawReply>;
  streamTextChat?(
    prompt: string,
    opts: LlmTransportOptions,
    onDelta: (delta: string) => void,
    log?: ServerLogger,
  ): Promise<RawReply>;
  parallelChat?(
    prompts: readonly string[],
    opts: LlmTransportOptions,
    jsonMode: boolean,
    log?: ServerLogger,
  ): Promise<ParallelChatResult[]>;
  fetchStreamingChat?(
    prompt: string,
    opts: LlmTransportOptions,
    onDelta: (delta: string) => void,
    log: ServerLogger,
    jsonMode?: boolean,
  ): Promise<RawReply>;
}

export type CustomLlmProviderConfig = {
  id: LlmProviderId;
  baseUrl: string;
  apiKey?: string;
  authHeader?: string;
  siteUrl?: string;
  appTitle?: string;
  capabilities?: Partial<LlmProviderCapabilities>;
  // AI : map generic ProviderModelId to the wire model field (defaults to providerModel as-is).
  resolveWireModel?: (providerModel: ProviderModelId) => string;
};
