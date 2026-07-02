"use client"

import { useEffect, useState } from "react"
import { Download, FileJson, FileSpreadsheet, Table2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buildDownloadBaseName } from "@/lib/data-download-name"
import { downloadDataAs, isDownloadableJson, type DataDownloadFormat } from "@/lib/data-download"
import { useOptionalStore } from "@/lib/store"
import { createClient } from "@/utils/supabase/client"
import { cn } from "@/lib/utils"
import type { StructureModel } from "@/lib/types"

const FORMATS: { id: DataDownloadFormat; label: string; icon: typeof FileJson }[] = [
  { id: "json", label: "JSON", icon: FileJson },
  { id: "csv", label: "CSV", icon: Table2 },
  { id: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
]

export function DataDownloadMenu({
  content,
  models: modelsProp,
  baseNameOverride,
  className,
}: {
  content: string
  models?: StructureModel[]
  baseNameOverride?: string
  className?: string
}) {
  const store = useOptionalStore()
  const models = modelsProp ?? store?.models
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const canDownload = isDownloadableJson(content)

  useEffect(() => {
    void createClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }) => setUserEmail(data.user?.email ?? null))
      .catch(() => setUserEmail(null))
  }, [])

  async function handleDownload(format: DataDownloadFormat) {
    try {
      const baseName =
        baseNameOverride ??
        (await buildDownloadBaseName({
          content,
          projectName: store?.project.name,
          userEmail,
          models,
          typeAliases: store?.typeAliases,
        }))
      downloadDataAs(content, format, baseName)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!canDownload}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-7 shrink-0 gap-1.5 font-mono text-[10px]",
          className,
        )}
        title={canDownload ? "Download data" : "Invalid JSON — cannot download"}
      >
        <Download className="h-3.5 w-3.5" />
        Download
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground">
            Export as
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuGroup>
          {FORMATS.map(({ id, label, icon: Icon }) => (
            <DropdownMenuItem key={id} onClick={() => void handleDownload(id)} className="gap-2 font-mono text-xs">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
