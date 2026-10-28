// AI : client-safe spine type helpers — re-exported for pipeline UI.
export type { TypeExpr } from "./server/types";
export {
  formatTypeExpr,
  isListRoot,
  stepSpineInType,
  stepSpineOutType,
} from "./server/type_expr";
export {
  formatModuleSpineIn,
  formatModuleSpineOut,
  llmStepEmitsList,
  patchSpineOutList,
  resolveOutIsList,
} from "./server/spine_types";
