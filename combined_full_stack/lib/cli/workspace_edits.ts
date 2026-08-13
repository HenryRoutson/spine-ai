// AI : workspace mutations shared by direct `spine session` commands and the Ink TUI.

import { FieldType, ModuleKind } from "@/lib/types"
import type { StructureModel, StructureModelId } from "@/lib/types"
import type { SpineSession } from "@/lib/core/session"
import { uid } from "@/lib/id"

export function addNamedModel(session: SpineSession, name: string): StructureModel {
  const trimmed = name.trim()
  if (!trimmed) throw new Error("model name is empty")
  const model: StructureModel = {
    id: uid<StructureModelId>("m_"),
    name: trimmed,
    description: "",
    fields: [
      {
        id: uid("f_"),
        name: "summary",
        type: FieldType.Text,
        optional: false,
        description: "Short summary",
      },
    ],
  }
  const models = [...(session.project?.models ?? []), model]
  const modules = session.modules.map((m) =>
    m.kind === ModuleKind.Output ? { ...m, inStructureId: model.id, outStructureId: model.id } : m,
  )
  session.applyProjectChanges({ models, modules })
  return model
}
