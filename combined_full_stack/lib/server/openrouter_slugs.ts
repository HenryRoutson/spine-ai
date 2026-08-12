// AI : canonical OpenRouter model slugs — import here, not inline, to avoid drift.

export const DEEPSEEK_SLUG = "deepseek/deepseek-chat" as const;
// AI : cheap parity / batch model — OpenRouter seed + temperature 0 for deterministic runs.
export const DEEPSEEK_FLASH_SLUG = "deepseek/deepseek-v4-flash-0731" as const;

// AI : default LLM infrastructure id — client-safe constant (no server imports).
export const OPENROUTER_PROVIDER_ID = "openrouter" as const;

export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions" as const
export const OPENROUTER_AUTH_KEY_URL = "https://openrouter.ai/api/v1/auth/key" as const
export const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models" as const

// AI : OPENROUTER_BASE_URL overrides host for seed-LLM mock / proxies (append /chat/completions if bare).
export function resolveOpenRouterChatUrl(): string {
  const base = process.env.OPENROUTER_BASE_URL?.trim();
  if (!base) return OPENROUTER_CHAT_URL;
  if (base.includes("/chat/completions")) return base;
  return `${base.replace(/\/$/, "")}/chat/completions`;
}

/** Integer seed for OpenRouter deterministic sampling — env OPENROUTER_SEED, default unset. */
export function resolveOpenRouterSeed(): number | undefined {
  const raw = process.env.OPENROUTER_SEED?.trim();
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}