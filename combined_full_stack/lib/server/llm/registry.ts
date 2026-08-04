// AI : persisted provider clients — avoid recreating HTTP clients / auth state per call.
import { catalogEntry, type ModelCatalogEntry } from "../model_catalog";
import type { ModelId } from "../../types";
import { CustomLlmProvider } from "./providers/custom";
import { getOpenRouterProvider } from "./providers/openrouter";
import { OPENROUTER_PROVIDER_ID } from "../openrouter_slugs";
import {
  type CustomLlmProviderConfig,
  type LlmProvider,
  type LlmProviderId,
  type ProviderModelId,
} from "./types";

export const DEFAULT_LLM_PROVIDER_ID = OPENROUTER_PROVIDER_ID as LlmProviderId;

const factories = new Map<LlmProviderId, () => LlmProvider>();
const instances = new Map<LlmProviderId, LlmProvider>();

function envProviderId(): LlmProviderId {
  const raw = process.env.LLM_PROVIDER?.trim();
  return (raw || DEFAULT_LLM_PROVIDER_ID) as LlmProviderId;
}

function registerBuiltins(): void {
  if (factories.has(DEFAULT_LLM_PROVIDER_ID)) return;
  factories.set(DEFAULT_LLM_PROVIDER_ID, getOpenRouterProvider);

  const customUrl = process.env.CUSTOM_LLM_API_URL?.trim();
  if (customUrl) {
    const customId = (process.env.CUSTOM_LLM_PROVIDER_ID?.trim() || "custom") as LlmProviderId;
    const config: CustomLlmProviderConfig = {
      id: customId,
      baseUrl: customUrl,
      apiKey: process.env.CUSTOM_LLM_API_KEY?.trim(),
      authHeader: process.env.CUSTOM_LLM_AUTH_HEADER?.trim(),
      siteUrl: process.env.CUSTOM_LLM_SITE_URL?.trim(),
      appTitle: process.env.CUSTOM_LLM_APP_TITLE?.trim(),
      capabilities: {
        batch: process.env.CUSTOM_LLM_BATCH !== "false",
        streaming: process.env.CUSTOM_LLM_STREAMING === "true",
        vision: process.env.CUSTOM_LLM_VISION === "true",
      },
    };
    factories.set(customId, () => new CustomLlmProvider(config));
  }
}

export function registerLlmProviderFactory(id: LlmProviderId, factory: () => LlmProvider): void {
  registerBuiltins();
  factories.set(id, factory);
  instances.delete(id);
}

export function getLlmProvider(id?: LlmProviderId): LlmProvider {
  registerBuiltins();
  const resolved = id ?? envProviderId();
  const cached = instances.get(resolved);
  if (cached) return cached;
  const factory = factories.get(resolved);
  if (!factory) {
    throw new Error(`Unknown LLM provider: ${resolved} — register via registerLlmProviderFactory()`);
  }
  const provider = factory();
  instances.set(resolved, provider);
  return provider;
}

export function resolveProviderForModel(modelId: ModelId | undefined): {
  entry: ModelCatalogEntry;
  provider: LlmProvider;
  providerModel: ProviderModelId;
} {
  const entry = catalogEntry(modelId);
  const provider = getLlmProvider(entry.providerId);
  return { entry, provider, providerModel: entry.providerModel };
}

export function clearLlmProviderCache(): void {
  instances.clear();
}

export function isServerLlmProvider(id: LlmProviderId): boolean {
  registerBuiltins();
  return factories.has(id);
}
