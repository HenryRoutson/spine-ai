"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, ScrollText } from "lucide-react"
import { API_ROUTES } from "@/lib/api-routes"
import { JSON_HEADERS } from "@/lib/api-client"
import { MarkdownView } from "@/components/highlight"
import { useStore } from "@/lib/store"
import { timeAgo } from "@/lib/time-ago"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const STREAM_EVENT = {
  DELTA: "delta",
  DONE: "done",
  ERROR: "error",
} as const

export function PipelineSummaryBox() {
  const { project, model: globalModel } = useStore()
  const [streaming, setStreaming] = useState(false)
  const [text, setText] = useState("")
  const [generatedAt, setGeneratedAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState<string | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!generatedAt) return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [generatedAt])

  async function generate() {
    setStreaming(true)
    setText("")
    setGeneratedAt(null)
    setError(null)

    try {
      const res = await fetch(API_ROUTES.pipelineSummary, {
        method: "POST",
        headers: JSON_HEADERS,
        credentials: "same-origin",
        body: JSON.stringify({ projectId: project.id, model: globalModel }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `request failed (${res.status})`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error("empty response body")

      const decoder = new TextDecoder()
      let buffer = ""
      let acc = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line) as { type: string; text?: string; error?: string }
          if (evt.type === STREAM_EVENT.ERROR) throw new Error(evt.error ?? "summary failed")
          if (evt.type === STREAM_EVENT.DELTA && evt.text) {
            acc += evt.text
            setText(acc)
            outputRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
          }
          if (evt.type === STREAM_EVENT.DONE && evt.text) {
            acc = evt.text
            setText(acc)
          }
        }
      }

      if (acc.trim()) setGeneratedAt(Date.now())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center pt-6">
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-dashed bg-transparent text-xs text-muted-foreground hover:border-primary hover:bg-primary/5 hover:text-foreground"
        onClick={() => void generate()}
        disabled={streaming}
      >
        {streaming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScrollText className="h-3.5 w-3.5" />
        )}
        {streaming ? "Generating…" : "Generate summary"}
      </Button>

      {error && (
        <p className="mt-3 max-w-xl text-center font-mono text-[11px] text-destructive">{error}</p>
      )}

      {(text || streaming) && (
        <div
          ref={outputRef}
          className={cn(
            "mt-4 w-full max-w-xl rounded-lg border border-border/60 bg-secondary/20 px-4 py-3",
          )}
        >
          {generatedAt && !streaming && (
            <p className="mb-3 font-mono text-[10px] text-muted-foreground">
              Generated {timeAgo(generatedAt, now)}
            </p>
          )}
          <MarkdownView md={text} />
          {streaming && <span className="inline-block animate-pulse text-primary">▍</span>}
        </div>
      )}
    </div>
  )
}
