// AI : shared DTO for browser-delegated LLM calls — client-safe (no server imports).
export type LlmClientStepSpec = {
  providerId: string;
  providerModel: string;
  prompts: string[];
  jsonMode: boolean;
  useBatch: boolean;
  inputPreview?: string;
  inputPreviewItems?: { label: string; text: string }[];
};
