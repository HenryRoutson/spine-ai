// AI : re-exports — prefer @/lib/layout-split-settings for new code.

import {
  LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT,
  pipelineCanvasSplit,
  structureSidebarSplit,
  useLayoutSplitWidth,
} from "@/lib/layout-split-settings"

export { LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT as EDITOR_SPLIT_SETTINGS_CHANGED_EVENT }

export const STRUCTURE_SIDEBAR_MIN = structureSidebarSplit.min
export const STRUCTURE_SIDEBAR_MAX = structureSidebarSplit.max
export const DEFAULT_STRUCTURE_SIDEBAR_WIDTH = structureSidebarSplit.defaultWidth
export const readStructureSidebarWidth = structureSidebarSplit.read
export const writeStructureSidebarWidth = structureSidebarSplit.write

export const PIPELINE_CANVAS_MIN = pipelineCanvasSplit.min
export const PIPELINE_CANVAS_MAX = pipelineCanvasSplit.max
export const DEFAULT_PIPELINE_CANVAS_WIDTH = pipelineCanvasSplit.defaultWidth
export const readPipelineCanvasWidth = pipelineCanvasSplit.read
export const writePipelineCanvasWidth = pipelineCanvasSplit.write

export function useStructureSidebarWidth() {
  return useLayoutSplitWidth(structureSidebarSplit.read)
}

export function usePipelineCanvasWidth() {
  return useLayoutSplitWidth(pipelineCanvasSplit.read)
}
