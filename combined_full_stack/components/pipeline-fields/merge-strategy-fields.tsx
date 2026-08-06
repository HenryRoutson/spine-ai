"use client"

import {
  MergeDictStrategy,
  MergeListStrategy,
  MergeScalarStrategy,
} from "@/lib/types"
import {
  MERGE_DICT_STRATEGY_LABELS,
  MERGE_LIST_STRATEGY_LABELS,
  MERGE_SCALAR_STRATEGY_LABELS,
} from "@/lib/list-ops-steps"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type MergeStrategySelectProps<T extends string> = {
  value: T
  onValueChange: (v: T) => void
  triggerClassName?: string
  placeholder?: string
}

export function MergeListStrategySelect({
  value,
  onValueChange,
  triggerClassName = "h-8 text-xs",
  placeholder,
}: MergeStrategySelectProps<MergeListStrategy>) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as MergeListStrategy)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.values(MergeListStrategy).map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {MERGE_LIST_STRATEGY_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function MergeDictStrategySelect({
  value,
  onValueChange,
  triggerClassName = "h-8 text-xs",
  placeholder,
}: MergeStrategySelectProps<MergeDictStrategy>) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as MergeDictStrategy)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.values(MergeDictStrategy).map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {MERGE_DICT_STRATEGY_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function MergeScalarStrategySelect({
  value,
  onValueChange,
  triggerClassName = "h-8 text-xs",
  placeholder,
}: MergeStrategySelectProps<MergeScalarStrategy>) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as MergeScalarStrategy)}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.values(MergeScalarStrategy).map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {MERGE_SCALAR_STRATEGY_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
