"use client"

import { useMemo } from "react"
import { MarkupView } from "@/components/highlight"
import { extractLatexPreviewPieces, type LatexPreviewPiece } from "@/lib/latex-preview"
import { MarkupKind } from "@/lib/markup-kinds"
import { cn } from "@/lib/utils"

function LatexPieceView({ piece }: { piece: LatexPreviewPiece }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/50 px-3 py-2.5">
      {(piece.title || piece.style) && (
        <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/50 pb-1.5">
          {piece.title ? <p className="text-sm font-medium text-foreground">{piece.title}</p> : null}
          {piece.style ? (
            <p className="font-mono text-[10px] text-muted-foreground">{piece.style}</p>
          ) : null}
        </div>
      )}
      <MarkupView kind={MarkupKind.Latex} source={piece.source} />
    </div>
  )
}

export function LatexDocumentPreview({
  jsonOrText,
  pieces: piecesProp,
  className,
}: {
  jsonOrText?: string
  pieces?: LatexPreviewPiece[]
  className?: string
}) {
  const pieces = useMemo(
    () => piecesProp ?? (jsonOrText ? extractLatexPreviewPieces(jsonOrText) : []),
    [jsonOrText, piecesProp],
  )
  if (!pieces.length) {
    return (
      <p className="px-3 py-4 font-mono text-[11px] text-muted-foreground">No LaTeX to preview.</p>
    )
  }
  return (
    <div className={cn("space-y-3 overflow-auto px-3 py-2.5", className)}>
      {pieces.map((piece, i) => (
        <LatexPieceView key={`${piece.title ?? "latex"}-${i}`} piece={piece} />
      ))}
    </div>
  )
}
