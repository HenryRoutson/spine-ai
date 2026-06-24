"use client"

// AI : TODO — validated-text click-to-source. The backend half is DONE and verified:
// AI : run artifacts carry {text, quote: {doc_id, start, end}} where start/end are character
// AI : offsets into the stored docs/<doc_id>.txt (source.slice(start, end) === text exactly,
// AI : checked against a real run). Remaining work is all UI, in this order:
// AI :   1. Clickable quotes — when rendering a step's output JSON, walk the attached
// AI :      StructureModel for tuple[text,quote] / list[tuple[text,quote]] fields and render
// AI :      each as a chip/link instead of raw JSON; onClick → useDocViewer().open(
// AI :      { docId: quote.doc_id, start: quote.start, end: quote.end }).
// AI :   2. Viewer panel — a drawer/modal subscribed to `target`: fetch the doc text by id
// AI :      (store.docContent → API route), render three segments
// AI :      slice(0,start) / <mark> slice(start,end) / slice(end), then
// AI :      markRef.scrollIntoView({ block: "center" }) + a brief flash animation.
// AI :   3. Guard rails — if slice(start,end) !== quote text (doc re-uploaded / offsets stale),
// AI :      fall back to indexOf(text); if that misses, show the doc un-highlighted.
// AI :   4. PDF tab — Documents shows pdf + text views; highlight ONLY in the text view.
// AI :      Highlighting inside the rendered PDF needs text-layer offset mapping — out of
// AI :      scope, TODO placeholder (text view is the demo path).
// AI :   5. Shareable link — encode the target in the URL hash (#doc=<id>&s=555&e=753) so a
// AI :      highlighted quote can be sent to others (pairs with the Inference share link).
// AI : Backend support already in place for 1 + 5: each run exports runs/<id>/quotes_latest.json
// AI : — every resolved quote as {text, doc_id, start, end, href: "doc://<hash>#<start>-<end>"}
// AI : (quoteHref / parseQuoteHref in backend/lib/quotation.ts round-trip the href). The fuzzy
// AI : tail-window scoring bug is fixed — scores are now quote-normalized, so non-verbatim
// AI : quotes resolve to the best whole-quote token match.

import { createContext, useContext, useState, type ReactNode } from "react"

export interface DocJumpTarget {
  docId: string
  start: number
  end: number
}

interface DocViewerState {
  target: DocJumpTarget | null
  open: (t: DocJumpTarget) => void
  close: () => void
}

const DocViewerContext = createContext<DocViewerState | null>(null)

export function DocViewerProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<DocJumpTarget | null>(null)
  return (
    <DocViewerContext.Provider
      value={{
        target,
        open: (t) => setTarget(t),
        close: () => setTarget(null),
      }}
    >
      {children}
    </DocViewerContext.Provider>
  )
}

export function useDocViewer() {
  const ctx = useContext(DocViewerContext)
  if (!ctx) throw new Error("useDocViewer must be used within DocViewerProvider")
  return ctx
}
