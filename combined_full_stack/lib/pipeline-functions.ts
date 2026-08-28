// AI : a project is a group of functions that share structures. Active function is project.modules (run engine).
import { uid } from "@/lib/id"
import {
  InputType,
  ModuleKind,
  type ModuleId,
  type PipelineFunction,
  type PipelineModule,
  type Project,
  type pipeline_function_id,
} from "@/lib/types"

export type { PipelineFunction, pipeline_function_id }

export const DEFAULT_FUNCTION_ID = "main" as pipeline_function_id

export function blankPipelineModules(): PipelineModule[] {
  return [
    {
      id: uid<ModuleId>("mod_"),
      kind: ModuleKind.Input,
      label: "Input",
      note: "Function input",
      inputType: InputType.Text,
      cached: true,
      avgMs: 80,
      avgCostCents: 0,
    },
    {
      id: uid<ModuleId>("mod_"),
      kind: ModuleKind.Output,
      label: "Output",
      note: "",
      cached: true,
      avgMs: 40,
      avgCostCents: 0,
    },
  ]
}

function withLiveModules(project: Project, fns: PipelineFunction[]): PipelineFunction[] {
  const activeId = project.activeFunctionId ?? fns[0]?.id
  return fns.map((fn) => (fn.id === activeId ? { ...fn, modules: project.modules } : fn))
}

export function functionsOnProject(project: Project): PipelineFunction[] {
  if (project.functions && project.functions.length > 0) {
    return withLiveModules(project, project.functions)
  }
  return [
    {
      id: DEFAULT_FUNCTION_ID,
      name: "Main",
      modules: project.modules,
    },
  ]
}

export function activeFunctionId(project: Project): pipeline_function_id {
  const fns = functionsOnProject(project)
  const wanted = project.activeFunctionId
  if (wanted && fns.some((fn) => fn.id === wanted)) return wanted
  return fns[0]!.id
}

export function activeFunction(project: Project): PipelineFunction {
  const id = activeFunctionId(project)
  return functionsOnProject(project).find((fn) => fn.id === id)!
}

export function nextFunctionName(existing: PipelineFunction[]): string {
  let n = existing.length + 1
  const names = new Set(existing.map((fn) => fn.name.toLowerCase()))
  while (names.has(`function ${n}`)) n += 1
  return `Function ${n}`
}

export function switchActiveFunction(project: Project, id: pipeline_function_id): Partial<Project> {
  const fns = functionsOnProject(project)
  const next = fns.find((fn) => fn.id === id) ?? fns[0]!
  return {
    functions: fns,
    activeFunctionId: next.id,
    modules: next.modules,
  }
}

export function addPipelineFunction(project: Project, name?: string): Partial<Project> {
  const fns = functionsOnProject(project)
  const fn: PipelineFunction = {
    id: uid<pipeline_function_id>("fn_"),
    name: (name ?? nextFunctionName(fns)).trim() || nextFunctionName(fns),
    modules: blankPipelineModules(),
  }
  return {
    functions: [...fns, fn],
    activeFunctionId: fn.id,
    modules: fn.modules,
  }
}

export function renamePipelineFunction(
  project: Project,
  id: pipeline_function_id,
  name: string,
): Partial<Project> {
  const trimmed = name.trim()
  if (!trimmed) return {}
  const fns = functionsOnProject(project).map((fn) => (fn.id === id ? { ...fn, name: trimmed } : fn))
  return { functions: fns, activeFunctionId: activeFunctionId(project), modules: project.modules }
}

export function syncFunctionsWithModules(project: Project, modules: PipelineModule[]): PipelineFunction[] | undefined {
  if (!project.functions?.length) return project.functions
  const active = activeFunctionId(project)
  return project.functions.map((fn) => (fn.id === active ? { ...fn, modules } : fn))
}

export function patchWithSyncedModules(
  project: Project,
  modules: PipelineModule[],
): Pick<Project, "modules"> & Partial<Pick<Project, "functions">> {
  const functions = syncFunctionsWithModules({ ...project, modules }, modules)
  return functions !== undefined ? { modules, functions } : { modules }
}
