// AI : auto LLM structure-parse step helpers — shared by pipeline builder and store.
export {
  AUTO_STRUCTURE_PARSE_EXPLAINER,
  AUTO_DOC_TO_TEXT_EXPLAINER,
  authoredPipelineModules,
  autoDocToTextStepForInput,
  autoStructureParseStepForInput,
  inputTargetStructureId,
  isAutoDocToTextStep,
  isAutoStructureParseStep,
  isInputManagedFollower,
  isManagedLockedStep,
  patchInputTargetStructure,
  projectWithAuthoredModules,
  syncAutoDocToTextSteps,
  syncAutoStructureParseSteps,
  syncManagedPipelineSteps,
} from "./server/validity-sync"
