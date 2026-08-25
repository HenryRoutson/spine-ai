"use client"
// AI : Dev-mode fields for a hidden-in-Vibe connect step. Vibe uses ConnectAppsBanner, not this form.

import { Input } from "@/components/ui/input"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import { InvalidKind, type InvalidStep } from "@/lib/validity"
import { getConnectAction, listConnectActions } from "@/lib/connect-catalog"
import type { PipelineModule } from "@/lib/types"

type ConnectModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  invalid?: InvalidStep
  onUpdate?: (patch: Partial<PipelineModule>) => void
}

export function ConnectModuleFields({ selected, edit, invalid, onUpdate }: ConnectModuleFieldsProps) {
  const actions = listConnectActions()
  const entry = getConnectAction(selected.connectActionId)
  const actionInvalid =
    invalid?.kind === InvalidKind.MissingConnectAction ||
    (invalid?.kind === InvalidKind.StructureField && /connect action/i.test(invalid.structureMessage ?? ""))
  return (
    <>
      <PipelineField label="App action" hintTone={actionInvalid ? "error" : undefined}>
        {edit ? (
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={selected.connectActionId ?? ""}
            onChange={(e) => onUpdate?.({ connectActionId: e.target.value })}
          >
            <option value="">Select…</option>
            {actions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.displayName}
              </option>
            ))}
          </select>
        ) : (
          <StaticValue>{entry?.displayName ?? selected.connectActionId ?? "—"}</StaticValue>
        )}
      </PipelineField>
      {entry?.props.map((prop) => (
        <PipelineField key={prop.name} label={prop.displayName}>
          {edit ? (
            <Input
              className="h-8 font-mono text-xs"
              value={String(selected.connectParameters?.[prop.name] ?? prop.default ?? "")}
              onChange={(e) =>
                onUpdate?.({
                  connectParameters: { ...(selected.connectParameters ?? {}), [prop.name]: e.target.value },
                })
              }
            />
          ) : (
            <StaticValue>{String(selected.connectParameters?.[prop.name] ?? prop.default ?? "—")}</StaticValue>
          )}
        </PipelineField>
      ))}
      {entry && entry.auth !== "none" ? (
        <p className="text-[11px] text-muted-foreground">
          {selected.connectConnectionId?.trim()
            ? "Account connected. Vibe users see a connected chip, not this step."
            : "Not connected yet — Vibe shows Connect without opening this editor."}
        </p>
      ) : null}
    </>
  )
}
