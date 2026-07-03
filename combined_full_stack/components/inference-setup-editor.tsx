"use client"

// AI : structured form over *_inference.json — same input slot UI as Testing / Inference run slots.

import { useState } from "react"
import { CircleX, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { isMultiDocInputModule } from "@/lib/inference-input"
import { useDocViewer } from "@/lib/doc-viewer"
import { labelAsStateKey } from "@/lib/server/pipeline_state"
import { inputModulesOf, type SpineInferenceSetupFile } from "@/lib/inference-setup-files"
import { modelName } from "@/lib/validity"
import type { DocId, DocRef, PipelineModule, Project } from "@/lib/types"

type step_label_string = string
type doc_name_string = string

export type SetupDraft = {
  description: string
  inputs: Record<step_label_string, doc_name_string[]>
}

export function draftFromSetup(setup: SpineInferenceSetupFile): SetupDraft {
  return {
    description: setup.description ?? "",
    inputs: Object.fromEntries(
      Object.entries(setup.inputs ?? {}).map(([label, v]) => [label, Array.isArray(v) ? v : [v]]),
    ),
  }
}

export function draftToSetupContent(draft: SetupDraft): string {
  const inputs: SpineInferenceSetupFile["inputs"] = {}
  for (const [label, names] of Object.entries(draft.inputs)) {
    const clean = names.filter((n) => n.trim())
    if (clean.length === 1) inputs[label] = clean[0]!
    else if (clean.length > 1) inputs[label] = clean
  }
  const file: SpineInferenceSetupFile = {
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    inputs,
  }
  return JSON.stringify(file, null, 2)
}

function sameStep(a: step_label_string, b: step_label_string): boolean {
  return labelAsStateKey(a) === labelAsStateKey(b)
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase text-muted-foreground">{children}</p>
}

export function InferenceSetupEditor({
  draft,
  setDraft,
  project,
  projectDocs,
}: {
  draft: SetupDraft
  setDraft: (d: SetupDraft) => void
  project: Project
  projectDocs: DocRef[]
}) {
  const inputMods = inputModulesOf(project.modules)
  const [pickerModule, setPickerModule] = useState<PipelineModule | null>(null)
  const { open: openDoc } = useDocViewer()

  const staleInputKeys = Object.keys(draft.inputs).filter(
    (label) => !inputMods.some((m) => sameStep(m.label, label)),
  )

  const setInputNames = (key: step_label_string, names: doc_name_string[]) =>
    setDraft({ ...draft, inputs: { ...draft.inputs, [key]: names } })
  const removeInputKey = (key: step_label_string) => {
    const { [key]: _gone, ...rest } = draft.inputs
    setDraft({ ...draft, inputs: rest })
  }

  const keyFor = (m: PipelineModule) =>
    Object.keys(draft.inputs).find((l) => sameStep(l, m.label)) ?? labelAsStateKey(m.label)
  const namesFor = (m: PipelineModule) => draft.inputs[keyFor(m)] ?? []
  const slotDocs = (m: PipelineModule) =>
    namesFor(m)
      .map((n) => projectDocs.find((d) => d.name === n))
      .filter((d): d is DocRef => d != null)
  const selectDoc = (m: PipelineModule, doc: DocRef) => {
    const names = namesFor(m)
    setInputNames(
      keyFor(m),
      isMultiDocInputModule(m) ? (names.includes(doc.name) ? names : [...names, doc.name]) : [doc.name],
    )
    setPickerModule(null)
  }
  const removeDocName = (m: PipelineModule, name: doc_name_string) =>
    setInputNames(keyFor(m), namesFor(m).filter((n) => n !== name))

  return (
    <div className="space-y-4">
      <section>
        <SectionLabel>description</SectionLabel>
        <Input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="e.g. 10th grade homework batch"
          className="mt-1.5 h-8 text-xs"
        />
      </section>

      <section>
        <SectionLabel>input documents</SectionLabel>
        <div className="mt-1.5 space-y-2">
          {inputMods.length === 0 && (
            <p className="text-xs text-muted-foreground">The pipeline has no input steps.</p>
          )}
          {inputMods.map((m) => {
            const missing = namesFor(m).filter((n) => n.trim() && !projectDocs.some((d) => d.name === n))
            return (
              <div key={m.id} className="space-y-1">
                <InferenceInputSlot
                  inputModule={m}
                  outModel={modelName(project.models, m.outStructureId)}
                  docs={slotDocs(m)}
                  issue={
                    missing.length
                      ? { message: `not found in this project: ${missing.join(", ")}` }
                      : undefined
                  }
                  onOpenPicker={() => setPickerModule(m)}
                  onOpenDoc={(docId: DocId) => openDoc({ docId, start: 0, end: 0 })}
                  onRemoveDoc={(docId: DocId) => {
                    const doc = projectDocs.find((d) => d.id === docId)
                    if (doc) removeDocName(m, doc.name)
                  }}
                />
                {missing.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 rounded-md border border-destructive/40 px-2.5 py-1.5"
                  >
                    <CircleX className="h-3 w-3 shrink-0 text-destructive" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-destructive">{name}</span>
                    <IconTrashButton onClick={() => removeDocName(m, name)} />
                  </div>
                ))}
              </div>
            )
          })}
          {staleInputKeys.map((key) => (
            <div
              key={key}
              className="flex items-center gap-2 rounded-md border border-destructive/40 px-2.5 py-2"
            >
              <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{key}</span>
              <span className="font-mono text-[10px] text-destructive">not an input step anymore</span>
              <IconTrashButton onClick={() => removeInputKey(key)} />
            </div>
          ))}
        </div>
      </section>

      {pickerModule && (
        <InferenceInputPickerPopup
          inputModule={pickerModule}
          selectedDocIds={slotDocs(pickerModule).map((d) => d.id)}
          onSelect={(doc) => selectDoc(pickerModule, doc)}
          onClose={() => setPickerModule(null)}
        />
      )}
    </div>
  )
}

function IconTrashButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={onClick}>
      <Trash2 className="h-3 w-3" />
    </Button>
  )
}
