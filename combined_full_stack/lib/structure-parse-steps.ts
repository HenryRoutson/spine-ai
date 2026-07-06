// AI : auto LLM structure-parse step helpers — shared by pipeline builder and store.
export {
  AUTO_STRUCTURE_PARSE_EXPLAINER,
  autoStructureParseStepForInput,
  inputTargetStructureId,
  isAutoStructureParseStep,
  patchInputTargetStructure,
  syncAutoStructureParseSteps,
  syncManagedPipelineSteps,
} from "./server/validity-sync"
