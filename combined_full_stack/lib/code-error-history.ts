// AI : errors keyed by normalized code hash — same code (ignoring whitespace) shares history.
import { hashCodeNormalized } from "@/lib/code-hash";

export const CODE_ERROR_NS = {
  customCode: "custom-code",
  llmProvider: "llm-provider",
} as const;

export type CodeErrorNamespace = (typeof CODE_ERROR_NS)[keyof typeof CODE_ERROR_NS];

export type CodeErrorEntry = {
  at: number;
  message: string;
};

type CodeErrorBucket = {
  hash: string;
  errors: CodeErrorEntry[];
};

const STORAGE_KEY = "forge:code-error-history";
const MAX_ERRORS_PER_HASH = 40;

function readStore(): Record<string, CodeErrorBucket> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CodeErrorBucket>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, CodeErrorBucket>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function recordCodeError(code: string, message: string, namespace: string): void {
  const hash = hashCodeNormalized(code);
  const key = `${namespace}:${hash}`;
  const store = readStore();
  const bucket = store[key] ?? { hash, errors: [] };
  const last = bucket.errors[bucket.errors.length - 1];
  if (last?.message === message) return;
  bucket.errors.push({ at: Date.now(), message });
  if (bucket.errors.length > MAX_ERRORS_PER_HASH) {
    bucket.errors = bucket.errors.slice(-MAX_ERRORS_PER_HASH);
  }
  store[key] = bucket;
  writeStore(store);
  window.dispatchEvent(new CustomEvent("forge:code-error-history"));
}

export function errorsForCode(code: string, namespace: string): readonly CodeErrorEntry[] {
  const hash = hashCodeNormalized(code);
  const key = `${namespace}:${hash}`;
  return readStore()[key]?.errors ?? [];
}

export function codeHashLabel(code: string): string {
  return hashCodeNormalized(code).slice(0, 12);
}
