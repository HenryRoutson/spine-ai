import { uid } from "@/lib/id"
import type { ParallelBranch, StructureModelId } from "@/lib/types"

export function makeEmptyParallelBranch(): ParallelBranch {
  return {
    id: uid("pbr_"),
    field: "result",
    prompt: "",
    outStructureId: "" as StructureModelId,
  }
}
