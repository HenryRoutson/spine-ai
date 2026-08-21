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
import { cn } from "@/lib/utils"
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
  // AI : vibe/simple — no type names or "JSON" in the helper copy.
  plain?: boolean
}

export function InferenceJsonStructEditor({
  kind,
  schema,
  modelName,
  seedDoc = null,
  disabled = false,
  onAssigned,
  source,
  plain = false,
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
  const shownLoadError =
    plain && loadError?.startsWith("Not valid JSON")
      ? "This file could not be opened as a form."
      : loadError
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
      <p className={cn(plain ? "text-xs text-muted-foreground" : "font-mono text-[10px] text-muted-foreground")}>
        {plain
          ? kind === "empty"
            ? "Fill in the fields, then save."
            : seedDoc
              ? `Starting from ${seedDoc.name} — the original file is not changed.`
              : "Pick a file to start from."
          : kind === "empty"
            ? `New ${modelName} values — saved as its own file when you apply`
            : seedDoc
              ? `Branched from ${seedDoc.name} — source stays unchanged`
              : `Branch ${modelName} from a store file`}
      </p>
      {loading ? (
        <p className={cn("flex items-center gap-1.5 text-muted-foreground", plain ? "text-sm" : "font-mono text-[11px]")}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {plain ? "Loading…" : "loading…"}
        </p>
      ) : shownLoadError && kind === "branch" && !seedDoc ? (
        <p className={cn("text-muted-foreground", plain ? "text-xs" : "font-mono text-[10px]")}>{shownLoadError}</p>
      ) : shownLoadError ? (
        <p className={cn("text-destructive", plain ? "text-sm" : "font-mono text-[10px]")}>{shownLoadError}</p>
      ) : (
        <>
          <SchemaJsonEditor schema={schema} text={text} onText={setText} formOnly />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn(plain ? "text-xs text-muted-foreground" : "font-mono text-[9px] text-muted-foreground")}>
              {preview
                ? "Sign in to save"
                : workingDoc
                  ? `Saved as ${workingDoc.name}`
                  : plain
                    ? "Save to use this as the file for this step"
                    : "Apply creates a new file and assigns it to this slot"}
            </p>
            <div className="flex items-center gap-2">
              {saveError && (
                <p className={cn("text-destructive", plain ? "text-sm" : "font-mono text-[10px]")}>{saveError}</p>
              )}
              <Button
                type="button"
                size="sm"
                className={cn("h-7", !plain && "font-mono text-[10px]")}
                disabled={!canApply}
                onClick={() => void apply()}
              >
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {plain ? "Save" : "Apply"}
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
