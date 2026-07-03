"use client"

// AI : structured form over *_testing.json — input docs use the same slot + picker UI as the
// AI : Inference tab; expected values render with the logging viewers (JsonHighlight + PopupModal)
// AI : and can be captured one-click from the last run. Serialization stays compatible with
// AI : lib/testing-files parse/validate.

import { useState } from "react"
import {
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleX,
  Download,
  Maximize2,
  MinusCircle,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { JsonHighlight } from "@/components/highlight"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { isMultiDocInputModule } from "@/lib/inference-input"
import { useDocViewer } from "@/lib/doc-viewer"
import { modelName } from "@/lib/validity"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import { tryParseJson } from "@/lib/json-utils"
import { inputModulesOf, probabilisticPathsForModule, type SpineTestFile } from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import type { DocId, DocRef, PipelineModule, Project } from "@/lib/types"

type step_label_string = string
type doc_name_string = string
type json_text_string = string

// AI : expected values live as editable JSON text so half-typed input never gets lost.
// AI : deterministic-ness is not per test — it lives on structure fields (Structures tab).
export type TestDraft = {
  description: string
  inputs: Record<step_label_string, doc_name_string[]>
  expected: { label: step_label_string; text: json_text_string }[]
}

export function draftFromTest(test: SpineTestFile): TestDraft {
  return {
    description: test.description ?? "",
    inputs: Object.fromEntries(
      Object.entries(test.inputs ?? {}).map(([label, v]) => [label, Array.isArray(v) ? v : [v]]),
    ),
    expected: Object.entries(test.expectedOutputs).map(([label, v]) => ({
      label,
      text: JSON.stringify(v, null, 2),
    })),
  }
}

// AI : null when some expected value is not valid JSON yet — caller disables Save.
export function draftToContent(draft: TestDraft): string | null {
  const expectedOutputs: Record<step_label_string, unknown> = {}
  for (const row of draft.expected) {
    const parsed = tryParseJson(row.text, { trim: true })
    if (!parsed.ok) return null
    expectedOutputs[row.label] = parsed.value
  }
  const inputs: NonNullable<SpineTestFile["inputs"]> = {}
  for (const [label, names] of Object.entries(draft.inputs)) {
    const clean = names.filter((n) => n.trim())
    inputs[label] = clean.length === 1 ? clean[0] : clean
  }
  const file: SpineTestFile = {
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    inputs,
    expectedOutputs,
  }
  return JSON.stringify(file, null, 2)
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10px] uppercase text-muted-foreground">{children}</p>
}

function sameStep(a: step_label_string, b: step_label_string): boolean {
  return labelAsStateKey(a) === labelAsStateKey(b)
}

type RowIssue = { level: "error" | "warning"; message: string }

function expectedIssue(
  row: TestDraft["expected"][number],
  project: Project,
  stale: boolean,
): RowIssue | null {
  if (stale) return { level: "error", message: "step no longer exists in the pipeline — remove this entry" }
  const parsed = tryParseJson(row.text, { trim: true })
  if (!parsed.ok) return { level: "error", message: `invalid JSON: ${parsed.error.message}` }
  if (parsed.value === null)
    return { level: "warning", message: "placeholder — write the expected output or capture it from a run" }
  const check = validatePipelineStateEntry(labelAsStateKey(row.label), parsed.value, project)
  if (!check.ok)
    return { level: "error", message: `value does not match this step's output type:\n${check.error}` }
  return null
}

// AI : error-level draft problems that should block Run (warnings like placeholders are runnable).
export function draftHasErrors(draft: TestDraft, project: Project): boolean {
  return draft.expected.some((row) => {
    const stale = !project.modules.some((m) => sameStep(m.label, row.label))
    return expectedIssue(row, project, stale)?.level === "error"
  })
}

export function TestFileEditor({
  draft,
  setDraft,
  project,
  projectDocs,
  actuals,
}: {
  draft: TestDraft
  setDraft: (d: TestDraft) => void
  project: Project
  projectDocs: DocRef[]
  // AI : step key → actual output from the last test run, for one-click capture
  actuals: Map<step_label_string, unknown>
}) {
  const inputMods = inputModulesOf(project.modules)
  const [pickerModule, setPickerModule] = useState<PipelineModule | null>(null)
  const [popup, setPopup] = useState<PopupPayload | null>(null)
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

  // AI : the file stores doc *names*; slots and the picker speak DocRef — convert at the edge.
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

  const rowFor = (label: step_label_string) => draft.expected.find((r) => sameStep(r.label, label))
  const setRowText = (label: step_label_string, text: json_text_string) =>
    setDraft({
      ...draft,
      expected: draft.expected.map((r) => (r.label === label ? { ...r, text } : r)),
    })
  const removeRow = (label: step_label_string) =>
    setDraft({ ...draft, expected: draft.expected.filter((r) => r.label !== label) })
  const trackStep = (m: PipelineModule) => {
    const key = labelAsStateKey(m.label)
    // AI : seed from the project's golden outputs when available (same as the skeleton file)
    const golden = project.expectedOutputs?.[key]
    setDraft({
      ...draft,
      expected: [...draft.expected, { label: key, text: JSON.stringify(golden ?? null, null, 2) }],
    })
  }

  // AI : render in pipeline order; input-kind steps only show if the file already pins them
  const stepMods = project.modules.filter((m) => m.kind !== "input" || rowFor(m.label))
  const staleRows = draft.expected.filter(
    (r) => !project.modules.some((m) => sameStep(m.label, r.label)),
  )

  return (
    <div className="space-y-4">
      <section>
        <SectionLabel>description</SectionLabel>
        <Input
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          placeholder="What does this test check?"
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

      <section>
        <SectionLabel>expected step outputs</SectionLabel>
        <ul className="mt-1.5 space-y-1.5">
          {stepMods.map((m) => {
            const row = rowFor(m.label)
            return row ? (
              <ExpectedRow
                key={m.id}
                row={row}
                project={project}
                stale={false}
                ignoredFields={probabilisticPathsForModule(m, project.models)}
                actual={actuals.has(labelAsStateKey(m.label)) ? actuals.get(labelAsStateKey(m.label)) : undefined}
                onText={(text) => setRowText(row.label, text)}
                onRemove={() => removeRow(row.label)}
                onExpand={setPopup}
              />
            ) : (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-md border border-dashed border-border/70 px-2.5 py-1.5"
              >
                <MinusCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                  {m.label}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">not checked</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-1.5 font-mono text-[10px]"
                  onClick={() => trackStep(m)}
                >
                  <Plus className="mr-1 h-3 w-3" /> check this step
                </Button>
              </li>
            )
          })}
          {staleRows.map((row) => (
            <ExpectedRow
              key={row.label}
              row={row}
              project={project}
              stale
              ignoredFields={[]}
              actual={undefined}
              onText={(text) => setRowText(row.label, text)}
              onRemove={() => removeRow(row.label)}
              onExpand={setPopup}
            />
          ))}
        </ul>
      </section>

      {pickerModule && (
        <InferenceInputPickerPopup
          inputModule={pickerModule}
          selectedDocIds={slotDocs(pickerModule).map((d) => d.id)}
          onSelect={(doc) => selectDoc(pickerModule, doc)}
          onClose={() => setPickerModule(null)}
        />
      )}
      {popup && <PopupModal payload={popup} onClose={() => setPopup(null)} />}
    </div>
  )
}

function ExpectedRow({
  row,
  project,
  stale,
  ignoredFields,
  actual,
  onText,
  onRemove,
  onExpand,
}: {
  row: TestDraft["expected"][number]
  project: Project
  stale: boolean
  // AI : probabilistic field paths per structure defs — shown so it's clear what won't be compared
  ignoredFields: string[]
  actual: unknown
  onText: (text: json_text_string) => void
  onRemove: () => void
  onExpand: (payload: PopupPayload) => void
}) {
  const issue = expectedIssue(row, project, stale)
  const [open, setOpen] = useState(issue?.level === "error")
  const [editing, setEditing] = useState(false)
  const isPlaceholder = row.text.trim() === "null"
  const validJson = tryParseJson(row.text, { trim: true }).ok
  const preview = row.text.replace(/\s+/g, " ").trim()
  return (
    <li className={cn("rounded-md border", issue?.level === "error" ? "border-destructive/40" : "border-border")}>
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
        >
          {open ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {issue === null ? (
            <CircleCheck className="h-3.5 w-3.5 shrink-0 text-chart-2" />
          ) : issue.level === "error" ? (
            <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          )}
          <span className="shrink-0 font-mono text-[11px]">{row.label}</span>
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
            {isPlaceholder ? "placeholder — no expected output yet" : preview}
          </span>
        </button>
        {actual !== undefined && !stale && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 shrink-0 px-1.5 font-mono text-[10px] text-primary"
            title="copy the last run's actual output into expected"
            onClick={() => {
              onText(JSON.stringify(actual, null, 2))
              setEditing(false)
              setOpen(true)
            }}
          >
            <Download className="mr-1 h-3 w-3" /> use run output
          </Button>
        )}
        {!stale && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 shrink-0", editing ? "text-primary" : "text-muted-foreground")}
            title="edit the expected value"
            onClick={() => {
              setEditing((v) => !v)
              setOpen(true)
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {!isPlaceholder && (
          <button
            type="button"
            onClick={() =>
              onExpand(
                validJson
                  ? { json: row.text, title: `expected output · ${row.label}` }
                  : { text: row.text, title: `expected output · ${row.label}` },
              )
            }
            className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Open in full-screen viewer"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        )}
        <IconTrashButton onClick={onRemove} />
      </div>
      {open && (
        <div className="space-y-1.5 border-t border-border p-2.5">
          {ignoredFields.length > 0 && (
            <p className="flex items-start gap-1.5 font-mono text-[10px] text-muted-foreground">
              <Shuffle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                probabilistic fields (marked on the structure) are ignored when comparing:{" "}
                {ignoredFields.join(", ")}
              </span>
            </p>
          )}
          {editing ? (
            <Textarea
              value={row.text}
              onChange={(e) => onText(e.target.value)}
              className="min-h-[80px] font-mono text-[11px]"
              spellCheck={false}
              autoFocus
            />
          ) : isPlaceholder ? (
            <p className="font-mono text-[11px] text-muted-foreground">
              No expected output pinned yet — run the test once and click{" "}
              <span className="text-primary">use run output</span>, or edit it by hand.
            </p>
          ) : (
            // AI : same viewer as Logging step outputs — highlighted, expandable, never a raw textarea
            <div className="max-h-72 overflow-auto rounded border border-border bg-muted/20 p-2">
              <JsonHighlight json={row.text} />
            </div>
          )}
          {issue && (
            <p
              className={cn(
                "max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[10px]",
                issue.level === "error" ? "text-destructive" : "text-yellow-500",
              )}
            >
              {issue.message}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

function IconTrashButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground" onClick={onClick}>
      <Trash2 className="h-3 w-3" />
    </Button>
  )
}
