"use client"

import { useMemo } from "react"
import {
  CODE_LANG_LABEL,
  MultiLangReadonlyCodeViewer,
  type MultiLangCodeSource,
} from "@/components/code-viewer"
// AI : same model codegen as pipeline export (py / ts / rust).
import { allModelsToDts, allModelsToPydantic, allModelsToRust } from "@/lib/pydantic"
import type { StructureModel, TypeAlias } from "@/lib/types"

export function StructureCodeView({
  models,
  typeAliases,
}: {
  models: StructureModel[]
  typeAliases: TypeAlias[]
}) {
  const sources = useMemo<MultiLangCodeSource[]>(
    () => [
      {
        language: "python",
        label: CODE_LANG_LABEL.python,
        filename: "models.py",
        content: allModelsToPydantic(models, typeAliases),
      },
      {
        language: "typescript",
        label: CODE_LANG_LABEL.typescript,
        filename: "models.d.ts",
        content: allModelsToDts(models, typeAliases),
      },
      {
        language: "rust",
        label: CODE_LANG_LABEL.rust,
        filename: "models.rs",
        content: allModelsToRust(models, typeAliases),
      },
    ],
    [models, typeAliases],
  )

  return <MultiLangReadonlyCodeViewer sources={sources} defaultLanguage="python" />
}
