"use client"

import { useMemo } from "react"
import {
  CODE_LANG_LABEL,
  MultiLangReadonlyCodeViewer,
  type MultiLangCodeSource,
} from "@/components/code-viewer"
// AI : same model codegen as pipeline export (py / ts / rust / go / baml).
import { allModelsToBaml, allModelsToDts, allModelsToGo, allModelsToPydantic, allModelsToRust } from "@/lib/pydantic"
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
      {
        language: "go",
        label: CODE_LANG_LABEL.go,
        filename: "models.go",
        content: allModelsToGo(models, typeAliases),
      },
      {
        language: "baml",
        label: CODE_LANG_LABEL.baml,
        filename: "models.baml",
        content: allModelsToBaml(models, typeAliases),
      },
    ],
    [models, typeAliases],
  )

  // AI : fill the Structures trailing pane — default min(60vh,28rem) leaves the split undersized / clipped.
  return (
    <MultiLangReadonlyCodeViewer
      sources={sources}
      defaultLanguage="python"
      editorHeight="100%"
      className="min-h-0 min-w-0 flex-1 overflow-hidden"
    />
  )
}
