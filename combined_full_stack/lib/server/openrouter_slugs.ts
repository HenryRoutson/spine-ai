// AI : canonical OpenRouter model slugs — import here, not inline, to avoid drift.

export const DEEPSEEK_SLUG = "deepseek/deepseek-chat" as const;

// AI : default LLM infrastructure id — client-safe constant (no server imports).
export const OPENROUTER_PROVIDER_ID = "openrouter" as const;

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions" as const
export const OPENROUTER_AUTH_KEY_URL = "https://openrouter.ai/api/v1/auth/key" as const
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models" as const
