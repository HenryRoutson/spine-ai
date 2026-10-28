// AI : OpenRouter list-models pricing + our 40% markup on top of their per-token rates.
import { OPENROUTER_MODELS_URL } from "./openrouter_slugs";

export const PRICE_MARKUP = 1.4;

type UsdPerToken = number;
type Cents = number;

export interface OpenRouterRates {
  promptUsdPerToken: UsdPerToken;
  completionUsdPerToken: UsdPerToken;
}

// AI : display metric for the model picker — blended prompt+completion per 1k tokens, marked up.
export function blendedCentsPer1k(rates: OpenRouterRates): Cents {
  return +((rates.promptUsdPerToken + rates.completionUsdPerToken) * 1000 * 100 * PRICE_MARKUP).toFixed(4);
}

export function tokenCostCents(
  rates: OpenRouterRates,
  promptTokens: number,
  completionTokens: number,
): Cents {
  const usd = promptTokens * rates.promptUsdPerToken + completionTokens * rates.completionUsdPerToken;
  return +(usd * 100 * PRICE_MARKUP).toFixed(6);
}

// AI : live pull from OpenRouter — runtime pricing in openrouter_models.ts; scripts/sync_openrouter_pricing.mjs validates catalog slugs.
export async function fetchOpenRouterRates(slug: string): Promise<OpenRouterRates> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY missing — set it in the repo root .env");

  const res = await fetch(OPENROUTER_MODELS_URL, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as {
    data?: { id: string; pricing?: { prompt?: string; completion?: string } }[];
  };
  const row = data.data?.find((m) => m.id === slug);
  if (!row?.pricing?.prompt || !row.pricing.completion) {
    throw new Error(`OpenRouter pricing not found for ${slug}`);
  }

  return {
    promptUsdPerToken: Number(row.pricing.prompt) as UsdPerToken,
    completionUsdPerToken: Number(row.pricing.completion) as UsdPerToken,
  };
}
