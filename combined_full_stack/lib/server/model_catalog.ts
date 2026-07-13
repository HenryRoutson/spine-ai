// AI : curated picker — ModelId (demo) maps to provider + providerModel; slug kept for OpenRouter billing.
import type { ModelId, OpenRouterSlug, LlmProviderId, ProviderModelId } from "./types";
import { DEEPSEEK_SLUG, OPENROUTER_PROVIDER_ID } from "./openrouter_slugs";

export type ModelCatalogEntry = {
  id: ModelId;
  label: string;
  providerId: LlmProviderId;
  providerModel: ProviderModelId;
  slug: OpenRouterSlug;
};

function catalogRow(
  id: ModelId,
  label: string,
  slug: OpenRouterSlug,
  providerId: LlmProviderId = OPENROUTER_PROVIDER_ID as LlmProviderId,
): ModelCatalogEntry {
  return { id, label, providerId, providerModel: slug as unknown as ProviderModelId, slug };
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  catalogRow("qwen-2.5-72b", "Qwen 2.5 72B", "qwen/qwen-2.5-72b-instruct" as OpenRouterSlug),
  catalogRow("deepseek-v3", "DeepSeek V3", DEEPSEEK_SLUG as OpenRouterSlug),
  catalogRow("glm-5.2", "GLM 5.2", "z-ai/glm-5.2" as OpenRouterSlug),
  catalogRow("gpt-5-mini", "GPT-5 mini", "openai/gpt-4o-mini" as OpenRouterSlug),
  catalogRow("claude-opus-4.6", "Claude Opus 4.6", "anthropic/claude-opus-4.1" as OpenRouterSlug),
  catalogRow("sonnet-4.7", "Claude Sonnet 4.7", "anthropic/claude-sonnet-4.5" as OpenRouterSlug),
  catalogRow("gemini-3-flash", "Gemini 3 Flash", "google/gemini-3-flash-preview" as OpenRouterSlug),
];

// AI : legacy persisted ids — map to current catalog entry without breaking old projects.
const LEGACY_MODEL_IDS: Record<string, ModelId> = {
  "glm-4-plus": "glm-5.2",
};

export function resolveModelId(modelId: ModelId | undefined): ModelId {
  if (!modelId) return MODEL_CATALOG[1]!.id;
  return LEGACY_MODEL_IDS[modelId] ?? modelId;
}

export function catalogEntry(modelId: ModelId | undefined): ModelCatalogEntry {
  const id = resolveModelId(wireModelId(modelId));
  return MODEL_CATALOG.find((m) => m.id === id) ?? MODEL_CATALOG[1]!;
}

function catalogHasModel(modelId: ModelId): boolean {
  const resolved = LEGACY_MODEL_IDS[modelId] ?? modelId;
  return MODEL_CATALOG.some((m) => m.id === resolved);
}

export { catalogHasModel };

// AI : bare catalog id from wire value — "openrouter:gpt-5-mini" → "gpt-5-mini".
export function wireModelId(raw: ModelId | undefined): ModelId | undefined {
  if (!raw) return undefined;
  const idx = raw.indexOf(":");
  return idx === -1 ? raw : raw.slice(idx + 1);
}

function catalogHasWireModel(raw: ModelId): boolean {
  const modelId = wireModelId(raw);
  if (!modelId) return false;
  return catalogHasModel(modelId);
}

export type ParsedRoutedModel = {
  providerId: LlmProviderId;
  modelId: ModelId;
};

export function parseRoutedModel(raw: ModelId | undefined, defaultProviderId: LlmProviderId = OPENROUTER_PROVIDER_ID as LlmProviderId): ParsedRoutedModel {
  if (!raw || raw === "") {
    const modelId = MODEL_CATALOG[1]!.id;
    return { providerId: defaultProviderId, modelId };
  }
  const idx = raw.indexOf(":");
  if (idx === -1) {
    return { providerId: defaultProviderId, modelId: resolveModelId(raw) };
  }
  const providerId = raw.slice(0, idx) as LlmProviderId;
  const modelId = resolveModelId(raw.slice(idx + 1));
  return { providerId, modelId };
}

export function formatRoutedModel(providerId: string, modelId: ModelId): ModelId {
  return `${providerId}:${resolveModelId(modelId)}`;
}

export function catalogLabel(modelId: ModelId | undefined): string {
  return catalogEntry(wireModelId(modelId)).label;
}

export class UnknownModelError extends Error {
  constructor(readonly model: string) {
    super(`Unknown model: ${model}`);
    this.name = "UnknownModelError";
  }
}

// AI : reject client-supplied model ids that are not in the catalog — never trust picker JSON for billing.
export function parseRequestModel(model: ModelId | undefined, fallback: ModelId): ModelId {
  if (model == null || model === "") {
    return formatRoutedModel(OPENROUTER_PROVIDER_ID, resolveModelId(wireModelId(fallback) ?? fallback));
  }
  if (!catalogHasWireModel(model)) throw new UnknownModelError(model);
  const parsed = parseRoutedModel(model);
  return formatRoutedModel(parsed.providerId, parsed.modelId);
}

export function parseOptionalRequestModel(model: ModelId | undefined): ModelId | undefined {
  if (model == null || model === "") return undefined;
  if (!catalogHasWireModel(model)) throw new UnknownModelError(model);
  const parsed = parseRoutedModel(model);
  return formatRoutedModel(parsed.providerId, parsed.modelId);
}

export function sanitizeModuleModels<T extends { model?: ModelId }>(modules: T[]): T[] {
  return modules.map((m) => {
    if (m.model == null || m.model === "") return m;
    if (!catalogHasWireModel(m.model)) {
      const { model: _drop, ...rest } = m;
      return rest as T;
    }
    const parsed = parseRoutedModel(m.model);
    const normalized = formatRoutedModel(parsed.providerId, parsed.modelId);
    return normalized === m.model ? m : { ...m, model: normalized };
  });
}

export function slugFor(modelId: ModelId | undefined): OpenRouterSlug {
  return catalogEntry(wireModelId(modelId)).slug;
}

export function providerFor(modelId: ModelId | undefined): LlmProviderId {
  return parseRoutedModel(modelId).providerId;
}

export function providerModelFor(modelId: ModelId | undefined): ProviderModelId {
  return catalogEntry(wireModelId(modelId)).providerModel;
}
