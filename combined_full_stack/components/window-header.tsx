import type { ReactNode } from "react"

// AI : slim toolbar — title/step live in workspace nav; only render when actions exist.
export function WindowHeader({ actions }: { actions?: ReactNode }) {
  if (!actions) return null
  return (
    <div className="flex items-center justify-end gap-2 border-b border-border px-5 py-2">
      {actions}
    </div>
  )
}
