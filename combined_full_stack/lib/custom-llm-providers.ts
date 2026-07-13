"use client"

// AI : user-defined LLM providers — persisted in localStorage; code shown in model selector + exports.
import { useCallback, useEffect, useState } from "react";
import type { CodeViewerLanguage } from "@/components/code-viewer";
import { customProviderTemplate } from "@/lib/llm-provider-samples";

export type CustomLlmProviderExportCode = Partial<Record<CodeViewerLanguage, string>>;

export type CustomLlmProviderDef = {
  id: string;
  label: string;
  /** TypeScript only — executed in Spine (JS runtime). */
  code: string;
  /** Optional snippets for non-TS pipeline exports. */
  exportCode?: CustomLlmProviderExportCode;
  createdAt: number;
};

const STORAGE_KEY = "forge:custom-llm-providers";

function readAll(): CustomLlmProviderDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as (CustomLlmProviderDef & { language?: CodeViewerLanguage })[];
    return Array.isArray(parsed)
      ? parsed
          .filter((p) => p.id && p.code)
          .map(({ language: _legacy, ...p }) => p)
      : [];
  } catch {
    return [];
  }
}

function writeAll(providers: CustomLlmProviderDef[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
}

export function listCustomLlmProviders(): CustomLlmProviderDef[] {
  return readAll();
}

export function getCustomLlmProvider(id: string): CustomLlmProviderDef | undefined {
  return readAll().find((p) => p.id === id);
}

export function upsertCustomLlmProvider(def: CustomLlmProviderDef): void {
  const all = readAll().filter((p) => p.id !== def.id);
  all.push(def);
  writeAll(all);
  window.dispatchEvent(new CustomEvent("forge:custom-llm-providers"));
}

export function removeCustomLlmProvider(id: string): void {
  writeAll(readAll().filter((p) => p.id !== id));
  window.dispatchEvent(new CustomEvent("forge:custom-llm-providers"));
}

export function defaultCustomProviderDraft(id = "custom_provider"): CustomLlmProviderDef {
  return {
    id,
    label: id.replace(/_/g, " "),
    code: customProviderTemplate("typescript", id),
    createdAt: Date.now(),
  };
}

export function customProviderExportSnippet(
  def: CustomLlmProviderDef,
  language: CodeViewerLanguage,
): string {
  if (language === "typescript") return def.code;
  const stored = def.exportCode?.[language]?.trim();
  if (stored) return stored;
  return customProviderTemplate(language, def.id);
}

export function useCustomLlmProviders(): CustomLlmProviderDef[] {
  const [providers, setProviders] = useState<CustomLlmProviderDef[]>([]);
  const refresh = useCallback(() => setProviders(readAll()), []);
  useEffect(() => {
    refresh();
    window.addEventListener("forge:custom-llm-providers", refresh);
    return () => window.removeEventListener("forge:custom-llm-providers", refresh);
  }, [refresh]);
  return providers;
}
