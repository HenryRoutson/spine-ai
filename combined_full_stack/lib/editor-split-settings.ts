// AI : re-exports — prefer @/lib/layout-split-settings for new code.

import {
  LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT,
  pipelineInspectorSplit,
  structureSidebarSplit,
  useLayoutSplitWidth,
} from "@/lib/layout-split-settings"

export { LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT as EDITOR_SPLIT_SETTINGS_CHANGED_EVENT }

export const STRUCTURE_SIDEBAR_MIN = structureSidebarSplit.min
export const STRUCTURE_SIDEBAR_MAX = structureSidebarSplit.max
export const DEFAULT_STRUCTURE_SIDEBAR_WIDTH = structureSidebarSplit.defaultWidth
export const readStructureSidebarWidth = structureSidebarSplit.read
export const writeStructureSidebarWidth = structureSidebarSplit.write

export const PIPELINE_INSPECTOR_MIN = pipelineInspectorSplit.min
export const PIPELINE_INSPECTOR_MAX = pipelineInspectorSplit.max
export const DEFAULT_PIPELINE_INSPECTOR_WIDTH = pipelineInspectorSplit.defaultWidth
export const readPipelineInspectorWidth = pipelineInspectorSplit.read
export const writePipelineInspectorWidth = pipelineInspectorSplit.write

export function useStructureSidebarWidth() {
  return useLayoutSplitWidth(structureSidebarSplit.read)
}

export function usePipelineInspectorWidth() {
  return useLayoutSplitWidth(pipelineInspectorSplit.read)
}
