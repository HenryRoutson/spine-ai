import { describe, expect, it } from "vitest"
import { InputType, ModuleKind, type ModuleId, type Project, type ProjectId } from "@/lib/types"
import {
  DEFAULT_FUNCTION_ID,
  addPipelineFunction,
  functionsOnProject,
  nextFunctionName,
  patchWithSyncedModules,
  switchActiveFunction,
  syncFunctionsWithModules,
} from "@/lib/pipeline-functions"

function project(over: Partial<Project> = {}): Project {
  return {
    id: "p_1" as ProjectId,
    name: "Pack",
    kind: "blank",
    models: [],
    modules: [
      {
        id: "mod_in" as ModuleId,
        kind: ModuleKind.Input,
        label: "Input",
        note: "",
        inputType: InputType.Text,
        cached: true,
        avgMs: 0,
        avgCostCents: 0,
      },
    ],
    strategies: [],
    ...over,
  }
}

describe("pipeline functions", () => {
  it("treats a project with no functions list as a single Main function", () => {
    const fns = functionsOnProject(project())
    expect(fns).toHaveLength(1)
    expect(fns[0]?.id).toBe(DEFAULT_FUNCTION_ID)
    expect(fns[0]?.name).toBe("Main")
    expect(fns[0]?.modules[0]?.id).toBe("mod_in")
  })

  it("adds a function, keeps Main, and switches modules to the new spine", () => {
    const patch = addPipelineFunction(project(), "Compile")
    expect(patch.functions).toHaveLength(2)
    expect(patch.functions?.[0]?.name).toBe("Main")
    expect(patch.functions?.[1]?.name).toBe("Compile")
    expect(patch.modules?.[0]?.id).not.toBe("mod_in")
    expect(patch.activeFunctionId).toBe(patch.functions?.[1]?.id)
  })

  it("switch restores the other function's modules", () => {
    const added = addPipelineFunction(project(), "Compile")
    const withFns = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const back = switchActiveFunction(withFns, DEFAULT_FUNCTION_ID)
    expect(back.modules?.[0]?.id).toBe("mod_in")
    expect(back.activeFunctionId).toBe(DEFAULT_FUNCTION_ID)
  })

  it("syncs the active function when modules change", () => {
    const added = addPipelineFunction(project(), "Compile")
    const p = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const nextMods = [{ ...p.modules[0]!, label: "Renamed input" }]
    const synced = syncFunctionsWithModules(p, nextMods)
    const active = synced?.find((fn) => fn.id === p.activeFunctionId)
    expect(active?.modules[0]?.label).toBe("Renamed input")
    expect(synced?.find((fn) => fn.id === DEFAULT_FUNCTION_ID)?.modules[0]?.id).toBe("mod_in")
  })

  it("names extra functions Function N", () => {
    expect(nextFunctionName(functionsOnProject(project()))).toBe("Function 2")
  })

  it("patchWithSyncedModules writes the active function spine", () => {
    const added = addPipelineFunction(project(), "Compile")
    const p = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const nextMods = [{ ...p.modules[0]!, label: "Patched" }]
    const patch = patchWithSyncedModules(p, nextMods)
    expect(patch.modules[0]?.label).toBe("Patched")
    expect(patch.functions?.find((fn) => fn.id === p.activeFunctionId)?.modules[0]?.label).toBe("Patched")
    expect(patch.functions?.find((fn) => fn.id === DEFAULT_FUNCTION_ID)?.modules[0]?.id).toBe("mod_in")
  })
})
