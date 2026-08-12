"use client"

// AI : guided values for Inference JSON struct — empty or branch; never edits the source file in place.

import { useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { SchemaJsonEditor } from "@/components/schema-json-editor"
import { Button } from "@/components/ui/button"
import { isPreviewOnly } from "@/lib/demo-mode"
import { suggestEditDocName } from "@/lib/doc-edit"
import { fetchDocText, docTextContent, invalidateDocText } from "@/lib/doc-text-cache"
import { stablePrettyJsonForEdit } from "@/lib/deep_equal"
import { docsForProject } from "@/lib/project-docs"
import { tryParseJson } from "@/lib/json-utils"
import { defaultFromSchema, jsonSchemaToFormRoot, validateFormData } from "@/lib/schema-form"
import { useOptionalStore } from "@/lib/store"
import { DocLabel, InputType, type DocId, type DocRef, type Project } from "@/lib/types"

export type JsonStructFormKind = "empty" | "branch"

// AI : share/run consumer shell has no StoreProvider — parent injects docs + save.
export type InferenceJsonStructDocSource = {
  docs: DocRef[]
  project: Project | null
  addDocContent: (
    name: string,
    type: InputType,
    content: string,
    label: DocLabel,
    projectId?: string,
    replaceDocId?: DocId,
  ) => Promise<DocRef>
}

type InferenceJsonStructEditorProps = {
  kind: JsonStructFormKind
  schema: Record<string, unknown>
  modelName: string
  /** AI : branch seed only — copied into the form; never overwritten. */
  seedDoc?: DocRef | null
  disabled?: boolean
  onAssigned: (doc: DocRef) => void
  source?: InferenceJsonStructDocSource
}

export function InferenceJsonStructEditor({
  kind,
  schema,
  modelName,
  seedDoc = null,
  disabled = false,
  onAssigned,
  source,
}: InferenceJsonStructEditorProps) {
  const store = useOptionalStore()
  const addDocContent = source?.addDocContent ?? store?.addDocContent
  const project = source?.project ?? store?.project ?? null
  const docs = source?.docs ?? store?.docs ?? []
  const projectDocs = useMemo(
    () => (project ? docsForProject(docs, project) : docs),
    [docs, project],
  )
  const [loading, setLoading] = useState(kind === "branch")
  const [loadError, setLoadError] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [workingDoc, setWorkingDoc] = useState<DocRef | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const formRoot = useMemo(() => jsonSchemaToFormRoot(schema), [schema])

  useEffect(() => {
    let cancelled = false
    setWorkingDoc(null)
    setSaveError(null)
    setLoadError(null)

    if (kind === "empty") {
      const fallback = formRoot ? defaultFromSchema(formRoot) : {}
      setText(stablePrettyJsonForEdit(fallback))
      setLoading(false)
      return
    }

    if (!seedDoc) {
      setText("")
      setLoadError("Pick a file to branch from")
      setLoading(false)
      return
    }

    setLoading(true)
    fetchDocText(seedDoc.id as DocId, "parser")
      .then((res) => {
        if (cancelled) return
        const content = docTextContent(res)
        const parsed = tryParseJson(content, { trim: true })
        if (!parsed.ok) {
          setLoadError(`Not valid JSON — ${parsed.error.message}`)
          setText(content)
          setLoading(false)
          return
        }
        setText(stablePrettyJsonForEdit(parsed.value))
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : "Failed to load document")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [kind, seedDoc?.id, formRoot])

  const fieldErrors = formRoot ? validateFormData(safeParse(text), formRoot) : {}
  const formBlocked = Object.keys(fieldErrors).length > 0 || !!loadError
  const preview = isPreviewOnly()
  const canApply =
    !!addDocContent &&
    !loading &&
    !formBlocked &&
    !saving &&
    !disabled &&
    !preview &&
    text.trim().length > 0

  async function apply() {
    if (!canApply || !addDocContent) return
    setSaving(true)
    setSaveError(null)
    try {
      const sourceName =
        workingDoc?.name ??
        seedDoc?.name ??
        `${modelName.replace(/\s+/g, "")}.json`
      const name = workingDoc
        ? workingDoc.name
        : suggestEditDocName(sourceName.endsWith(".json") ? sourceName : `${sourceName}.json`, projectDocs)
      const saved = await addDocContent(
        name,
        InputType.Json,
        text,
        DocLabel.Inference,
        project?.id,
        workingDoc?.id as DocId | undefined,
      )
      invalidateDocText(saved.id)
      if (workingDoc) invalidateDocText(workingDoc.id as DocId)
      setWorkingDoc(saved)
      onAssigned(saved)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] text-muted-foreground">
        {kind === "empty"
          ? `New ${modelName} values — saved as its own file when you apply`
          : seedDoc
            ? `Branched from ${seedDoc.name} — source stays unchanged`
            : `Branch ${modelName} from a store file`}
      </p>
      {loading ? (
        <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…
        </p>
      ) : loadError && kind === "branch" && !seedDoc ? (
        <p className="font-mono text-[10px] text-muted-foreground">{loadError}</p>
      ) : loadError ? (
        <p className="font-mono text-[10px] text-destructive">{loadError}</p>
      ) : (
        <>
          <SchemaJsonEditor schema={schema} text={text} onText={setText} formOnly />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[9px] text-muted-foreground">
              {preview
                ? "Sign in to save"
                : workingDoc
                  ? `Assigned as ${workingDoc.name}`
                  : "Apply creates a new file and assigns it to this slot"}
            </p>
            <div className="flex items-center gap-2">
              {saveError && <p className="font-mono text-[10px] text-destructive">{saveError}</p>}
              <Button
                type="button"
                size="sm"
                className="h-7 font-mono text-[10px]"
                disabled={!canApply}
                onClick={() => void apply()}
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Apply
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}
