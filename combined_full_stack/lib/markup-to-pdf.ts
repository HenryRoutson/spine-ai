import { MarkupKind, type markup_source_string } from "@/lib/markup-kinds"
import {
  validateMarkup,
  type MarkupValidationIssue,
} from "@/lib/markup-validate"

export type MarkupToPdfOk = {
  ok: true
  pdfBytes: Uint8Array
  engine: MarkupKind
}

export type MarkupToPdfFail =
  | { ok: false; reason: "validation"; issues: MarkupValidationIssue[] }
  | { ok: false; reason: "engine"; message: string; engine: MarkupKind }

export type MarkupToPdfResult = MarkupToPdfOk | MarkupToPdfFail

export type MarkupToPdfInput = {
  kind: MarkupKind
  source: markup_source_string
}

// AI : engines are pluggable — validate first, then route by MarkupKind (no shared blob of ifs elsewhere).
async function convertMarkdownToPdf(_source: markup_source_string): Promise<MarkupToPdfResult> {
  // AI : wire pandoc / md-pdf here when available — keep signature stable.
  return {
    ok: false,
    reason: "engine",
    engine: MarkupKind.Markdown,
    message: "markdown→PDF engine not configured (planned: pandoc)",
  }
}

async function convertLatexToPdf(_source: markup_source_string): Promise<MarkupToPdfResult> {
  // AI : SECURITY — when wired, run pdflatex/xelatex with -no-shell-escape and allowlisted packages only.
  return {
    ok: false,
    reason: "engine",
    engine: MarkupKind.Latex,
    message: "latex→PDF engine not configured (planned: pdflatex -no-shell-escape)",
  }
}

export async function convertMarkupToPdf(input: MarkupToPdfInput): Promise<MarkupToPdfResult> {
  const checked = validateMarkup(input.kind, input.source)
  if (!checked.ok) {
    return { ok: false, reason: "validation", issues: checked.issues }
  }

  switch (input.kind) {
    case MarkupKind.Markdown:
      return convertMarkdownToPdf(input.source)
    case MarkupKind.Latex:
      return convertLatexToPdf(input.source)
    default: {
      const _exhaustive: never = input.kind
      return _exhaustive
    }
  }
}
