// AI : JSON Schema for a pipeline step's spine output — drives the guided form in Testing.

import { z } from "zod"
import { pipelineStateFields } from "@/lib/server/pipeline_state"
import { typeExprToZod } from "@/lib/server/type_expr"
import type { Project } from "@/lib/types"

export function stepOutputJsonSchema(
  project: Project,
  label: string,
): Record<string, unknown> | null {
  const key = label.trim()
  const field = pipelineStateFields(project).find((f) => f.label === key)
  if (!field?.type) return null
  const zodSchema = typeExprToZod(field.type, project.models, new Set(), false, project.typeAliases ?? [])
  return z.toJSONSchema(zodSchema) as Record<string, unknown>
}
