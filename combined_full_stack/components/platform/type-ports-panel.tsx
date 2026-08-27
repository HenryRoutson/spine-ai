"use client"

import { useMemo } from "react"
import { ArrowRight, CheckCircle2, Link2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { spineActionProps } from "@/lib/core/parity"
import {
  compatStatusColor,
  compatStatusLabel,
  findPortConnections,
  pipelinePorts,
  structurePorts,
  wireStructureToInput,
  type port_connection,
} from "@/lib/platform-type-ports"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import type { ModuleId, StructureModelId } from "@/lib/types"

// AI : typed port mixer — click to wire compatible structures into pipeline inputs.
export function TypePortsPanel({ onWire }: { onWire?: () => void } = {}) {
  const { modules, models, typeAliases, setModules } = useStore()

  const structures = useMemo(() => structurePorts(models, typeAliases), [models, typeAliases])
  const pipelines = useMemo(
    () => pipelinePorts(modules, models, typeAliases),
    [modules, models, typeAliases],
  )
  const connections = useMemo(
    () => findPortConnections(modules, models, typeAliases),
    [modules, models, typeAliases],
  )

  const inputPorts = pipelines.filter((p) => p.direction === "in" && p.kind === "input")
  const wiredIds = new Set(
    inputPorts.filter((p) => p.structureId).map((p) => `${p.moduleId}:${p.structureId}`),
  )

  function handleWire(moduleId: ModuleId, structureId: StructureModelId) {
    setModules(wireStructureToInput(modules, moduleId, structureId))
    onWire?.()
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Typed ports</h4>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Connect structure models to pipeline inputs. Only compatible types can be wired.
        </p>
      </div>

      {structures.length === 0 ? (
        <p className="text-xs text-muted-foreground">No structures defined yet.</p>
      ) : null}

      {inputPorts.length === 0 ? (
        <p className="text-xs text-muted-foreground">No pipeline input steps found.</p>
      ) : null}

      <div className="space-y-3">
        {inputPorts.map((port) => {
          const portConnections = connections.filter(
            (c) => c.pipelineModuleId === port.moduleId && c.direction === "in",
          )
          const wired = port.structureId
            ? structures.find((s) => s.modelId === port.structureId)
            : undefined

          return (
            <div key={port.moduleId} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-medium">{port.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-[10px] text-muted-foreground">{port.typeLabel}</span>
              </div>

              {wired ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>
                    Wired to <strong>{wired.name}</strong>
                  </span>
                </div>
              ) : (
                <p className="mt-1.5 text-[10px] text-muted-foreground">Not wired to a structure</p>
              )}

              {portConnections.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {portConnections.map((conn) => (
                    <ConnectionRow
                      key={`${conn.pipelineModuleId}:${conn.structureId}`}
                      connection={conn}
                      wired={wiredIds.has(`${conn.pipelineModuleId}:${conn.structureId}`)}
                      onWire={() => handleWire(conn.pipelineModuleId, conn.structureId)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  No compatible structures for this input type.
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ConnectionRow({
  connection,
  wired,
  onWire,
}: {
  connection: port_connection
  wired: boolean
  onWire: () => void
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-border/60 bg-background px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-[11px]">{connection.structureName}</span>
        <span className={cn("text-[10px]", compatStatusColor(connection.status))}>
          {compatStatusLabel(connection.status)}
        </span>
      </div>
      {wired ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : connection.status !== "incompatible" ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[10px]"
          onClick={onWire}
          {...spineActionProps("platform.wire-port")}
        >
          Wire
        </Button>
      ) : (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      )}
    </li>
  )
}
