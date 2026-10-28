"use client"

import { useEffect, useMemo, useState } from "react"
import { codeHashLabel, errorsForCode, CODE_ERROR_NS, type CodeErrorNamespace } from "@/lib/code-error-history"

export { CODE_ERROR_NS, type CodeErrorNamespace }

function useCodeErrors(code: string, namespace: string) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const refresh = () => setTick((n) => n + 1)
    window.addEventListener("forge:code-error-history", refresh)
    return () => window.removeEventListener("forge:code-error-history", refresh)
  }, [])
  return useMemo(() => errorsForCode(code, namespace), [code, namespace, tick])
}

export function CodeErrorHistory({
  code,
  namespace,
  className,
}: {
  code: string
  namespace: CodeErrorNamespace | string
  className?: string
}) {
  const errors = useCodeErrors(code, namespace)
  if (!errors.length) return null
  return (
    <div className={className ?? "rounded-md border border-border bg-secondary/20 p-3"}>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Errors for this code · hash {codeHashLabel(code)}
      </p>
      <ul className="max-h-32 space-y-2 overflow-auto">
        {errors.map((e, i) => (
          <li key={`${e.at}-${i}`} className="rounded border border-destructive/30 bg-destructive/5 px-2 py-1.5">
            <p className="font-mono text-[10px] text-muted-foreground">{new Date(e.at).toLocaleString()}</p>
            <p className="mt-0.5 whitespace-pre-wrap font-mono text-[11px] text-destructive">{e.message}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
