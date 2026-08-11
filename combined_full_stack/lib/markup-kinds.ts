import { InputType } from "@/lib/server/types"

// AI : first-class markup kinds — shared by InputType, PrimName, validate, and PDF convert.
// AI : keep this free of type_expr imports to avoid cycles (type_expr → validate → kinds).
// AI : string values are the persisted wire/DB format — do not rename.
export enum MarkupKind {
  Markdown = "markdown",
  Latex = "latex",
}

export type markup_source_string = string

export const MARKUP_KINDS: readonly MarkupKind[] = [MarkupKind.Markdown, MarkupKind.Latex]

export function isMarkupKind(value: string): value is MarkupKind {
  return value === MarkupKind.Markdown || value === MarkupKind.Latex
}

export function markupKindFromInputType(type: InputType): MarkupKind | null {
  if (type === InputType.Markdown) return MarkupKind.Markdown
  if (type === InputType.Latex) return MarkupKind.Latex
  return null
}

export function markupKindFromPrim(name: string): MarkupKind | null {
  if (name === MarkupKind.Markdown) return MarkupKind.Markdown
  if (name === MarkupKind.Latex) return MarkupKind.Latex
  return null
}

export function inputTypeFromMarkupKind(kind: MarkupKind): InputType {
  switch (kind) {
    case MarkupKind.Markdown:
      return InputType.Markdown
    case MarkupKind.Latex:
      return InputType.Latex
    default: {
      const _exhaustive: never = kind
      return _exhaustive
    }
  }
}

export function isMarkupInputType(type: InputType): boolean {
  return markupKindFromInputType(type) !== null
}

export function isMarkupPrim(name: string): name is MarkupKind {
  return markupKindFromPrim(name) !== null
}
