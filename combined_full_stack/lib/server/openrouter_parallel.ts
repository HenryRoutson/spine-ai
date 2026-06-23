// AI : thin re-export — parallel transport lives in openrouter_llm.ts.
export {
  assertResponseModel as assertRequestedModel,
  defaultParallelStrategy,
  parallelChat,
  type ParallelChatResult,
  type ParallelStrategy,
} from "./openrouter_llm";

export const DEEPSEEK_SLUG = "deepseek/deepseek-chat" as const;
