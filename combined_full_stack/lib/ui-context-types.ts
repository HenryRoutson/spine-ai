// AI : typed UI picks for the agent — click-to-context without copy-paste (client + server).

export type UiContextKind =
  | "pipeline_step"
  | "inspector_field"
  | "invalid_issue"
  | "run_error"
  | "generic"
  // AI : @-mention catalog kinds (keyboard pins; same chip/request path as Select UI).
  | "project_doc"
  | "model"
  | "type_alias"
  // AI : prompt-cache prefix stats (design-time example-select or runtime step prompts).
  | "prompt_cache"
  // AI : highlight agent chat text → quote chip (no copy-paste).
  | "chat_quote"

export type UiContextRef = {
  id: string
  kind: UiContextKind
  label: string
  moduleId?: string
  fieldPath?: string
  snippet?: string
}

export const MAX_UI_CONTEXT_ITEMS = 8
export const MAX_UI_CONTEXT_LABEL_CHARS = 200
export const MAX_UI_CONTEXT_SNIPPET_CHARS = 2_000
export const MAX_UI_CONTEXT_FIELD_PATH_CHARS = 200

export const UI_CONTEXT_KINDS = [
  "pipeline_step",
  "inspector_field",
  "invalid_issue",
  "run_error",
  "generic",
  "project_doc",
  "model",
  "type_alias",
  "prompt_cache",
  "chat_quote",
] as const satisfies readonly UiContextKind[]

// AI : stable id so re-quoting the same span dedupes in the chip row.
function chatQuoteHash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/** AI : pin from a chat message selection (Vibe / Agent). */
export function uiContextRefFromChatQuote(selected: string): UiContextRef | null {
  const snippet = truncateUiContextText(selected.replace(/\r\n/g, "\n"), MAX_UI_CONTEXT_SNIPPET_CHARS)
  if (!snippet) return null
  const preview = truncateUiContextText(snippet.replace(/\s+/g, " "), 48)
  return {
    id: `chat-quote:${chatQuoteHash(snippet)}`,
    kind: "chat_quote",
    label: `Quote · ${preview}`,
    snippet,
  }
}

export function truncateUiContextText(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1))}…`
}

export function normalizeUiContextRef(raw: UiContextRef): UiContextRef {
  return {
    id: truncateUiContextText(raw.id, 120),
    kind: raw.kind,
    label: truncateUiContextText(raw.label, MAX_UI_CONTEXT_LABEL_CHARS) || raw.kind,
    moduleId: raw.moduleId
      ? truncateUiContextText(raw.moduleId, 120)
      : undefined,
    fieldPath: raw.fieldPath
      ? truncateUiContextText(raw.fieldPath, MAX_UI_CONTEXT_FIELD_PATH_CHARS)
      : undefined,
    snippet: raw.snippet
      ? truncateUiContextText(raw.snippet, MAX_UI_CONTEXT_SNIPPET_CHARS)
      : undefined,
  }
}

export function dedupeUiContextRefs(refs: UiContextRef[]): UiContextRef[] {
  const seen = new Set<string>()
  const out: UiContextRef[] = []
  for (const raw of refs) {
    const ref = normalizeUiContextRef(raw)
    if (!ref.id || seen.has(ref.id)) continue
    seen.add(ref.id)
    out.push(ref)
    if (out.length >= MAX_UI_CONTEXT_ITEMS) break
  }
  return out
}

/** AI : prompt block injected above the user request when chips are pinned. */
export function buildUiContextPromptBlock(refs: UiContextRef[] | undefined): string {
  const items = dedupeUiContextRefs(refs ?? [])
  if (items.length === 0) return ""
  const lines = items.map((r, i) => {
    const meta = [
      `kind=${r.kind}`,
      r.moduleId ? `moduleId=${r.moduleId}` : null,
      r.fieldPath ? `fieldPath=${r.fieldPath}` : null,
    ]
      .filter(Boolean)
      .join(", ")
    const snip = r.snippet?.trim()
      ? `\n  snippet:\n${r.snippet.trim().split("\n").map((l) => `    ${l}`).join("\n")}`
      : ""
    return `${i + 1}. ${r.label} (${meta})${snip}`
  })
  // AI : TODO (assistant-@-mention) — distinguish click-select vs @-mention wording in the prompt header.
  return `Selected UI / @-mention / chat-quote context (user pinned these — treat as primary focus):\n${lines.join("\n")}\n\n`
}

export function defaultMessageForUiContextOnly(refs: UiContextRef[]): string {
  if (refs.length === 0) return ""
  if (refs.length === 1) return `Please look at this selected context: ${refs[0]!.label}`
  return `Please look at these ${refs.length} selected context items.`
}
