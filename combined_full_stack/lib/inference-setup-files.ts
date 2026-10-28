// AI : *_inference.json — named input setups for the Inference tab (same inputs shape as *_testing.json).
// AI : validated against the live pipeline since labels and doc names drift.

import { namedInputDocNames, resolveNamedRunInputs, type NamedRunInputs, type ResolvedNamedInputs } from "@/lib/inference-presets"
import { validateInferenceDocAssignment, validateInferenceDocContent } from "@/lib/inference-validity"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { tryParseJson } from "@/lib/json-utils"
import { ModuleKind } from "@/lib/types"
import type { DocRef, PipelineModule, Project } from "@/lib/types"

export const INFERENCE_SETUP_SUFFIX = "_inference.json"

type step_label_string = string
type doc_name_string = string

export type SpineInferenceSetupFile = {
  description?: string
  inputs: NamedRunInputs
}

export type SetupFileIssue = {
  level: "error" | "warning"
  where: string
  message: string
}

export type SetupParseResult =
  | { ok: true; setup: SpineInferenceSetupFile }
  | { ok: false; error: string }

export function isInferenceSetupFileName(name: string): boolean {
  return name.toLowerCase().endsWith(INFERENCE_SETUP_SUFFIX)
}

export function parseInferenceSetupFile(content: string): SetupParseResult {
  const parsed = tryParseJson(content, { trim: true })
  if (!parsed.ok) return { ok: false, error: `invalid json: ${parsed.error.message}` }
  const value = parsed.value
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "setup file must be a JSON object" }
  }
  const obj = value as Record<string, unknown>
  const inputs = obj.inputs
  if (inputs === null || typeof inputs !== "object" || Array.isArray(inputs)) {
    return { ok: false, error: 'missing "inputs" object (input step label → doc name)' }
  }
  return {
    ok: true,
    setup: {
      description: typeof obj.description === "string" ? obj.description : undefined,
      inputs: inputs as NamedRunInputs,
    },
  }
}

function moduleByLabel(modules: PipelineModule[], label: string): PipelineModule | undefined {
  return modules.find((m) => labelAsStateKey(m.label) === labelAsStateKey(label))
}

export function inputModulesOf(modules: PipelineModule[]): PipelineModule[] {
  return modules.filter((m) => m.kind === ModuleKind.Input)
}

const docNames = namedInputDocNames

// AI : shared with *_testing.json — one validator for "label → doc name(s)" maps.
export function validateNamedInputs(
  inputs: NamedRunInputs,
  project: Project,
  projectDocs: DocRef[],
  jsonContentByName?: Record<string, string>,
): SetupFileIssue[] {
  const issues: SetupFileIssue[] = []
  const modules = project.modules

  for (const [label, value] of Object.entries(inputs)) {
    const mod = moduleByLabel(modules, label)
    if (!mod) {
      issues.push({ level: "error", where: label, message: "input step not found in the pipeline" })
      continue
    }
    if (mod.kind !== ModuleKind.Input) {
      issues.push({ level: "error", where: label, message: `"${label}" is a ${mod.kind} step, not an input` })
      continue
    }
    const names = docNames(value)
    if (!names.length) {
      issues.push({ level: "warning", where: label, message: "no document name set for this input" })
    }
    for (const name of names) {
      const doc = projectDocs.find((d) => d.name === name)
      if (!doc) {
        issues.push({ level: "error", where: label, message: `document "${name}" not found in this project` })
        continue
      }
      const assignmentIssue = validateInferenceDocAssignment(mod, doc)
      if (assignmentIssue) {
        issues.push({ level: "error", where: label, message: `${name}: ${assignmentIssue.message}` })
        continue
      }
      const content = jsonContentByName?.[name]
      if (content !== undefined) {
        const spineIssue = validateInferenceDocContent(mod, doc, content, {
          models: project.models,
          typeAliases: project.typeAliases,
        })
        if (spineIssue) {
          issues.push({ level: "error", where: label, message: `${name}: ${spineIssue.message}` })
        }
      }
    }
  }
  for (const m of inputModulesOf(modules)) {
    if (
      !(labelAsStateKey(m.label) in inputs) &&
      !Object.keys(inputs).some((l) => labelAsStateKey(l) === labelAsStateKey(m.label))
    ) {
      issues.push({
        level: "warning",
        where: m.label,
        message: "input step has no document assigned — assign one before running",
      })
    }
  }
  return issues
}

export function validateInferenceSetupFile(
  setup: SpineInferenceSetupFile,
  project: Project,
  projectDocs: DocRef[],
  jsonContentByName?: Record<string, string>,
): SetupFileIssue[] {
  return validateNamedInputs(setup.inputs ?? {}, project, projectDocs, jsonContentByName)
}

export type ResolvedSetupInputs = ResolvedNamedInputs

export function resolveInferenceSetupInputs(
  setup: SpineInferenceSetupFile,
  modules: PipelineModule[],
  projectDocs: DocRef[],
): ResolvedSetupInputs {
  return resolveNamedRunInputs(setup.inputs ?? {}, modules, projectDocs)
}

export function inferenceSetupSkeleton(project: Project): string {
  const inputs: Record<step_label_string, doc_name_string> = {}
  for (const m of inputModulesOf(project.modules)) {
    inputs[labelAsStateKey(m.label)] = ""
  }
  const skeleton: SpineInferenceSetupFile = {
    description: "Describe this run setup",
    inputs,
  }
  return JSON.stringify(skeleton, null, 2)
}

export function nextInferenceSetupFileName(existing: DocRef[]): string {
  const taken = new Set(existing.map((d) => d.name))
  for (let n = 1; ; n++) {
    const name = `setup_${n}${INFERENCE_SETUP_SUFFIX}`
    if (!taken.has(name)) return name
  }
}

export function setupDisplayName(docName: string): string {
  return docName.endsWith(INFERENCE_SETUP_SUFFIX)
    ? docName.slice(0, -INFERENCE_SETUP_SUFFIX.length) || docName
    : docName
}
