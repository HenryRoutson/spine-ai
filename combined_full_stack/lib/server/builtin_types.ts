import { BUILTIN_QUOTE_SPAN_ID } from "./builtin_models";
import type { TypeAlias, TypeAliasId } from "./types";

export const BUILTIN_QUOTE_STRING_ALIAS_ID = "ta_builtin_quote_string" as TypeAliasId;
export const BUILTIN_QUOTE_SPAN_ALIAS_ID = "ta_builtin_quote_span" as TypeAliasId;
export const BUILTIN_TEXT_QUOTE_ALIAS_ID = "ta_builtin_text_quote" as TypeAliasId;

// AI : platform quote types — LLM wire string vs linked span struct; injected like Document, not user-editable.
// AI : quote_string_t = TEXT the LLM emits; quote_span_t = resolved FK+offsets;
// AI :   text_quote_t = (text, doc_id, start, end). Link Quotes is UPDATE/INSERT that attaches the FK.
export const BUILTIN_TYPE_ALIASES: TypeAlias[] = [
  {
    id: BUILTIN_QUOTE_STRING_ALIAS_ID,
    name: "quote_string_t",
    description:
      "Verbatim source quote string — what the LLM returns before Link Quotes attaches byte offsets.",
    expr: { kind: "quote" },
    shared: true,
    locked: true,
  },
  {
    id: BUILTIN_QUOTE_SPAN_ALIAS_ID,
    name: "quote_span_t",
    description: "Linked quote span (QuoteSpan) — doc_id + start/end after Link Quotes runs.",
    expr: { kind: "ref", modelId: BUILTIN_QUOTE_SPAN_ID },
    shared: true,
    locked: true,
  },
  {
    id: BUILTIN_TEXT_QUOTE_ALIAS_ID,
    name: "text_quote_t",
    description: "Text paired with a quote string — becomes { text, quote: QuoteSpan } after linking.",
    expr: { kind: "text_quote" },
    shared: true,
    locked: true,
  },
];

const BUILTIN_TYPE_ALIAS_IDS = new Set(BUILTIN_TYPE_ALIASES.map((a) => a.id));
const BUILTIN_TYPE_ALIAS_NAMES = new Set(BUILTIN_TYPE_ALIASES.map((a) => a.name.trim().toLowerCase()));

export function isSharedTypeAlias(alias: TypeAlias): boolean {
  return (
    alias.shared === true ||
    BUILTIN_TYPE_ALIAS_IDS.has(alias.id) ||
    BUILTIN_TYPE_ALIAS_NAMES.has(alias.name.trim().toLowerCase())
  );
}

export function isLockedTypeAlias(alias: TypeAlias): boolean {
  return alias.locked === true || isSharedTypeAlias(alias);
}

export function lockedTypeAliasWhy(alias: TypeAlias): string | null {
  if (!isLockedTypeAlias(alias)) return null;
  return "it is a shared built-in type available in every project";
}

// AI : banner + click feedback share the same wording (spec: clear lock error with why).
export function lockedTypeAliasBanner(alias: TypeAlias): string | null {
  const why = lockedTypeAliasWhy(alias);
  if (!why) return null;
  return `This type is locked — ${why}`;
}

export function isBuiltinTypeAliasName(name: string): boolean {
  return BUILTIN_TYPE_ALIAS_NAMES.has(name.trim().toLowerCase());
}

export function stripBuiltinTypeAliases(aliases: TypeAlias[]): TypeAlias[] {
  return aliases.filter((a) => !isSharedTypeAlias(a));
}

export function withBuiltinTypeAliases(aliases: TypeAlias[] = []): TypeAlias[] {
  const user = stripBuiltinTypeAliases(aliases);
  return [...BUILTIN_TYPE_ALIASES, ...user];
}
