"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { normalizeTypeParams } from "@/lib/type-params"
import { cn } from "@/lib/utils"

export function TypeParamsField({
  params,
  locked,
  onChange,
  onLockedInteract,
  className,
}: {
  params?: string[]
  locked: boolean
  onChange: (params: string[] | undefined) => void
  onLockedInteract?: () => void
  className?: string
}) {
  const [raw, setRaw] = useState((params ?? []).join(", "))
  useEffect(() => {
    setRaw((params ?? []).join(", "))
  }, [params])

  function commit() {
    onChange(normalizeTypeParams(raw))
  }

  return (
    <div className={cn("space-y-1", className)}>
      <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Type params
      </label>
      <Input
        value={raw}
        readOnly={locked}
        onPointerDown={locked ? onLockedInteract : undefined}
        onFocus={locked ? onLockedInteract : undefined}
        placeholder="T or A, B — leave empty if none"
        className="h-8 font-mono text-xs read-only:cursor-not-allowed"
        onChange={(e) => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return
          e.preventDefault()
          commit()
        }}
      />
    </div>
  )
}
