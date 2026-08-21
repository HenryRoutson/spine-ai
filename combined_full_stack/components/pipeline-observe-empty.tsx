"use client"

import { Sparkles } from "lucide-react"

type PipelineObserveEmptyProps = {
  title?: string
  copy: string
}

// AI : blank Input+Output is unfinished, not broken — keep Vibe Inference/Logging calm for new projects.
export function PipelineObserveEmpty({
  title = "Nothing here yet",
  copy,
}: PipelineObserveEmptyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="max-w-md rounded-lg border border-border bg-muted/20 px-6 py-8">
        <Sparkles className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy}</p>
      </div>
    </div>
  )
}
