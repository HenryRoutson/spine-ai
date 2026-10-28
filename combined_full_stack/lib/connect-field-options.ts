// AI : Pure Connect inspector helpers — dropdown options, no React.
import {
  connectActionFamily,
  getConnectAction,
  listConnectActions,
  type ConnectAction,
  type ConnectActionFamily,
} from "@/lib/connect-catalog"
import { shortConnectAccountLabel } from "@/lib/connect-accounts"
import { flattenPipelineModules } from "@/lib/fork-pipeline"
import type { PieceProp } from "@/lib/n8n-catalog"
import { ModuleKind, type PipelineModule, type StructureModel } from "@/lib/types"

export const NONE_ACCOUNT = "__none__"

const FIELD_FALLBACKS = ["text", "content", "filename", "body", "message", "to", "subject"]

const FAMILY_ORDER: ConnectActionFamily[] = ["slack", "gmail", "sheets", "http"]

export type ConnectSelectOption = { value: string; label: string }

export function groupedConnectActions(): Array<{ family: ConnectActionFamily; actions: ConnectAction[] }> {
  const all = listConnectActions()
  return FAMILY_ORDER.map((family) => ({
    family,
    actions: all.filter((a) => connectActionFamily(a) === family),
  })).filter((g) => g.actions.length > 0)
}

export function inputFieldNames(selected: PipelineModule, models: StructureModel[]): string[] {
  const model = models.find((m) => m.id === selected.inStructureId)
  return model?.fields.map((f) => f.name).filter(Boolean) ?? []
}

export function paramValue(selected: PipelineModule, prop: PieceProp): string {
  const raw = selected.connectParameters?.[prop.name]
  if (raw != null && raw !== "") return String(raw)
  return prop.default != null ? String(prop.default) : ""
}

export function withCurrentOption(options: ConnectSelectOption[], value: string): ConnectSelectOption[] {
  if (!value || options.some((o) => o.value === value)) return options
  return [{ value, label: value }, ...options]
}

export function isFieldRefProp(prop: PieceProp): boolean {
  return Boolean(prop.fromInputFields) || prop.name.endsWith("Field")
}

export function isEnumProp(prop: PieceProp): boolean {
  return prop.type === "select" || Boolean(prop.options?.length)
}

export function fieldRefOptions(prop: PieceProp, fieldNames: string[], value: string): ConnectSelectOption[] {
  const names: string[] = []
  const push = (name: string) => {
    if (name && !names.includes(name)) names.push(name)
  }
  for (const n of fieldNames) push(n)
  if (prop.default != null) push(String(prop.default))
  push(value)
  for (const n of FIELD_FALLBACKS) push(n)
  return names.map((name) => ({ value: name, label: name }))
}

export function sendsAsOptions(
  selected: PipelineModule,
  modules: PipelineModule[],
  provider: string,
  remembered: string[],
): ConnectSelectOption[] {
  const labels = new Map<string, string>()
  for (const m of flattenPipelineModules(modules)) {
    if (m.kind !== ModuleKind.Connect) continue
    const other = getConnectAction(m.connectActionId)
    if (!other || other.provider !== provider) continue
    const id = m.connectConnectionId?.trim()
    if (!id || labels.has(id)) continue
    labels.set(id, m.id === selected.id ? shortConnectAccountLabel(id) : `From ${m.label}`)
  }
  for (const id of remembered) {
    if (!labels.has(id)) labels.set(id, shortConnectAccountLabel(id))
  }
  const current = selected.connectConnectionId?.trim()
  if (current && !labels.has(current)) labels.set(current, shortConnectAccountLabel(current))
  return [
    { value: NONE_ACCOUNT, label: "Not connected" },
    ...[...labels.entries()].map(([value, label]) => ({ value, label })),
  ]
}
