import { describe, expect, it } from "vitest"
import { InputType, ModuleKind, type ModuleId, type Project, type ProjectId } from "@/lib/types"
import {
  DEFAULT_FUNCTION_ID,
  UNNAMED_FUNCTION_NAME,
  addPipelineFunction,
  deletePipelineFunction,
  ensureNamedFunction,
  functionsOnProject,
  nextFunctionName,
  storedFunctionsOnProject,
  patchWithSyncedModules,
  projectForFunction,
  renamePipelineFunction,
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
  it("treats a project with no functions list as a single unnamed function", () => {
    const fns = functionsOnProject(project())
    expect(fns).toHaveLength(1)
    expect(fns[0]?.id).toBe(DEFAULT_FUNCTION_ID)
    expect(fns[0]?.name).toBe(UNNAMED_FUNCTION_NAME)
    expect(fns[0]?.modules[0]?.id).toBe("mod_in")
  })

  it("adds a function, keeps the unnamed function, and switches modules to the new spine", () => {
    const patch = addPipelineFunction(project(), "Compile")
    expect(patch.functions).toHaveLength(2)
    expect(patch.functions?.[0]?.name).toBe(UNNAMED_FUNCTION_NAME)
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

  it("names extra functions unnamed function N", () => {
    expect(nextFunctionName([])).toBe(UNNAMED_FUNCTION_NAME)
    expect(nextFunctionName(functionsOnProject(project()))).toBe("unnamed function 2")
    const added = addPipelineFunction(project())
    expect(added.functions?.[1]?.name).toBe("unnamed function 2")
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

  it("ensureNamedFunction adds by name or switches to an existing one", () => {
    const added = ensureNamedFunction(project(), "Summarize")
    expect(added.functions).toHaveLength(2)
    expect(added.functions?.[1]?.name).toBe("Summarize")
    const withFns = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const back = ensureNamedFunction(withFns, UNNAMED_FUNCTION_NAME)
    expect(back.activeFunctionId).toBe(DEFAULT_FUNCTION_ID)
    expect(back.modules?.[0]?.id).toBe("mod_in")
  })

  it("projectForFunction returns that function's modules", () => {
    const added = addPipelineFunction(project(), "Compile")
    const p = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const main = projectForFunction(p, DEFAULT_FUNCTION_ID)
    expect(main?.modules[0]?.id).toBe("mod_in")
    expect(projectForFunction(p, "fn_missing")).toBeNull()
  })

  it("engine reads stored functions[].modules, not the live-spine overlay", () => {
    const added = addPipelineFunction(project(), "Compile")
    const compileId = added.functions![1]!.id
    const dirty = project({
      functions: added.functions,
      activeFunctionId: compileId,
      modules: [
        {
          id: "mod_dirty" as ModuleId,
          kind: ModuleKind.Input,
          label: "Dirty live spine",
          note: "",
          inputType: InputType.Text,
          cached: true,
          avgMs: 0,
          avgCostCents: 0,
        },
      ],
    })
    expect(functionsOnProject(dirty).find((fn) => fn.id === compileId)?.modules[0]?.id).toBe("mod_dirty")
    expect(storedFunctionsOnProject(dirty).find((fn) => fn.id === compileId)?.modules[0]?.id).not.toBe(
      "mod_dirty",
    )
    expect(projectForFunction(dirty, compileId)?.modules[0]?.id).not.toBe("mod_dirty")
    expect(projectForFunction(dirty, DEFAULT_FUNCTION_ID)?.modules[0]?.id).toBe("mod_in")
    expect(projectForFunction(dirty)?.modules[0]?.id).not.toBe("mod_dirty")
  })

  it("renames a function and treats a blank name as unnamed function", () => {
    const added = addPipelineFunction(project(), "Compile")
    const p = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const id = added.functions![1]!.id
    const renamed = renamePipelineFunction(p, id, "  Score  ")
    expect(renamed.functions?.find((fn) => fn.id === id)?.name).toBe("Score")
    const blank = renamePipelineFunction({ ...p, functions: renamed.functions }, id, "   ")
    expect(blank.functions?.find((fn) => fn.id === id)?.name).toBe(UNNAMED_FUNCTION_NAME)
  })

  it("deletes a function and switches off it when it was active", () => {
    const added = addPipelineFunction(project(), "Compile")
    const p = project({
      functions: added.functions,
      activeFunctionId: added.activeFunctionId,
      modules: added.modules!,
    })
    const extraId = added.functions![1]!.id
    const patch = deletePipelineFunction(p, extraId)
    expect(patch.functions).toHaveLength(1)
    expect(patch.functions?.[0]?.name).toBe(UNNAMED_FUNCTION_NAME)
    expect(patch.activeFunctionId).toBe(DEFAULT_FUNCTION_ID)
    expect(patch.modules?.[0]?.id).toBe("mod_in")
    expect(deletePipelineFunction({ ...p, ...patch }, DEFAULT_FUNCTION_ID)).toEqual({})
  })
})
