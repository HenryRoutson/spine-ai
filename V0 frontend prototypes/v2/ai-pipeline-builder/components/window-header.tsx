import type { ReactNode } from "react"

export function WindowHeader({
  step,
  title,
  description,
  actions,
}: {
  step: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-primary">{step}</span>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {description}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
