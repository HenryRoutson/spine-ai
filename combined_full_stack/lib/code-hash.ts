// AI : hash user code ignoring whitespace — shared by custom code + LLM provider error history.
import { sha256Hex } from "@/lib/run-fingerprint";

export function normalizeCodeForHash(code: string): string {
  return code.replace(/\s+/g, " ").trim();
}

export function hashCodeNormalized(code: string): string {
  return sha256Hex(normalizeCodeForHash(code));
}
