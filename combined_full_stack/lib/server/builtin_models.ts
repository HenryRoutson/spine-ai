import { FieldType } from "./types";
import type { StructureModel, StructureModelId } from "./types";

export const BUILTIN_DOCUMENT_ID = "m_builtin_document" as StructureModelId;

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
      example: "# Expense policy\n\n| Category | Limit |\n| --- | --- |\n| Meals | $75 |",
    },
    {
      id: "f_filename",
      name: "filename",
      type: FieldType.Text,
      optional: false,
      description: "Original upload filename",
      example: "expense_policy_2024.txt",
    },
  ],
};

export const SHARED_STRUCTURE_MODELS: StructureModel[] = [BUILTIN_DOCUMENT_MODEL];

export function isSharedStructureModel(m: StructureModel): boolean {
  return m.shared === true || m.id === BUILTIN_DOCUMENT_ID || m.name === "Document";
}

export function isLockedStructureModel(m: StructureModel): boolean {
  return m.locked === true || isSharedStructureModel(m);
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
