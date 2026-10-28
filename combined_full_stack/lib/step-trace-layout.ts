// AI : shared indent for step trace IO sections — inference uses padding, logging uses margin.
export const STEP_TRACE_IO_INDENT = "pl-7" as const
export const STEP_TRACE_IO_INDENT_NESTED = "pl-5" as const
export const STEP_TRACE_IO_INDENT_MARGIN = "ml-7" as const

export function stepTraceIndentClass(nested?: boolean): string {
  return nested ? STEP_TRACE_IO_INDENT_NESTED : STEP_TRACE_IO_INDENT
}
