"use client"

import { Check, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MODEL_OPTIONS } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ModelSelector({
  value,
  onChange,
  size = "sm",
}: {
  value: string
  onChange: (id: string) => void
  size?: "sm" | "xs"
}) {
  const current = MODEL_OPTIONS.find((m) => m.id === value) ?? MODEL_OPTIONS[0]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-secondary font-mono text-muted-foreground transition-colors hover:text-foreground",
          size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]",
        )}
      >
        <span
          className={cn(
            "rounded px-1 text-[9px] font-semibold",
            current.cheap ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {current.flag}
        </span>
        <span className="text-foreground">{current.label}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
          routed via openrouter
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MODEL_OPTIONS.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className="flex items-center justify-between gap-2 font-mono text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1 text-[9px] font-semibold",
                  m.cheap ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {m.flag}
              </span>
              {m.label}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {m.costPer1k}¢/1k
              {m.id === value && <Check className="h-3 w-3 text-primary" />}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
