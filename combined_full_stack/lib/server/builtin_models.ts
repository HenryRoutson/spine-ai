import { FieldType } from "./types";
import type { StructureModel, StructureModelId } from "./types";

export const BUILTIN_DOCUMENT_ID = "m_builtin_document" as StructureModelId;
export const BUILTIN_QUOTE_SPAN_ID = "m_builtin_quote_span" as StructureModelId;
export const BUILTIN_CHATBOT_PROMPT_ID = "m_builtin_chatbot_prompt" as StructureModelId;
export const BUILTIN_CHATBOT_TURN_ID = "m_builtin_chatbot_turn" as StructureModelId;
export const BUILTIN_CHATBOT_RESULT_ID = "m_builtin_chatbot_result" as StructureModelId;

// AI : shared across every project — the canonical shape for field type `document`.
export const BUILTIN_DOCUMENT_MODEL: StructureModel = {
  id: BUILTIN_DOCUMENT_ID,
  name: "Document",
  description: "Uploaded file text and its original filename.",
  shared: true,
  locked: true,
  fields: [
    {
      id: "f_content",
      name: "content",
      type: FieldType.Text,
      optional: false,
      description: "Full extracted text of the file",
      examples: ["# Expense policy\n\n| Category | Limit |\n| --- | --- |\n| Meals | $75 |"],
    },
    {
      id: "f_filename",
      name: "filename",
      type: FieldType.Text,
      optional: false,
      description: "Original upload filename",
      examples: ["expense_policy_2024.txt"],
    },
  ],
};

// AI : linked quote span — doc hash + byte range after Link Quotes resolves a quote_string_t.
export const BUILTIN_QUOTE_SPAN_MODEL: StructureModel = {
  id: BUILTIN_QUOTE_SPAN_ID,
  name: "QuoteSpan",
  description: "Source-linked span — document hash plus byte offsets (post Link Quotes).",
  shared: true,
  locked: true,
  fields: [
    {
      id: "f_doc_id",
      name: "doc_id",
      type: FieldType.Text,
      optional: false,
      description: "Source document content hash",
    },
    {
      id: "f_start",
      name: "start",
      type: FieldType.Int,
      optional: false,
      description: "Start byte offset in the source document",
    },
    {
      id: "f_end",
      name: "end",
      type: FieldType.Int,
      optional: false,
      description: "End byte offset in the source document",
    },
  ],
};

// AI : spine input for Chatbot step — operator-facing prompt produced upstream (not module.prompt).
export const BUILTIN_CHATBOT_PROMPT_MODEL: StructureModel = {
  id: BUILTIN_CHATBOT_PROMPT_ID,
  name: "ChatbotPrompt",
  description: "Prompted chat session input — the prompt the operator sees / that drives the bot.",
  shared: true,
  locked: true,
  fields: [
    {
      id: "f_chatbot_prompt",
      name: "prompt",
      type: FieldType.Text,
      optional: false,
      description: "System / session prompt for the chatbot (shown and used in Inference)",
      examples: ["Ask the user clarifying questions about the extracted invoice fields."],
    },
  ],
};

// AI : one transcript row — role + content.
export const BUILTIN_CHATBOT_TURN_MODEL: StructureModel = {
  id: BUILTIN_CHATBOT_TURN_ID,
  name: "ChatbotTurn",
  description: "One chatbot transcript turn (role + content).",
  shared: true,
  locked: true,
  fields: [
    {
      id: "f_chatbot_role",
      name: "role",
      type: FieldType.Text,
      optional: false,
      description: "user | assistant | system",
      examples: ["user", "assistant"],
    },
    {
      id: "f_chatbot_content",
      name: "content",
      type: FieldType.Text,
      optional: false,
      description: "Message text for this turn",
    },
  ],
};

// AI : spine output for Chatbot step after Exit / single-complete.
export const BUILTIN_CHATBOT_RESULT_MODEL: StructureModel = {
  id: BUILTIN_CHATBOT_RESULT_ID,
  name: "ChatbotResult",
  description: "Completed chatbot session — prompt, transcript, and why it ended.",
  shared: true,
  locked: true,
  fields: [
    {
      id: "f_chatbot_result_prompt",
      name: "prompt",
      type: FieldType.Text,
      optional: false,
      description: "Session prompt from ChatbotPrompt input",
    },
    {
      id: "f_chatbot_transcript",
      name: "transcript",
      type: FieldType.ListModel,
      optional: false,
      ref: BUILTIN_CHATBOT_TURN_ID,
      description: "Ordered chat turns",
    },
    {
      id: "f_chatbot_exit_reason",
      name: "exit_reason",
      type: FieldType.Text,
      optional: false,
      description: "exit | single | max-turns",
      examples: ["exit", "single", "max-turns"],
    },
  ],
};

export const SHARED_STRUCTURE_MODELS: StructureModel[] = [
  BUILTIN_DOCUMENT_MODEL,
  BUILTIN_QUOTE_SPAN_MODEL,
  BUILTIN_CHATBOT_PROMPT_MODEL,
  BUILTIN_CHATBOT_TURN_MODEL,
  BUILTIN_CHATBOT_RESULT_MODEL,
];

export function isSharedStructureModel(m: StructureModel): boolean {
  return (
    m.shared === true ||
    m.id === BUILTIN_DOCUMENT_ID ||
    m.id === BUILTIN_QUOTE_SPAN_ID ||
    m.id === BUILTIN_CHATBOT_PROMPT_ID ||
    m.id === BUILTIN_CHATBOT_TURN_ID ||
    m.id === BUILTIN_CHATBOT_RESULT_ID ||
    m.name === "Document" ||
    m.name === "QuoteSpan" ||
    m.name === "ChatbotPrompt" ||
    m.name === "ChatbotTurn" ||
    m.name === "ChatbotResult"
  );
}

// AI : auto-generated structs (combine output, doc infer) are read-only per spec.
export function isLockedStructureModel(m: StructureModel): boolean {
  return m.locked === true || m.auto === true || isSharedStructureModel(m);
}

export function lockedStructureWhy(m: StructureModel): string | null {
  if (!isLockedStructureModel(m)) return null;
  if (isSharedStructureModel(m)) {
    return "it is a shared built-in structure available in every project";
  }
  if (m.sourceDocId) {
    return "it was auto-generated from a document — re-upload the source to refresh fields";
  }
  if (m.auto) {
    return "it was auto-generated by a Combine Inputs or Assemble step — edit the pipeline step instead";
  }
  return "it is marked locked and cannot be edited";
}

// AI : banner + click feedback share the same wording (spec: clear lock error with why).
export function lockedStructureBanner(m: StructureModel): string | null {
  const why = lockedStructureWhy(m);
  if (!why) return null;
  return `This structure is locked — ${why}`;
}

export function isBuiltinDocumentModel(m: StructureModel | undefined): boolean {
  return m?.id === BUILTIN_DOCUMENT_ID || m?.name === "Document";
}

export function stripSharedModels(models: StructureModel[]): StructureModel[] {
  return models.filter((m) => !isSharedStructureModel(m));
}

export function withSharedModels(models: StructureModel[]): StructureModel[] {
  const user = stripSharedModels(models);
  return [...SHARED_STRUCTURE_MODELS, ...user];
}
