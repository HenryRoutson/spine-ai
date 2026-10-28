// AI : modular LLM public API — provider registry + structured calls + OpenRouter default.
export {
  type LlmProvider,
  type LlmProviderId,
  type LlmProviderCapabilities,
  type ProviderModelId,
  type LlmTransportOptions,
  type LlmCallOptions,
  type CustomLlmProviderConfig,
  type RawReply,
  type RawUsage,
  type VisionAttachment,
  type ParallelChatResult,
} from "./types";

export { OPENROUTER_PROVIDER_ID, OpenRouterProvider, getOpenRouterProvider } from "./providers/openrouter";
export { CustomLlmProvider } from "./providers/custom";
export { SeedLlmProvider, getSeedLlmProvider, SEED_LLM_PROVIDER_ID } from "./providers/seed";
export { seedLlmReply, seedOpenAiChatCompletion } from "./seed_response";

export {
  registerLlmProviderFactory,
  getLlmProvider,
  resolveProviderForModel,
  clearLlmProviderCache,
  isServerLlmProvider,
  DEFAULT_LLM_PROVIDER_ID as DEFAULT_PROVIDER_ID,
} from "./registry";

export {
  StructuredResponseError,
  getStringResponse,
  streamStringResponse,
  getVisionStringResponse,
  getStructuredResponse,
  streamStructuredResponse,
  getStructuredResponsesParallel,
  type ChatOptions,
} from "./structured";
