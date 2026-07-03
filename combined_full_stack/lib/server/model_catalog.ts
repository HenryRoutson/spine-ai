// AI : curated picker + slug map — labels and ids are stable; pricing comes from OpenRouter at runtime.
import type { ModelId, OpenRouterSlug } from "./types";
import { DEEPSEEK_SLUG } from "./openrouter_slugs";

export type ModelCatalogEntry = {
  id: ModelId;
  label: string;
  slug: OpenRouterSlug;
  cheap?: boolean;
};

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: "qwen-2.5-72b", label: "Qwen 2.5 72B", slug: "qwen/qwen-2.5-72b-instruct" as OpenRouterSlug, cheap: true },
  { id: "deepseek-v3", label: "DeepSeek V3", slug: DEEPSEEK_SLUG as OpenRouterSlug, cheap: true },
  { id: "glm-5.2", label: "GLM 5.2", slug: "z-ai/glm-5.2" as OpenRouterSlug, cheap: true },
  { id: "gpt-5-mini", label: "GPT-5 mini", slug: "openai/gpt-4o-mini" as OpenRouterSlug },
  { id: "claude-opus-4.6", label: "Claude Opus 4.6", slug: "anthropic/claude-opus-4.1" as OpenRouterSlug },
  { id: "sonnet-4.7", label: "Claude Sonnet 4.7", slug: "anthropic/claude-sonnet-4.5" as OpenRouterSlug },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", slug: "google/gemini-3-flash-preview" as OpenRouterSlug },
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
  const id = resolveModelId(modelId);
  return MODEL_CATALOG.find((m) => m.id === id) ?? MODEL_CATALOG[1]!;
}

function catalogHasModel(modelId: ModelId): boolean {
  const resolved = LEGACY_MODEL_IDS[modelId] ?? modelId;
  return MODEL_CATALOG.some((m) => m.id === resolved);
}

export { catalogHasModel };

export function catalogLabel(modelId: ModelId | undefined): string {
  return catalogEntry(modelId).label;
}

export class UnknownModelError extends Error {
  constructor(readonly model: string) {
    super(`Unknown model: ${model}`);
    this.name = "UnknownModelError";
  }
}

// AI : reject client-supplied model ids that are not in the catalog — never trust picker JSON for billing.
export function parseRequestModel(model: ModelId | undefined, fallback: ModelId): ModelId {
  if (model == null || model === "") return fallback;
  if (!catalogHasModel(model)) throw new UnknownModelError(model);
  return resolveModelId(model);
}

// AI : optional run-level model — undefined keeps the project/pipeline default.
export function parseOptionalRequestModel(model: ModelId | undefined): ModelId | undefined {
  if (model == null || model === "") return undefined;
  if (!catalogHasModel(model)) throw new UnknownModelError(model);
  return resolveModelId(model);
}

// AI : strip unknown module.model values persisted via PUT /api/projects — server resolves slugs from catalog only.
export function sanitizeModuleModels<T extends { model?: ModelId }>(modules: T[]): T[] {
  return modules.map((m) => {
    if (m.model == null || m.model === "") return m;
    if (!catalogHasModel(m.model)) {
      const { model: _drop, ...rest } = m;
      return rest as T;
    }
    const resolved = resolveModelId(m.model);
    return resolved === m.model ? m : { ...m, model: resolved };
  });
}

export function slugFor(modelId: ModelId | undefined): OpenRouterSlug {
  return catalogEntry(modelId).slug;
}
