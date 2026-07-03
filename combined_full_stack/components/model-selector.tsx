"use client"

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
import { useModelOptions } from "@/lib/use-model-options"
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
  const options = useModelOptions()
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
        {current?.cheap && (
          <span className="rounded bg-primary/20 px-1 text-[9px] font-semibold text-primary">
            $
          </span>
        )}
        <span className="text-foreground">{label}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            routed via openrouter
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
        {options.map((m) => (
          <DropdownMenuItem
            key={m.id}
            onClick={() => onChange(m.id)}
            className="flex items-center justify-between gap-2 font-mono text-[11px]"
          >
            <span className="flex items-center gap-1.5">
              {m.cheap && (
                <span className="rounded bg-primary/20 px-1 text-[9px] font-semibold text-primary">
                  $
                </span>
              )}
              {m.label}
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {m.costPer1k > 0 ? `${m.costPer1k}¢/1k` : "…"}
              {m.id === value && <Check className="h-3 w-3 text-primary" />}
            </span>
          </DropdownMenuItem>
        ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
