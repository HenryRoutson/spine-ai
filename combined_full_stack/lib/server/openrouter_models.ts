// AI : live OpenRouter /models feed — merges MODEL_CATALOG with current per-token rates (40% markup on billing).
import { MODEL_CATALOG, catalogEntry, type ModelCatalogEntry } from "./model_catalog";
import { blendedCentsPer1k, type OpenRouterRates } from "./openrouter_pricing";
import { OPENROUTER_MODELS_URL } from "./openrouter_slugs";
import { logger } from "./server_logger";
import type { ModelId, ModelOption, ModelOptionPublic, OpenRouterSlug } from "./types";

const orModelsLog = logger("openrouter:models");
const CACHE_TTL_MS = 60 * 60 * 1000;

type OpenRouterModelRow = {
  id: string;
  name?: string;
  pricing?: { prompt?: string; completion?: string };
};

let cachedOptions: ModelOption[] | null = null;
let cachedAt = 0;
let refreshPromise: Promise<ModelOption[]> | null = null;

function providerFromSlug(slug: OpenRouterSlug): string {
  return slug.split("/")[0] ?? "openrouter";
}

function ratesFromRow(row: OpenRouterModelRow): OpenRouterRates | null {
  if (!row.pricing?.prompt || !row.pricing.completion) return null;
  return {
    promptUsdPerToken: Number(row.pricing.prompt),
    completionUsdPerToken: Number(row.pricing.completion),
  };
}

function catalogToOption(entry: ModelCatalogEntry, rates: OpenRouterRates): ModelOption {
  return {
    id: entry.id,
    label: entry.label,
    provider: providerFromSlug(entry.slug),
    providerId: entry.providerId,
    costPer1k: blendedCentsPer1k(rates),
    promptUsdPerToken: rates.promptUsdPerToken,
    completionUsdPerToken: rates.completionUsdPerToken,
    slug: entry.slug,
  };
}

async function fetchOpenRouterRatesBySlug(): Promise<Map<string, OpenRouterRates>> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY missing — set it in the repo root .env");

  const res = await fetch(OPENROUTER_MODELS_URL, {
    headers: { Authorization: `Bearer ${key}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`OpenRouter models ${res.status}: ${await res.text()}`);

  const data = (await res.json()) as { data?: OpenRouterModelRow[] };
  const bySlug = new Map<string, OpenRouterRates>();
  for (const row of data.data ?? []) {
    const rates = ratesFromRow(row);
    if (rates) bySlug.set(row.id, rates);
  }
  return bySlug;
}

function buildOptionsFromRates(bySlug: Map<string, OpenRouterRates>): ModelOption[] {
  const options: ModelOption[] = [];
  for (const entry of MODEL_CATALOG) {
    const rates = bySlug.get(entry.slug);
    if (!rates) {
      orModelsLog.warn(`pricing missing for ${entry.slug} (${entry.id})`);
      continue;
    }
    options.push(catalogToOption(entry, rates));
  }
  if (options.length === 0) throw new Error("OpenRouter returned no pricing for the model catalog");
  return options;
}

export async function refreshModelOptions(): Promise<ModelOption[]> {
  const bySlug = await fetchOpenRouterRatesBySlug();
  const options = buildOptionsFromRates(bySlug);
  cachedOptions = options;
  cachedAt = Date.now();
  orModelsLog.debug(`refreshed model options`, { count: options.length });
  return options;
}

export async function getModelOptions(): Promise<ModelOption[]> {
  if (cachedOptions && Date.now() - cachedAt < CACHE_TTL_MS) return cachedOptions;
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshModelOptions()
    .catch((err) => {
      orModelsLog.error(`refresh failed`, { err: String(err) });
      if (cachedOptions) return cachedOptions;
      throw err;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function ensureModelOptionsFresh(): Promise<void> {
  // AI : seed LLM parity tests run offline — skip live /models fetch.
  if (process.env.LLM_PROVIDER?.trim() === "seed") return;
  await getModelOptions();
}

// AI : strip slug + raw OpenRouter rates before sending modelOptions to the browser.
export function toPublicModelOptions(options: readonly ModelOption[]): ModelOptionPublic[] {
  return options.map(({ id, label, provider, providerId, costPer1k }) => ({
    id,
    label,
    provider,
    providerId,
    costPer1k,
  }));
}

export function modelOptionsCached(): readonly ModelOption[] {
  return cachedOptions ?? [];
}

export function modelOption(modelId: ModelId): ModelOption {
  const id = catalogEntry(modelId).id;
  const hit = cachedOptions?.find((m) => m.id === id);
  if (hit) return hit;
  const entry = catalogEntry(modelId);
  // AI : cold cache fallback — billing uses zeros until ensureModelOptionsFresh() runs.
  return {
    id: entry.id,
    label: entry.label,
    provider: providerFromSlug(entry.slug),
    providerId: entry.providerId,
    costPer1k: 0,
    promptUsdPerToken: 0,
    completionUsdPerToken: 0,
    slug: entry.slug,
  };
}
