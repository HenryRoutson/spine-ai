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
export const UNNAMED_FUNCTION_NAME = "unnamed function"

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
      name: UNNAMED_FUNCTION_NAME,
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
  const names = new Set(existing.map((fn) => fn.name.toLowerCase()))
  if (!names.has(UNNAMED_FUNCTION_NAME)) return UNNAMED_FUNCTION_NAME
  let n = 2
  while (names.has(`${UNNAMED_FUNCTION_NAME} ${n}`)) n += 1
  return `${UNNAMED_FUNCTION_NAME} ${n}`
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

export function ensureNamedFunction(project: Project, name: string): Partial<Project> {
  const trimmed = name.trim()
  if (!trimmed) return {}
  const fns = functionsOnProject(project)
  const match = fns.find((fn) => fn.name.toLowerCase() === trimmed.toLowerCase())
  if (match) return switchActiveFunction(project, match.id)
  return addPipelineFunction(project, trimmed)
}

export function projectForFunction(project: Project, functionId?: string | null): Project | null {
  const fns = functionsOnProject(project)
  const wanted = (functionId as pipeline_function_id | undefined) ?? DEFAULT_FUNCTION_ID
  const fn = fns.find((row) => row.id === wanted)
  if (!fn) return null
  return {
    ...project,
    modules: fn.modules,
    activeFunctionId: fn.id,
    functions: fns,
  }
}

export function functionNameOnProject(project: Project, functionId?: string | null): string {
  const fns = functionsOnProject(project)
  const match = fns.find((fn) => fn.id === functionId)
  if (match) return match.name
  if (!functionId || functionId === DEFAULT_FUNCTION_ID) return UNNAMED_FUNCTION_NAME
  return "Unknown function"
}

export function functionsPromptSummary(project: Project): string {
  const active = activeFunctionId(project)
  const lines = functionsOnProject(project).map((fn) => {
    const steps = fn.modules.map((m) => m.label).join(" → ") || "(empty)"
    return `- ${fn.name}${fn.id === active ? " (active)" : ""}: ${steps}`
  })
  return `Functions in this project (structures are shared; each function is a named pipeline):\n${lines.join("\n")}`
}

export function renamePipelineFunction(
  project: Project,
  id: pipeline_function_id,
  name: string,
): Partial<Project> {
  const trimmed = name.trim() || UNNAMED_FUNCTION_NAME
  const fns = functionsOnProject(project)
  if (!fns.some((fn) => fn.id === id)) return {}
  return {
    functions: fns.map((fn) => (fn.id === id ? { ...fn, name: trimmed } : fn)),
    activeFunctionId: activeFunctionId(project),
    modules: project.modules,
  }
}

// AI : last function stays — a project always has at least one pipeline.
export function deletePipelineFunction(
  project: Project,
  id: pipeline_function_id,
): Partial<Project> {
  const fns = functionsOnProject(project)
  if (fns.length <= 1) return {}
  const index = fns.findIndex((fn) => fn.id === id)
  if (index < 0) return {}
  const remaining = fns.filter((fn) => fn.id !== id)
  const active = activeFunctionId(project)
  const next =
    id === active
      ? remaining[Math.max(0, index - 1)]!
      : remaining.find((fn) => fn.id === active) ?? remaining[0]!
  return {
    functions: remaining,
    activeFunctionId: next.id,
    modules: next.modules,
  }
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
