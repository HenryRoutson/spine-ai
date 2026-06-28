import type { FieldType } from "@/lib/types"

// AI : plain-language labels for the structure excel editor
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  int: "Whole number",
  float: "Decimal number",
  bool: "Yes / No",
  datetime: "Date or time",
  document: "Document",
  "list[document]": "List of documents",
  json: "Flexible data",
  "list[text]": "List of text",
  "tuple[text,quote]": "Text with source quote",
  "list[tuple[text,quote]]": "List of quoted text",
  model: "Nested record",
  "list[model]": "List of records",
}

export const FIELD_TYPE_OPTIONS = (Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(
  ([value, label]) => ({ value, label }),
)

export function fieldTypeLabel(type: FieldType): string {
  return FIELD_TYPE_LABELS[type] ?? type
}

export function fieldTypeFromLabel(label: string): FieldType | undefined {
  const match = FIELD_TYPE_OPTIONS.find((o) => o.label === label)
  return match?.value
}
