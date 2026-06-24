import type { CustomCodeEntry, CustomCodeLanguage, PipelineModule } from "@/lib/types";
export type ParsedCustomCodeEntry = { language: CustomCodeLanguage; code: string };

// AI : legacy shape from first fallback iteration — still parsed on load.
type LegacyCustomCodeEntry = { language: CustomCodeLanguage; code: string };

function isLegacyEntry(raw: unknown): raw is LegacyCustomCodeEntry {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "language" in raw &&
    "code" in raw &&
    typeof (raw as LegacyCustomCodeEntry).code === "string"
  );
}

export function parseCustomCodeEntry(raw: CustomCodeEntry | LegacyCustomCodeEntry): ParsedCustomCodeEntry | null {
  if (isLegacyEntry(raw)) {
    const code = raw.code.trim();
    if (!code) return null;
    return { language: raw.language, code };
  }
  if (raw.typescript?.trim()) return { language: "typescript", code: raw.typescript.trim() };
  if (raw.python?.trim()) return { language: "python", code: raw.python.trim() };
  return null;
}

export function makeCustomCodeEntry(language: CustomCodeLanguage, code: string): CustomCodeEntry {
  return language === "python" ? { python: code } : { typescript: code };
}

export function languageOfEntry(entry: CustomCodeEntry | LegacyCustomCodeEntry): CustomCodeLanguage {
  if (isLegacyEntry(entry)) return entry.language;
  if (entry.python !== undefined) return "python";
  return "typescript";
}

export function codeOfEntry(entry: CustomCodeEntry | LegacyCustomCodeEntry): string {
  if (isLegacyEntry(entry)) return entry.code;
  return entry.typescript ?? entry.python ?? "";
}

export function normalizeCustomCodeFallbackList(
  fallbackList: (CustomCodeEntry | LegacyCustomCodeEntry)[] | undefined,
): CustomCodeEntry[] {
  const out: CustomCodeEntry[] = [];
  for (const raw of fallbackList ?? []) {
    // AI : keep empty slots — editor adds blank fallbacks before the user types code.
    if (isLegacyEntry(raw)) {
      out.push(makeCustomCodeEntry(raw.language, raw.code));
      continue;
    }
    if (raw.python !== undefined) {
      out.push(makeCustomCodeEntry("python", raw.python));
      continue;
    }
    if (raw.typescript !== undefined) {
      out.push(makeCustomCodeEntry("typescript", raw.typescript));
    }
  }
  return out;
}

// AI : custom-code uses fallbackList only; transform keeps optional single `code` string.
// AI : legacy persisted modules may still carry top-level code / codeLanguage until migrated.
type LegacyCustomCodeModule = PipelineModule & { codeLanguage?: CustomCodeLanguage };

export function customCodeEntriesForModule(m: PipelineModule): ParsedCustomCodeEntry[] {
  const legacy = m as LegacyCustomCodeModule;
  if (m.kind === "custom-code") {
    const fromList = normalizeCustomCodeFallbackList(m.fallbackList).map(parseCustomCodeEntry).filter(
      (e): e is ParsedCustomCodeEntry => e !== null,
    );
    if (fromList.length) return fromList;
    if (legacy.code?.trim()) {
      return [{ language: legacy.codeLanguage ?? "typescript", code: legacy.code.trim() }];
    }
    return [];
  }
  if (m.code?.trim()) return [{ language: "typescript", code: m.code.trim() }];
  return [];
}

export function migrateCustomCodeModule(m: PipelineModule): PipelineModule {
  if (m.kind !== "custom-code") return m;
  const legacy = m as LegacyCustomCodeModule;
  const fallbackList = normalizeCustomCodeFallbackList(m.fallbackList);
  if (!fallbackList.length && legacy.code?.trim()) {
    fallbackList.push(makeCustomCodeEntry(legacy.codeLanguage ?? "typescript", legacy.code.trim()));
  }
  const { code: _c, ...rest } = legacy;
  delete (rest as LegacyCustomCodeModule).codeLanguage;
  return { ...rest, fallbackList: fallbackList.length ? fallbackList : undefined };
}
