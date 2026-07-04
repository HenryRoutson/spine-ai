"use client"

// AI : structured form over *_testing.json — input docs use the same slot + picker UI as the
// AI : Inference tab; expected values render with the logging viewers (JsonHighlight + PopupModal)
// AI : and can be captured one-click from the last run. Serialization stays compatible with
// AI : lib/testing-files parse/validate.

import { useMemo, useState } from "react"
import {
  CircleCheck,
  CircleX,
  Download,
  Maximize2,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  TriangleAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { JsonFieldKindHighlight, JsonFieldKindLegend } from "@/components/highlight"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { isMultiDocInputModule } from "@/lib/inference-input"
import { useDocViewer } from "@/lib/doc-viewer"
import { modelName } from "@/lib/validity"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import { SchemaJsonEditor } from "@/components/schema-json-editor"
import { applySchemaDefaults, defaultFromSchema, jsonSchemaToFormRoot } from "@/lib/schema-form"
import { stepOutputJsonSchema } from "@/lib/step-json-schema"
import { tryParseJson } from "@/lib/json-utils"
import {
  inputModulesOf,
  isComparableStep,
  probabilisticPathsForModule,
  skipReasonForTestStep,
  type SpineTestFile,
} from "@/lib/testing-files"
import { cn } from "@/lib/utils"
import { ModuleKind, type DocId, DocRef, PipelineModule, Project } from "@/lib/types"
import { Badge } from "@/components/ui/badge"

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

export function draftFromTest(test: SpineTestFile, project: Project): TestDraft {
  const comparable = new Set(
    project.modules.filter(isComparableStep).map((m) => labelAsStateKey(m.label)),
  )
  const seen = new Set<step_label_string>()
  const expected: TestDraft["expected"] = []
  for (const [label, v] of Object.entries(test.expectedOutputs)) {
    const key = labelAsStateKey(label)
    if (!comparable.has(key) || seen.has(key)) continue
    seen.add(key)
    const schema = stepOutputJsonSchema(project, key)
    const root = schema ? jsonSchemaToFormRoot(schema) : null
    const value = root && v !== null ? applySchemaDefaults(v, root) : v
    expected.push({ label: key, text: JSON.stringify(value, null, 2) })
  }
  return {
    description: test.description ?? "",
    inputs: Object.fromEntries(
      Object.entries(test.inputs ?? {}).map(([label, v]) => [label, Array.isArray(v) ? v : [v]]),
    ),
    expected,
  }
}

// AI : null when some expected value is not valid JSON yet — caller disables Save.
export function draftToContent(draft: TestDraft, project: Project): string | null {
  const comparable = new Set(
    project.modules.filter(isComparableStep).map((m) => labelAsStateKey(m.label)),
  )
  const expectedOutputs: Record<step_label_string, unknown> = {}
  for (const row of draft.expected) {
    if (!comparable.has(labelAsStateKey(row.label))) continue
    const parsed = tryParseJson(row.text, { trim: true })
    if (!parsed.ok) return null
    const schema = stepOutputJsonSchema(project, row.label)
    const root = schema ? jsonSchemaToFormRoot(schema) : null
    expectedOutputs[row.label] = root ? applySchemaDefaults(parsed.value, root) : parsed.value
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
  const schema = stepOutputJsonSchema(project, row.label)
  const root = schema ? jsonSchemaToFormRoot(schema) : null
  const value = root ? applySchemaDefaults(parsed.value, root) : parsed.value
  const check = validatePipelineStateEntry(labelAsStateKey(row.label), value, project)
  if (!check.ok)
    return { level: "error", message: `value does not match this step's output type:\n${check.error}` }
  return null
}

// AI : error-level draft problems that should block Run (warnings like placeholders are runnable).
export function draftHasErrors(draft: TestDraft, project: Project): boolean {
  return draft.expected.some((row) => {
    const mod = project.modules.find((m) => sameStep(m.label, row.label))
    if (!mod || !isComparableStep(mod)) return false
    return expectedIssue(row, project, false)?.level === "error"
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
      expected: draft.expected.map((r) =>
        sameStep(r.label, label) ? { ...r, label: labelAsStateKey(label), text } : r,
      ),
    })
  const removeRow = (label: step_label_string) =>
    setDraft({ ...draft, expected: draft.expected.filter((r) => !sameStep(r.label, label)) })
  const trackStep = (m: PipelineModule) => {
    const key = labelAsStateKey(m.label)
    if (rowFor(key)) return
    const golden = project.expectedOutputs?.[key]
    setDraft({
      ...draft,
      expected: [...draft.expected, { label: key, text: JSON.stringify(golden ?? null, null, 2) }],
    })
  }

  const staleRows = draft.expected.filter(
    (r) => !project.modules.some((m) => sameStep(m.label, r.label) && isComparableStep(m)),
  )

  return (
    <div className="space-y-6">
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
        <SectionLabel>pipeline</SectionLabel>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Steps run top to bottom. Pin input files once per input step — they are not duplicated as expected JSON.
          Only computation steps can be scored.
        </p>
        <ol className="relative mt-4 space-y-5 border-l border-border/80 pl-5">
          {project.modules.map((m, idx) => (
            <li key={m.id} className="relative">
              <span className="absolute -left-5 top-3 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background font-mono text-[8px] text-muted-foreground">
                {idx + 1}
              </span>
              {m.kind === ModuleKind.Input ? (
                <InputStepCard
                  module={m}
                  slotDocs={slotDocs(m)}
                  missing={namesFor(m).filter((n) => n.trim() && !projectDocs.some((d) => d.name === n))}
                  onOpenPicker={() => setPickerModule(m)}
                  onOpenDoc={(docId) => openDoc({ docId, start: 0, end: 0 })}
                  onRemoveDoc={(docId) => {
                    const doc = projectDocs.find((d) => d.id === docId)
                    if (doc) removeDocName(m, doc.name)
                  }}
                  onRemoveMissing={(name) => removeDocName(m, name)}
                  project={project}
                />
              ) : !isComparableStep(m) ? (
                <PassthroughStepCard module={m} />
              ) : rowFor(m.label) ? (
                <ScoredStepCard
                  module={m}
                  row={rowFor(m.label)!}
                  project={project}
                  ignoredFields={probabilisticPathsForModule(m, project.models)}
                  actual={actuals.get(labelAsStateKey(m.label))}
                  onText={(text) => setRowText(m.label, text)}
                  onRemove={() => removeRow(m.label)}
                  onExpand={setPopup}
                />
              ) : (
                <UntrackedStepCard module={m} onTrack={() => trackStep(m)} />
              )}
            </li>
          ))}
        </ol>
        {staleInputKeys.map((key) => (
          <div
            key={key}
            className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 px-2.5 py-2"
          >
            <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
            <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{key}</span>
            <span className="font-mono text-[10px] text-destructive">stale input — remove</span>
            <IconTrashButton onClick={() => removeInputKey(key)} />
          </div>
        ))}
        {staleRows.map((row) => (
          <div key={row.label} className="mt-3">
            <ScoredStepCard
              module={{ id: row.label, kind: ModuleKind.Llm, label: row.label } as PipelineModule}
              row={row}
              project={project}
              stale
              ignoredFields={[]}
              actual={undefined}
              onText={(text) => setRowText(row.label, text)}
              onRemove={() => removeRow(row.label)}
              onExpand={setPopup}
            />
          </div>
        ))}
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

function StepKindBadge({ kind, scored }: { kind: ModuleKind; scored?: boolean }) {
  if (kind === ModuleKind.Input) {
    return (
      <Badge variant="outline" className="shrink-0 border-sky-500/40 font-mono text-[9px] text-sky-600">
        input
      </Badge>
    )
  }
  if (kind === ModuleKind.Combine) {
    return (
      <Badge variant="outline" className="shrink-0 border-muted-foreground/40 font-mono text-[9px] text-muted-foreground">
        passthrough
      </Badge>
    )
  }
  if (scored === false) {
    return (
      <Badge variant="outline" className="shrink-0 border-muted-foreground/40 font-mono text-[9px] text-muted-foreground">
        not checked
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="shrink-0 border-chart-2/40 font-mono text-[9px] text-chart-2">
      scored
    </Badge>
  )
}

function InputStepCard({
  module,
  slotDocs,
  missing,
  onOpenPicker,
  onOpenDoc,
  onRemoveDoc,
  onRemoveMissing,
  project,
}: {
  module: PipelineModule
  slotDocs: DocRef[]
  missing: doc_name_string[]
  onOpenPicker: () => void
  onOpenDoc: (docId: DocId) => void
  onRemoveDoc: (docId: DocId) => void
  onRemoveMissing: (name: doc_name_string) => void
  project: Project
}) {
  return (
    <div className="rounded-lg border border-sky-500/20 bg-sky-500/5">
      <div className="flex flex-wrap items-center gap-2 border-b border-sky-500/15 px-3 py-2">
        <StepKindBadge kind={module.kind} />
        <span className="font-mono text-[11px] font-medium">{module.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">files only — not scored as expected output</span>
      </div>
      <div className="space-y-1.5 p-3">
        <InferenceInputSlot
          inputModule={module}
          outModel={modelName(project.models, module.outStructureId)}
          docs={slotDocs}
          issue={missing.length ? { message: `not found in this project: ${missing.join(", ")}` } : undefined}
          onOpenPicker={onOpenPicker}
          onOpenDoc={onOpenDoc}
          onRemoveDoc={onRemoveDoc}
        />
        {missing.map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-md border border-destructive/40 px-2.5 py-1.5"
          >
            <CircleX className="h-3 w-3 shrink-0 text-destructive" />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-destructive">{name}</span>
            <IconTrashButton onClick={() => onRemoveMissing(name)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PassthroughStepCard({ module }: { module: PipelineModule }) {
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <StepKindBadge kind={module.kind} />
        <span className="font-mono text-[11px] text-muted-foreground">{module.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground/80">
          {skipReasonForTestStep(module) ?? "not scored"}
        </span>
      </div>
    </div>
  )
}

function UntrackedStepCard({ module, onTrack }: { module: PipelineModule; onTrack: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-background px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <StepKindBadge kind={module.kind} scored={false} />
        <span className="min-w-0 flex-1 font-mono text-[11px] text-muted-foreground">{module.label}</span>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 font-mono text-[10px]" onClick={onTrack}>
          <Plus className="mr-1 h-3 w-3" /> pin expected output
        </Button>
      </div>
    </div>
  )
}

function ScoredStepCard({
  module,
  row,
  project,
  stale = false,
  ignoredFields,
  actual,
  onText,
  onRemove,
  onExpand,
}: {
  module: PipelineModule
  row: TestDraft["expected"][number]
  project: Project
  stale?: boolean
  ignoredFields: string[]
  actual?: unknown
  onText: (text: json_text_string) => void
  onRemove: () => void
  onExpand: (payload: PopupPayload) => void
}) {
  const issue = expectedIssue(row, project, stale)
  const [editing, setEditing] = useState(issue?.level === "error")
  const stepSchema = useMemo(
    () => (stale ? null : stepOutputJsonSchema(project, row.label)),
    [project, row.label, stale],
  )
  const isPlaceholder = row.text.trim() === "null"
  const validJson = tryParseJson(row.text, { trim: true }).ok
  const actualJson = actual !== undefined ? JSON.stringify(actual, null, 2) : null

  return (
    <div
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        issue?.level === "error" ? "border-destructive/40" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <StepKindBadge kind={module.kind} />
        {issue === null ? (
          <CircleCheck className="h-3.5 w-3.5 shrink-0 text-chart-2" />
        ) : issue.level === "error" ? (
          <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
        ) : (
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
        )}
        <span className="font-mono text-[11px] font-medium">{row.label}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {actual !== undefined && !stale && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 font-mono text-[10px] text-primary"
              title="copy the last run's actual output into expected"
              onClick={() => {
                const root = stepSchema ? jsonSchemaToFormRoot(stepSchema) : null
                const payload = root && actual !== undefined ? applySchemaDefaults(actual, root) : actual
                onText(JSON.stringify(payload, null, 2))
                setEditing(false)
              }}
            >
              <Download className="mr-1 h-3 w-3" /> use run output
            </Button>
          )}
          {!stale && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", editing ? "text-primary" : "text-muted-foreground")}
              title="edit expected output"
              onClick={() => {
                if (isPlaceholder && stepSchema) {
                  const root = jsonSchemaToFormRoot(stepSchema)
                  if (root) onText(JSON.stringify(defaultFromSchema(root), null, 2))
                }
                setEditing((v) => !v)
              }}
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
          {!isPlaceholder && validJson && (
            <button
              type="button"
              onClick={() => onExpand({ json: row.text, title: `expected · ${row.label}` })}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="full-screen expected"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          )}
          {actualJson && (
            <button
              type="button"
              onClick={() => onExpand({ json: actualJson, title: `last run · ${row.label}` })}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="full-screen actual"
            >
              <Maximize2 className="h-3 w-3 rotate-90" />
            </button>
          )}
          <IconTrashButton onClick={onRemove} />
        </div>
      </div>

      <div className="space-y-3 p-3">
        {ignoredFields.length > 0 && (
          <p className="flex items-start gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Shuffle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>probabilistic fields on this step: {ignoredFields.join(", ")}</span>
          </p>
        )}
        {!stale && !editing && !isPlaceholder && <JsonFieldKindLegend />}

        {editing ? (
          stepSchema ? (
            <SchemaJsonEditor schema={stepSchema} text={row.text} onText={onText} />
          ) : (
            <Textarea
              value={row.text}
              onChange={(e) => onText(e.target.value)}
              className="min-h-[120px] font-mono text-[11px]"
              spellCheck={false}
              autoFocus
            />
          )
        ) : isPlaceholder ? (
          <p className="font-mono text-[11px] text-muted-foreground">
            No expected output yet — run the test and click <span className="text-primary">use run output</span>, or
            edit by hand.
          </p>
        ) : (
          <div className={cn("grid gap-3", actualJson ? "lg:grid-cols-2" : "grid-cols-1")}>
            <div className="min-w-0 space-y-1">
              <SectionLabel>expected</SectionLabel>
              <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/20 p-2.5">
                <JsonFieldKindHighlight json={row.text} probabilisticPaths={ignoredFields} />
              </div>
            </div>
            {actualJson && (
              <div className="min-w-0 space-y-1">
                <SectionLabel>last run actual</SectionLabel>
                <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/20 p-2.5">
                  <JsonFieldKindHighlight json={actualJson} probabilisticPaths={ignoredFields} />
                </div>
              </div>
            )}
          </div>
        )}

        {issue && (
          <p
            className={cn(
              "max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[10px]",
              issue.level === "error" ? "text-destructive" : "text-yellow-500",
            )}
          >
            {issue.message}
          </p>
        )}
      </div>
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
