"use client"

import { useMemo } from "react"
import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { catalogLabel } from "@/lib/types"
import type { ModelOptionPublic } from "@/lib/types"
import { useModelOptions } from "@/lib/use-model-options"
import { cn } from "@/lib/utils"

function sortModelsByPrice(models: ModelOptionPublic[]): ModelOptionPublic[] {
  return [...models].sort((a, b) => {
    const aCost = a.costPer1k > 0 ? a.costPer1k : Number.POSITIVE_INFINITY
    const bCost = b.costPer1k > 0 ? b.costPer1k : Number.POSITIVE_INFINITY
    return aCost - bCost
  })
}

function relativePricePct(
  costPer1k: number,
  minCost: number,
  maxCost: number,
): number {
  if (costPer1k <= 0 || maxCost <= minCost) return 0
  return Math.round(((costPer1k - minCost) / (maxCost - minCost)) * 100)
}

export function ModelSelector({
  value,
  onChange,
  size = "sm",
}: {
  value: string
  onChange: (id: string) => void
  size?: "sm" | "xs"
}) {
  const options = useModelOptions()
  const sortedOptions = useMemo(() => sortModelsByPrice(options), [options])
  const { minCost, maxCost } = useMemo(() => {
    const costs = options.map((m) => m.costPer1k).filter((c) => c > 0)
    if (costs.length === 0) return { minCost: 0, maxCost: 0 }
    return { minCost: Math.min(...costs), maxCost: Math.max(...costs) }
  }, [options])
  const current = options.find((m) => m.id === value) ?? options[0]
  const label = current?.label ?? catalogLabel(value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-secondary font-mono text-muted-foreground transition-colors hover:text-foreground",
          size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]",
        )}
      >
        <span className="text-foreground">{label}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            routed via openrouter
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
        {sortedOptions.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className="flex flex-col items-stretch gap-1.5 font-mono text-[11px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span>{m.label}</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                {m.costPer1k > 0 ? `${m.costPer1k}¢/1k` : "…"}
                {m.id === value && <Check className="h-3 w-3 text-primary" />}
              </span>
            </div>
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${relativePricePct(m.costPer1k, minCost, maxCost)}%` }}
              />
            </div>
          </DropdownMenuItem>
        ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
