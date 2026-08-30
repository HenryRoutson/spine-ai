// AI : deterministic seed LLM replies — shared by server provider + OpenAI-compatible mock HTTP.
// AI : Schema-aware fill from prompt context so UI (schema-first) and exports (schema-last) match.
import { seedHarnessWriteTools } from "../vibe-coding-examples";
import { isSpineJsAuthoringPrompt } from "@/lib/spine-js/compile";
import { payloadToWorkflow } from "@/lib/spine-js/payload-to-workflow";

export type JsonSchemaNode = {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode | JsonSchemaNode[];
  required?: string[];
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  enum?: unknown[];
  description?: string;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

function asTypeList(type: string | string[] | undefined): string[] {
  if (!type) return [];
  return Array.isArray(type) ? type : [type];
}

function primaryType(schema: JsonSchemaNode): string | undefined {
  const types = asTypeList(schema.type).filter((t) => t !== "null");
  return types[0];
}

// AI : pull the JSON Schema block that structured prompts embed (UI or export wording).
export function extractJsonSchemaFromPrompt(prompt: string): JsonSchemaNode | null {
  const marker = /Respond with ONLY a JSON value that validates against this JSON Schema:\s*/i;
  const m = prompt.match(marker);
  if (!m || m.index == null) return null;
  const after = prompt.slice(m.index + m[0].length).trimStart();
  return parseBalancedJson(after) as JsonSchemaNode | null;
}

// AI : prefer INPUT DATA / ITEM payloads; else last JSON object/array in the prompt (batch item, example).
export function extractContextFromPrompt(prompt: string): JsonValue | null {
  for (const marker of [/INPUT DATA:\s*/i, /ITEM:\s*/i, /EXAMPLE:\s*/i]) {
    const m = prompt.match(marker);
    if (m && m.index != null) {
      const after = prompt.slice(m.index + m[0].length).trimStart();
      const parsed = parseBalancedJson(after);
      if (parsed != null) return parsed;
    }
  }
  return findLastJsonValue(prompt);
}

function parseBalancedJson(text: string): JsonValue | null {
  const start = text.search(/[{[]/);
  if (start < 0) return null;
  return parseBalancedJsonSimple(text, start);
}

function parseBalancedJsonSimple(text: string, start: number): JsonValue | null {
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escape) escape = false;
      else if (ch === "\\") escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") depth++;
    else if (ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as JsonValue;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function findLastJsonValue(prompt: string): JsonValue | null {
  let last: JsonValue | null = null;
  for (let i = 0; i < prompt.length; i++) {
    if (prompt[i] === "{" || prompt[i] === "[") {
      const parsed = parseBalancedJsonSimple(prompt, i);
      if (parsed != null) last = parsed;
    }
  }
  return last;
}

function contextRecord(context: JsonValue | null): Record<string, JsonValue> {
  if (context && typeof context === "object" && !Array.isArray(context)) {
    return context as Record<string, JsonValue>;
  }
  return {};
}

function contextText(context: JsonValue | null): string {
  if (typeof context === "string") return context;
  const rec = contextRecord(context);
  for (const key of ["text", "content", "body", "description", "summary", "title"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  if (context == null) return "";
  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

function isSummaryish(name: string): boolean {
  return /^(summary|body|reason|explanation|chain_of_thought|analysis|description|note|comment)$/i.test(
    name,
  );
}

function fillSchema(schema: JsonSchemaNode, context: JsonValue | null, fieldName = ""): JsonValue {
  if (schema.enum?.length) return schema.enum[0] as JsonValue;

  const variants = schema.anyOf ?? schema.oneOf;
  if (variants?.length) return fillSchema(variants[0]!, context, fieldName);

  const t = primaryType(schema);
  const rec = contextRecord(context);

  if (t === "object" || schema.properties) {
    const props = schema.properties ?? {};
    const out: Record<string, JsonValue> = {};
    for (const [key, prop] of Object.entries(props)) {
      if (key in rec) out[key] = rec[key]!;
      else out[key] = fillSchema(prop, context, key);
    }
    return out;
  }

  if (t === "array") {
    const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
    if (Array.isArray(context) && items) {
      return context.map((row) => fillSchema(items, row, fieldName));
    }
    if (items) return [fillSchema(items, context, fieldName)];
    return [];
  }

  if (t === "boolean") {
    // AI : example-select relevance — include candidates so pipelines stay complete under seed LLM.
    if (/relevant|include|match|pass|ok|success/i.test(fieldName)) return true;
    return false;
  }

  if (t === "integer" || t === "number") {
    const v = rec[fieldName];
    if (typeof v === "number") return v;
    return 0;
  }

  if (t === "string" || !t) {
    const v = rec[fieldName];
    if (typeof v === "string") return v;
    if (isSummaryish(fieldName)) {
      const src = contextText(context);
      return src ? `Summary of: ${src}` : "seed";
    }
    if (fieldName === "id" && typeof rec.id === "string") return rec.id;
    if (fieldName === "id" && typeof rec.id === "number") return String(rec.id);
    return fieldName ? `seed:${fieldName}` : "seed";
  }

  if (t === "null") return null;
  return null;
}

function schemaIsEmpty(schema: JsonSchemaNode | null): boolean {
  if (!schema) return true;
  if (schema.properties && Object.keys(schema.properties).length) return false;
  if (schema.items) return false;
  if (schema.anyOf?.length || schema.oneOf?.length) return false;
  if (schema.type && schema.type !== "object") return false;
  return true;
}

/** When export stubs emit `schema = {}`, invent a useful object from ITEM/INPUT context. */
function fillFromContextOnly(context: JsonValue | null): JsonValue {
  if (context && typeof context === "object" && !Array.isArray(context)) {
    const rec = context as Record<string, JsonValue>;
    const out: Record<string, JsonValue> = {};
    if (rec.id !== undefined) out.id = rec.id;
    const text =
      typeof rec.text === "string"
        ? rec.text
        : typeof rec.content === "string"
          ? rec.content
          : typeof rec.body === "string"
            ? rec.body
            : contextText(context);
    if (text) out.summary = `Summary of: ${text}`;
    else if (typeof rec.summary === "string") out.summary = rec.summary;
    // AI : relevance-style prompts without schema — keep boolean fields stable.
    if (typeof rec.is_relevant === "boolean") out.is_relevant = rec.is_relevant;
    if (Object.keys(out).length) return out;
    return { summary: text ? `Summary of: ${text}` : "seed" };
  }
  if (Array.isArray(context)) return context.map((row) => fillFromContextOnly(row));
  if (typeof context === "string") return { summary: `Summary of: ${context}` };
  return {};
}

function extractUserRequest(prompt: string): string {
  const task = prompt.match(/Turn \d+\/\d+\s*\nTask:\s*([^\n]+)/);
  if (task?.[1]?.trim()) return task[1].trim();
  const marker = "User request:";
  const idx = prompt.lastIndexOf(marker);
  if (idx < 0) return prompt;
  return prompt.slice(idx + marker.length).trim();
}

// AI : "named Hello Notes that greets…" → Hello Notes (stop before that/which/to/for).
export function seedNamedFunctionFromPrompt(userRequest: string): string | null {
  const m = userRequest.match(
    /\b(?:second|another|new)?\s*function\s+(?:named|called)\s+(.+?)(?:\s+(?:that|which|to|for)\b|[.,]|$)/i,
  );
  const raw = m?.[1]?.trim();
  if (!raw) return null;
  return raw.replace(/^["']|["']$/g, "").replace(/[."']+$/g, "").trim().slice(0, 80) || null;
}

function notesSummarizerModules(title: string) {
  return [
    {
      kind: "input",
      label: `${title} notes`,
      note: "Paste notes as text.",
      structureOut: "list[Document]",
      inputType: "text",
      inputDescription: "notes",
    },
    {
      kind: "llm-batch",
      label: `Summarize ${title}`,
      note: "One summary per note.",
      structureIn: "Document",
      structureOut: "NoteSummary",
      prompt: "Write a short summary of the note.",
      inputDescription: "notes",
    },
    {
      kind: "output",
      label: `${title} out`,
      structureIn: "NoteSummary",
      structureOut: "NoteSummary",
      inputDescription: "summaries",
    },
  ];
}

function seedNotesModel() {
  return {
    name: "NoteSummary",
    description: "A short summary of one note.",
    fields: [{ name: "summary", type: "text", optional: false, description: "Summary" }],
  };
}

function seedNotesProposalPayload(title: string, named: string | null, unnamed: boolean) {
  return {
    message: named
      ? `I'll add a ${named} function that summarizes notes, and keep the existing one.`
      : "I'll add a notes summarizer pipeline.",
    modules: notesSummarizerModules(title),
    modulePatch: null,
    models: [seedNotesModel()],
    typeAliases: null,
    docs: [
      { name: "sample_note.txt", type: "text", content: "Buy milk. Call Alex about Friday." },
      { name: "sample_note_2.txt", type: "text", content: "Ship the deck. Review the hiring plan." },
    ],
    documentationUpdate: `# ${title}\n\nSummarizes pasted notes.`,
    projectNameUpdate: !named && unnamed ? "Notes" : null,
    targetFunctionName: named,
    proposedActions: null,
  };
}

function isProjectAssistantSchemaPrompt(prompt: string): boolean {
  return prompt.includes('"targetFunctionName"') && prompt.includes('"modulePatch"') && prompt.includes('"proposedActions"');
}

// AI : offline Vibe — a generic notes pipeline so tests do not need OpenRouter.
// AI : Do NOT look up few-shot Example 1–5 by task text. That pastes the answer key
// AI : into the A/B (reward hacking): seed then scores 100% without generating anything.
function seedProjectAssistantReply(prompt: string): string | null {
  if (!isProjectAssistantSchemaPrompt(prompt)) return null;
  const userRequest = extractUserRequest(prompt);
  const named = seedNamedFunctionFromPrompt(userRequest);
  const unnamed = /\bUntitled Pipeline\b/.test(prompt);
  return JSON.stringify(seedNotesProposalPayload(named || "Notes", named, unnamed));
}

function seedObservePlanReply(prompt: string): string | null {
  if (!/Plan READ-ONLY observe tool calls/i.test(prompt)) return null;
  return JSON.stringify({ tools: [], reason: "seed" });
}

// AI : generic fillSchema picks enum[0] (list_dir) — that is why harness-first scored 0. Write files instead.
function isVibeHarnessSchemaPrompt(prompt: string): boolean {
  return (
    prompt.includes('"write_file"') &&
    prompt.includes('"run_tests"') &&
    prompt.includes('"list_dir"') &&
    prompt.includes('"done"')
  );
}

function seedVibeHarnessReply(prompt: string): string | null {
  if (!isVibeHarnessSchemaPrompt(prompt)) return null;
  const userRequest = extractUserRequest(prompt);
  const named = seedNamedFunctionFromPrompt(userRequest);
  // AI : always the notes stub — never the matching few-shot payload (reward hacking).
  const payload = seedNotesProposalPayload(named || "Notes", named, /\bUntitled Pipeline\b/.test(prompt));
  const wrotePipeline =
    /wrote pipeline\.json/i.test(prompt) || /wrote pipeline\.js/i.test(prompt) || /wrote pipeline\.ts/i.test(prompt);
  const ranTests = /\$ run_tests\b/i.test(prompt);
  const passed = /^PASS\b/m.test(prompt);
  if (wrotePipeline && (passed || ranTests)) {
    return JSON.stringify({ tools: [{ tool: "done", message: payload.message }] });
  }
  if (wrotePipeline) {
    return JSON.stringify({ tools: [{ tool: "run_tests" }] });
  }
  return JSON.stringify({
    tools: seedHarnessWriteTools(payload),
    note: "seed writes the notes pipeline",
  });
}

function seedSpineJsReply(prompt: string): string | null {
  if (!isSpineJsAuthoringPrompt(prompt)) return null;
  const userRequest = extractUserRequest(prompt);
  const named = seedNamedFunctionFromPrompt(userRequest);
  // AI : same notes stub as JSON/harness — do not compile the few-shot answer key.
  const payload = seedNotesProposalPayload(named || "Notes", named, /\bUntitled Pipeline\b/.test(prompt));
  return payloadToWorkflow(payload);
}

/** Deterministic chat completion body for a single prompt. */
export function seedLlmReply(prompt: string, jsonMode = true): string {
  // AI : harness / workflow prompts include project-context field names; do not fill the JSON assistant schema instead.
  const observe = seedObservePlanReply(prompt);
  if (observe) return observe;
  const harness = seedVibeHarnessReply(prompt);
  if (harness) return harness;
  const js = seedSpineJsReply(prompt);
  if (js) return js;
  const assistant = seedProjectAssistantReply(prompt);
  if (assistant) return assistant;
  const schema = extractJsonSchemaFromPrompt(prompt);
  const context = extractContextFromPrompt(prompt);
  if (schema && !schemaIsEmpty(schema)) {
    return JSON.stringify(fillSchema(schema, context));
  }
  if (jsonMode) {
    return JSON.stringify(fillFromContextOnly(context));
  }
  const src = contextText(context);
  return src ? `Summary of: ${src}` : "seed";
}

/** OpenAI-compatible chat.completions payload. */
export function seedOpenAiChatCompletion(body: {
  messages?: { role?: string; content?: unknown }[];
  response_format?: { type?: string };
}): { id: string; choices: { message: { role: "assistant"; content: string } }[]; usage: object } {
  const parts: string[] = [];
  for (const msg of body.messages ?? []) {
    const c = msg.content;
    if (typeof c === "string") parts.push(c);
    else if (Array.isArray(c)) {
      for (const block of c) {
        if (block && typeof block === "object" && "text" in block && typeof (block as { text: unknown }).text === "string") {
          parts.push((block as { text: string }).text);
        }
      }
    }
  }
  const prompt = parts.join("\n\n");
  const jsonMode = body.response_format?.type === "json_object" || /JSON Schema/i.test(prompt);
  const content = seedLlmReply(prompt, jsonMode);
  return {
    id: "seed-chatcmpl",
    choices: [{ message: { role: "assistant", content } }],
    usage: { prompt_tokens: Math.ceil(prompt.length / 4), completion_tokens: Math.ceil(content.length / 4) },
  };
}
