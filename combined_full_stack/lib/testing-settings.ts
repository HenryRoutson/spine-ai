// AI : re-exports — prefer @/lib/layout-split-settings for new code.

import {
  LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT,
  testingCompareSplit,
  testingPipelineSplit,
  testingSidebarSplit,
  useLayoutSplitWidth,
} from "@/lib/layout-split-settings"

export { LAYOUT_SPLIT_SETTINGS_CHANGED_EVENT as TESTING_SETTINGS_CHANGED_EVENT }

export const TESTING_SIDEBAR_MIN = testingSidebarSplit.min
export const TESTING_SIDEBAR_MAX = testingSidebarSplit.max
export const DEFAULT_TESTING_SIDEBAR_WIDTH = testingSidebarSplit.defaultWidth
export const readTestingSidebarWidth = testingSidebarSplit.read
export const writeTestingSidebarWidth = testingSidebarSplit.write

export const TESTING_COMPARE_MIN = testingCompareSplit.min
export const TESTING_COMPARE_MAX = testingCompareSplit.max
export const DEFAULT_TESTING_COMPARE_WIDTH = testingCompareSplit.defaultWidth
export const readTestingCompareWidth = testingCompareSplit.read
export const writeTestingCompareWidth = testingCompareSplit.write

export function useTestingSidebarWidth() {
  return useLayoutSplitWidth(testingSidebarSplit.read)
}

export function useTestingCompareWidth() {
  return useLayoutSplitWidth(testingCompareSplit.read)
}

export const TESTING_PIPELINE_MIN = testingPipelineSplit.min
export const TESTING_PIPELINE_MAX = testingPipelineSplit.max
export const DEFAULT_TESTING_PIPELINE_WIDTH = testingPipelineSplit.defaultWidth
export const readTestingPipelineWidth = testingPipelineSplit.read
export const writeTestingPipelineWidth = testingPipelineSplit.write

export function useTestingPipelineWidth() {
  return useLayoutSplitWidth(testingPipelineSplit.read)
}
