// AI : backward-compat re-exports — new code should import from ./llm/.
export {
  StructuredResponseError,
  getStringResponse,
  streamStringResponse,
  getVisionStringResponse,
  getStructuredResponse,
  streamStructuredResponse,
  getStructuredResponsesParallel,
  type ChatOptions,
  type VisionAttachment,
  type RawUsage,
  type ParallelChatResult,
} from "./llm/structured";

export {
  parallelChat,
  assertResponseModel,
  defaultParallelStrategy,
  type ParallelStrategy,
  type ModelSlug,
} from "./openrouter_http";
