"use client"

import { useMemo } from "react"
import { Check, ChevronDown, Settings2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useOptionalAppShell } from "@/lib/app-shell"
import { useCustomLlmProviders } from "@/lib/custom-llm-providers"
import { useOptionalStore } from "@/lib/store"
import {
  catalogLabel,
  formatRoutedModel,
  OPENROUTER_PROVIDER_ID,
  parseRoutedModel,
  type ModelOptionPublic,
} from "@/lib/types"
import { useModelOptions } from "@/lib/use-model-options"
import { cn } from "@/lib/utils"

type RoutedOption = {
  ref: string
  label: string
  providerId: string
  modelId: string
  costPer1k: number
}

function sortModelsByPrice(models: RoutedOption[]): RoutedOption[] {
  return [...models].sort((a, b) => {
    const aCost = a.costPer1k > 0 ? a.costPer1k : Number.POSITIVE_INFINITY
    const bCost = b.costPer1k > 0 ? b.costPer1k : Number.POSITIVE_INFINITY
    return aCost - bCost
  })
}

function relativePricePct(costPer1k: number, minCost: number, maxCost: number): number {
  if (costPer1k <= 0 || maxCost <= minCost) return 0
  return Math.round(((costPer1k - minCost) / (maxCost - minCost)) * 100)
}

function buildRoutedOptions(catalog: ModelOptionPublic[], providerIds: string[]): RoutedOption[] {
  const out: RoutedOption[] = []
  for (const providerId of providerIds) {
    for (const m of catalog) {
      out.push({
        ref: formatRoutedModel(providerId, m.id),
        label: m.label,
        providerId,
        modelId: m.id,
        costPer1k: providerId === OPENROUTER_PROVIDER_ID ? m.costPer1k : 0,
      })
    }
  }
  return out
}

function normalizeValue(value: string): string {
  const parsed = parseRoutedModel(value)
  return formatRoutedModel(parsed.providerId, parsed.modelId)
}

function displayLabel(ref: string, options: RoutedOption[]): string {
  const hit = options.find((o) => o.ref === ref)
  if (hit) return hit.ref
  const parsed = parseRoutedModel(ref)
  return `${parsed.providerId}:${catalogLabel(parsed.modelId)}`
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
  const shell = useOptionalAppShell()
  const project = useOptionalStore()?.project
  const catalog = useModelOptions()
  const customProviders = useCustomLlmProviders(project?.llmProviders)

  const providerIds = useMemo(
    () => [OPENROUTER_PROVIDER_ID, ...customProviders.map((p) => p.id)],
    [customProviders],
  )

  const routedOptions = useMemo(() => buildRoutedOptions(catalog, providerIds), [catalog, providerIds])
  const sortedOptions = useMemo(() => sortModelsByPrice(routedOptions), [routedOptions])
  const normalizedValue = normalizeValue(value)

  const { minCost, maxCost } = useMemo(() => {
    const costs = routedOptions.map((m) => m.costPer1k).filter((c) => c > 0)
    if (costs.length === 0) return { minCost: 0, maxCost: 0 }
    return { minCost: Math.min(...costs), maxCost: Math.max(...costs) }
  }, [routedOptions])

  const grouped = useMemo(() => {
    const map = new Map<string, RoutedOption[]>()
    for (const opt of sortedOptions) {
      const list = map.get(opt.providerId) ?? []
      list.push(opt)
      map.set(opt.providerId, list)
    }
    return map
  }, [sortedOptions])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-secondary font-mono text-muted-foreground transition-colors hover:text-foreground",
          size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]",
        )}
      >
        <span className="text-foreground">{displayLabel(normalizedValue, routedOptions)}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {[...grouped.entries()].map(([providerId, opts], groupIdx) => (
          <DropdownMenuGroup key={providerId}>
            {groupIdx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
              {providerId}
            </DropdownMenuLabel>
            {opts.map((m) => (
              <DropdownMenuItem
                key={m.ref}
                onClick={() => onChange(m.ref)}
                className="flex flex-col items-stretch gap-1.5 font-mono text-[11px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{m.label}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    {m.costPer1k > 0 ? `${m.costPer1k}¢/1k` : "custom"}
                    {m.ref === normalizedValue && <Check className="h-3 w-3 text-primary" />}
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">{m.ref}</span>
                {m.costPer1k > 0 && (
                  <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${relativePricePct(m.costPer1k, minCost, maxCost)}%` }}
                    />
                  </div>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => shell?.openSettingsSection("settings-llm-providers")}
          className="gap-2 font-mono text-[11px] text-primary"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Manage providers…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
