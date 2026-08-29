"use client"

import { Link2, Files } from "lucide-react"
import { useOptionalDocViewer } from "@/lib/doc-viewer"
import { useOptionalAppShell } from "@/lib/app-shell"
import { collectQuotes, type ExportedQuote } from "@/lib/quotes"

export function quotesFromJson(json?: string): ExportedQuote[] {
  if (!json) return []
  try {
    return [...new Map(collectQuotes(JSON.parse(json) as unknown).map((q) => [q.href, q])).values()]
  } catch {
    return []
  }
}

export function QuoteButton({ quote, className }: { quote: ExportedQuote; className?: string }) {
  const docViewer = useOptionalDocViewer()
  const shell = useOptionalAppShell()
  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={() =>
          docViewer?.open({ docId: quote.doc_id, start: quote.start, end: quote.end, text: quote.text })
        }
        className={
          className ??
          "inline-flex items-start gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-left font-mono text-[10px] text-primary ring-1 ring-primary/20 transition-colors hover:bg-primary/20"
        }
      >
        <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
        <span className="line-clamp-1">&ldquo;{quote.text}&rdquo;</span>
      </button>
      {shell ? (
        <button
          type="button"
          onClick={() => shell.openDocuments(quote.doc_id)}
          className="rounded p-0.5 text-muted-foreground hover:text-primary"
          title="Open in Documents store"
        >
          <Files className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}

export function QuoteLinks({
  quotes,
  className,
  hint = "source-linked quotes · click to verify",
}: {
  quotes: ExportedQuote[]
  className?: string
  hint?: string | null
}) {
  if (quotes.length === 0) return null
  return (
    <div className={className}>
      {hint && (
        <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{hint}</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {quotes.map((q) => (
          <QuoteButton key={q.href} quote={q} />
        ))}
      </div>
    </div>
  )
}
