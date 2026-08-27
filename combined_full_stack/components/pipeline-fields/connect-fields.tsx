"use client"
// AI : Build inspector for Connect — destination + account live next to the action picker.

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { PipelineField, StaticValue } from "@/components/pipeline-fields/shared"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select"
import { InvalidKind, type InvalidStep } from "@/lib/validity"
import {
  CONNECT_FAMILY_LABEL,
  connectActionFamily,
  getConnectAction,
  summarizeConnectAction,
} from "@/lib/connect-catalog"
import { listRememberedConnectAccounts, rememberConnectAccount } from "@/lib/connect-accounts"
import {
  NONE_ACCOUNT,
  fieldRefOptions,
  groupedConnectActions,
  inputFieldNames,
  isEnumProp,
  isFieldRefProp,
  paramValue,
  sendsAsOptions,
  withCurrentOption,
  type ConnectSelectOption,
} from "@/lib/connect-field-options"
import { piecePropDefaults, type PieceProp } from "@/lib/n8n-catalog"
import { ConnectActionIcon } from "@/components/connect-action-icon"
import type { PipelineModule, StructureModel } from "@/lib/types"

type ConnectModuleFieldsProps = {
  selected: PipelineModule
  edit: boolean
  invalid?: InvalidStep
  onUpdate?: (patch: Partial<PipelineModule>) => void
  models?: StructureModel[]
  modules?: PipelineModule[]
}

function setParam(
  selected: PipelineModule,
  name: string,
  value: string,
  onUpdate?: (patch: Partial<PipelineModule>) => void,
) {
  onUpdate?.({
    connectParameters: { ...(selected.connectParameters ?? {}), [name]: value },
  })
}

function ConfigLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-[11px] font-medium text-foreground">{children}</p>
}

function ConfigHint({ children }: { children?: string }) {
  if (!children) return null
  return <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{children}</p>
}

function EnumSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string
  options: ConnectSelectOption[]
  placeholder: string
  onChange: (next: string) => void
}) {
  const merged = withCurrentOption(options, value)
  const label = merged.find((o) => o.value === value)?.label ?? (value || placeholder)
  return (
    <Select value={value || null} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger className="h-8 w-full text-xs">
        <span className="truncate">{label}</span>
      </SelectTrigger>
      <SelectContent>
        {merged.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ConnectPropControl({
  selected,
  prop,
  edit,
  fieldNames,
  onUpdate,
}: {
  selected: PipelineModule
  prop: PieceProp
  edit: boolean
  fieldNames: string[]
  onUpdate?: (patch: Partial<PipelineModule>) => void
}) {
  const value = paramValue(selected, prop)
  if (!edit) {
    return (
      <div>
        <ConfigLabel>{prop.displayName}</ConfigLabel>
        <StaticValue>{value || "—"}</StaticValue>
        <ConfigHint>{prop.description}</ConfigHint>
      </div>
    )
  }
  if (isFieldRefProp(prop)) {
    return (
      <div>
        <ConfigLabel>{prop.displayName}</ConfigLabel>
        <EnumSelect
          value={value}
          options={fieldRefOptions(prop, fieldNames, value)}
          placeholder="Select a field…"
          onChange={(v) => setParam(selected, prop.name, v, onUpdate)}
        />
        <ConfigHint>{prop.description}</ConfigHint>
      </div>
    )
  }
  if (isEnumProp(prop)) {
    return (
      <div>
        <ConfigLabel>{prop.displayName}</ConfigLabel>
        <EnumSelect
          value={value}
          options={prop.options ?? []}
          placeholder="Select…"
          onChange={(v) => setParam(selected, prop.name, v, onUpdate)}
        />
        <ConfigHint>{prop.description}</ConfigHint>
      </div>
    )
  }
  return (
    <div>
      <ConfigLabel>{prop.displayName}</ConfigLabel>
      <Input
        className="h-8 text-xs"
        value={value}
        placeholder={prop.default != null ? String(prop.default) : undefined}
        onChange={(e) => setParam(selected, prop.name, e.target.value, onUpdate)}
      />
      <ConfigHint>{prop.description}</ConfigHint>
    </div>
  )
}

export function ConnectModuleFields({
  selected,
  edit,
  invalid,
  onUpdate,
  models = [],
  modules = [],
}: ConnectModuleFieldsProps) {
  const groups = groupedConnectActions()
  const entry = getConnectAction(selected.connectActionId)
  const actionInvalid =
    invalid?.kind === InvalidKind.MissingConnectAction ||
    (invalid?.kind === InvalidKind.StructureField && /connect action/i.test(invalid.structureMessage ?? ""))
  const fieldNames = inputFieldNames(selected, models)
  const family = entry ? connectActionFamily(entry) : undefined
  const appLabel = family ? CONNECT_FAMILY_LABEL[family] : "app"
  const connected = Boolean(selected.connectConnectionId?.trim())
  const provider = entry?.provider ?? ""
  const [remembered, setRemembered] = useState<string[]>([])
  const [pasteId, setPasteId] = useState("")
  useEffect(() => {
    setRemembered(listRememberedConnectAccounts(provider))
  }, [provider, selected.connectConnectionId])
  const accountOptions = useMemo(
    () => sendsAsOptions(selected, modules, provider, remembered),
    [selected, modules, provider, remembered],
  )

  function pickAction(id: string) {
    const next = getConnectAction(id)
    onUpdate?.({
      connectActionId: id || undefined,
      connectParameters: next ? piecePropDefaults(next) : {},
      connectConnectionId: undefined,
    })
  }

  function pickAccount(id: string) {
    if (id === NONE_ACCOUNT) {
      onUpdate?.({ connectConnectionId: undefined })
      return
    }
    rememberConnectAccount(provider, id)
    setRemembered(listRememberedConnectAccounts(provider))
    onUpdate?.({ connectConnectionId: id })
  }

  function addPastedAccount() {
    const id = pasteId.trim()
    if (!id) return
    rememberConnectAccount(provider, id)
    setRemembered(listRememberedConnectAccounts(provider))
    onUpdate?.({ connectConnectionId: id })
    setPasteId("")
  }

  return (
    <PipelineField label="App action" hintTone={actionInvalid ? "error" : undefined}>
      <div className="space-y-3">
        {edit ? (
          <Select value={selected.connectActionId || null} onValueChange={(v) => v && pickAction(v)}>
            <SelectTrigger className="h-9 w-full gap-2">
              {entry ? <ConnectActionIcon entry={entry} /> : null}
              <span className="min-w-0 flex-1 truncate text-left text-sm">
                {entry?.displayName ?? "Select an app…"}
              </span>
            </SelectTrigger>
            <SelectContent className="min-w-[16rem]" align="start" alignItemWithTrigger={false}>
              {groups.map((g) => (
                <SelectGroup key={g.family}>
                  <SelectLabel className="flex items-center gap-1.5">
                    <ConnectActionIcon provider={g.actions[0]?.provider} size="sm" />
                    {CONNECT_FAMILY_LABEL[g.family]}
                  </SelectLabel>
                  {g.actions.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-sm">
                      <span className="flex items-center gap-2">
                        <ConnectActionIcon entry={a} size="sm" />
                        {a.displayName}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-2.5 py-2">
            {entry ? <ConnectActionIcon entry={entry} /> : null}
            <span className="text-sm">{entry?.displayName ?? selected.connectActionId ?? "—"}</span>
          </div>
        )}

        {entry?.description ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{entry.description}</p>
        ) : null}

        {entry && entry.auth !== "none" ? (
          <div>
            <ConfigLabel>Sends as</ConfigLabel>
            {edit ? (
              <div className="space-y-1.5">
                <EnumSelect
                  value={connected ? selected.connectConnectionId!.trim() : NONE_ACCOUNT}
                  options={accountOptions}
                  placeholder="Not connected"
                  onChange={pickAccount}
                />
                <Input
                  className="h-7 text-[11px]"
                  value={pasteId}
                  placeholder="Paste a connection id to add it"
                  onChange={(e) => setPasteId(e.target.value)}
                  onBlur={addPastedAccount}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addPastedAccount()
                    }
                  }}
                />
              </div>
            ) : (
              <StaticValue>{connected ? selected.connectConnectionId : "Not connected"}</StaticValue>
            )}
            <ConfigHint>
              {connected
                ? `Using the connected ${appLabel} account.`
                : `Who posts: connect ${appLabel} from Inference, then pick the account here.`}
            </ConfigHint>
          </div>
        ) : null}

        {(entry?.props ?? []).map((prop) => (
          <ConnectPropControl
            key={prop.name}
            selected={selected}
            prop={prop}
            edit={edit}
            fieldNames={fieldNames}
            onUpdate={onUpdate}
          />
        ))}

        {entry ? (
          <p className="rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-foreground">
            {summarizeConnectAction(entry, selected.connectParameters, selected.connectConnectionId)}
          </p>
        ) : null}
      </div>
    </PipelineField>
  )
}
