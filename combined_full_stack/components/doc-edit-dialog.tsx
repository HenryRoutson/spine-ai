"use client"

// AI : structured fork-edit for JSON docs — original stays; save requires a new name.

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Loader2, X } from "lucide-react"
import { SchemaJsonEditor } from "@/components/schema-json-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  docEditSchemaFromContent,
  suggestEditDocName,
  validateNewDocName,
} from "@/lib/doc-edit"
import { isPreviewOnly } from "@/lib/demo-mode"
import { fetchDocText, docTextContent, invalidateDocText } from "@/lib/doc-text-cache"
import { docsForProject } from "@/lib/project-docs"
import { useStore } from "@/lib/store"
import { InputType, type DocId, type DocRef } from "@/lib/types"
import { stablePrettyJsonForEdit } from "@/lib/deep_equal"
import { tryParseJson } from "@/lib/json-utils"
import { validateFormData, jsonSchemaToFormRoot } from "@/lib/schema-form"

type DocEditDialogProps = {
  doc: DocRef
  onClose: () => void
  onSaved?: (doc: DocRef) => void
}

export function DocEditDialog({ doc, onClose, onSaved }: DocEditDialogProps) {
  const { docs, models, typeAliases, project, addDocContent } = useStore()
  const projectDocs = useMemo(
    () => (project ? docsForProject(docs, project) : docs),
    [docs, project],
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [newName, setNewName] = useState(() => suggestEditDocName(doc.name, projectDocs))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchDocText(doc.id as DocId, "parser")
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
  }, [doc.id])

  // AI : keep suggested name unique as project docs change while the dialog is open.
  useEffect(() => {
    setNewName((prev) => {
      const err = validateNewDocName(prev, doc.name, projectDocs)
      return err ? suggestEditDocName(doc.name, projectDocs) : prev
    })
  }, [doc.name, projectDocs])

  const schemaInfo = useMemo(
    () => docEditSchemaFromContent(text || "{}", models, typeAliases),
    [text, models, typeAliases],
  )
  const formRoot = useMemo(() => jsonSchemaToFormRoot(schemaInfo.schema), [schemaInfo.schema])
  const nameError = validateNewDocName(newName, doc.name, projectDocs)
  const fieldErrors = formRoot ? validateFormData(safeParse(text), formRoot) : {}
  const formBlocked = Object.keys(fieldErrors).length > 0 || !!schemaInfo.parseError
  const canSave = !loading && !formBlocked && !nameError && !saving && !isPreviewOnly()

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      // AI : never pass replaceDocId — edits fork; the source hash stays linked under its name.
      const saved = await addDocContent(
        newName.trim(),
        InputType.Json,
        text,
        doc.label,
        project?.id,
      )
      invalidateDocText(saved.id)
      onSaved?.(saved)
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-[4vh]">
      <button
        aria-label="Close editor"
        className="absolute inset-0 bg-background/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex h-[92vh] w-[min(920px,94vw)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Edit as new file</p>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              Source <span className="text-foreground/80">{doc.name}</span> stays unchanged — save under a new name.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 border-b border-border px-4 py-3">
          <label className="block font-mono text-[10px] uppercase text-muted-foreground">
            New file name
          </label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="h-8 font-mono text-xs"
            spellCheck={false}
            autoFocus
          />
          {nameError && <p className="font-mono text-[10px] text-destructive">{nameError}</p>}
          {schemaInfo.modelName && (
            <p className="font-mono text-[10px] text-muted-foreground">
              Guided by structure <span className="text-foreground/80">{schemaInfo.modelName}</span>
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {loading ? (
            <p className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> loading…
            </p>
          ) : loadError ? (
            <p className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
              {loadError}
            </p>
          ) : schemaInfo.parseError ? (
            <p className="rounded border border-destructive/30 bg-destructive/10 p-2 font-mono text-[11px] text-destructive">
              Not valid JSON — {schemaInfo.parseError}
            </p>
          ) : (
            <SchemaJsonEditor
              schema={schemaInfo.schema}
              text={text}
              onText={setText}
              formOnly
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            {isPreviewOnly() ? "Sign in to save edits" : "Original file is never overwritten"}
          </p>
          <div className="flex items-center gap-2">
            {saveError && <p className="font-mono text-[10px] text-destructive">{saveError}</p>}
            <Button size="sm" variant="outline" className="h-8 bg-transparent" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" className="h-8" disabled={!canSave} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Save as new file
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return {}
  }
}
