"use client"

// AI : structured form over *_testing.json — input docs use the same slot + picker UI as the
// AI : Inference tab; expected values render with the logging viewers (JsonHighlight + PopupModal)
// AI : and can be captured one-click from the last run. Serialization stays compatible with
// AI : lib/testing-files parse/validate.

import { useMemo, useState, useEffect } from "react"
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
  Unlink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { JsonFieldKindHighlight, JsonFieldKindLegend } from "@/components/highlight"
import { InferenceInputPickerPopup } from "@/components/inference-input-picker"
import { InferenceInputSlot } from "@/components/inference/inference-input-slot"
import { PopupModal, type PopupPayload } from "@/components/logging/popup-modal"
import { TestingPipelineAlignView } from "@/components/testing-pipeline-align-view"
import { StructureLink } from "@/components/structure-link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StepInputDescription, moduleInputDescription } from "@/components/step-input-description"
import { isMultiDocInputModule, inputTypeLabel } from "@/lib/inference-input"
import { pairedCombineInputModule } from "@/lib/pipeline-layout"
import type { StepUiState } from "@/lib/run-engine"
import { useDocViewer } from "@/lib/doc-viewer"
import { modelName } from "@/lib/validity"
import { labelAsStateKey, validatePipelineStateEntry } from "@/lib/server/pipeline_state"
import { SchemaJsonEditor } from "@/components/schema-json-editor"
import { applySchemaDefaults, defaultFromSchema, jsonSchemaToFormRoot } from "@/lib/schema-form"
import { stepOutputJsonSchema } from "@/lib/step-json-schema"
import { tryParseJson } from "@/lib/json-utils"
import {
  analyzeTestPipelineAlignment,
  buildTestCoverageMap,
  isComparableStep,
  probabilisticPathsForModule,
  probabilisticReferencePaths,
  sanitizeTestFile,
  skipReasonForTestStep,
  type SpineTestFile,
  type TestStepTrackStatus,
} from "@/lib/testing-files"
import { ResizableSplit } from "@/components/resizable-split"
import {
  readTestingCompareWidth,
  readTestingPipelineWidth,
  TESTING_COMPARE_MAX,
  TESTING_COMPARE_MIN,
  useTestingCompareWidth,
  useTestingPipelineWidth,
  writeTestingCompareWidth,
  writeTestingPipelineWidth,
} from "@/lib/testing-settings"
import { cn } from "@/lib/utils"
import { ModuleKind, type DocId, DocRef, ModuleId, PipelineModule, Project } from "@/lib/types"
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
  const cleaned = sanitizeTestFile(test, project)
  const seen = new Set<step_label_string>()
  const expected: TestDraft["expected"] = []
  for (const [label, v] of Object.entries(cleaned.expectedOutputs)) {
    const key = labelAsStateKey(label)
    if (seen.has(key)) continue
    seen.add(key)
    const mod = project.modules.find((m) => labelAsStateKey(m.label) === key)
    const schema = mod && isComparableStep(mod) ? stepOutputJsonSchema(project, key) : null
    const root = schema ? jsonSchemaToFormRoot(schema) : null
    const value = root && v !== null ? applySchemaDefaults(v, root) : v
    expected.push({ label: key, text: JSON.stringify(value, null, 2) })
  }
  return {
    description: cleaned.description ?? "",
    inputs: Object.fromEntries(
      Object.entries(cleaned.inputs ?? {}).map(([label, v]) => [label, Array.isArray(v) ? v : [v]]),
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

// AI : draft → alignment input without requiring valid JSON for every row.
function draftAlignmentInput(draft: TestDraft, project: Project): Pick<SpineTestFile, "inputs" | "expectedOutputs"> {
  const expectedOutputs: Record<step_label_string, unknown> = {}
  for (const row of draft.expected) {
    const mod = project.modules.find((m) => labelAsStateKey(m.label) === labelAsStateKey(row.label))
    if (!mod || !isComparableStep(mod)) continue
    const parsed = tryParseJson(row.text, { trim: true })
    expectedOutputs[row.label] = parsed.ok ? parsed.value : null
  }
  const inputs: NonNullable<SpineTestFile["inputs"]> = {}
  for (const [label, names] of Object.entries(draft.inputs)) {
    const clean = names.filter((n) => n.trim())
    inputs[label] = clean.length === 1 ? clean[0] : clean
  }
  return { inputs, expectedOutputs }
}

function StepTypeLine({ module, project }: { module: PipelineModule; project: Project }) {
  if (module.kind === ModuleKind.Input) {
    return (
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        <StructureLink models={project.models} structureId={module.outStructureId} />
        <span className="text-muted-foreground/60"> · </span>
        {inputTypeLabel(module.inputType)}
      </p>
    )
  }
  if (!isComparableStep(module)) {
    return (
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        <StructureLink models={project.models} structureId={module.inStructureId} />
        <span className="text-muted-foreground/60"> · same model in/out</span>
      </p>
    )
  }
  return (
    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
      <StructureLink models={project.models} structureId={module.inStructureId} />
      <span className="text-muted-foreground/60"> → </span>
      <StructureLink models={project.models} structureId={module.outStructureId} />
    </p>
  )
}

function PipelineCoverageLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-3 py-2 font-mono text-[9px] text-muted-foreground">
      <span>
        <span className="text-chart-2">checked</span> — expected output pinned
      </span>
      <span>
        <span className="text-sky-600">input</span> — document slot
      </span>
      <span>skip — not scored</span>
      <span className="text-muted-foreground/80">dashed — not checked on run</span>
    </div>
  )
}

function PipelineAlignmentBanner({
  orphanExpectedCount,
  orphanInputCount,
}: {
  orphanExpectedCount: number
  orphanInputCount: number
}) {
  const total = orphanExpectedCount + orphanInputCount
  if (!total) return null
  return (
    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <Unlink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <div className="min-w-0 space-y-1">
          <p className="font-mono text-[11px] text-destructive">
            {total} orphaned step{total === 1 ? "" : "s"} — no longer in the pipeline
          </p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            Remap typed expected outputs to a matching pipeline step, or remove entries you no longer need. Tests stay
            partial — only tracked steps are checked on run.
          </p>
        </div>
      </div>
    </div>
  )
}

function RemapSelect({
  candidates,
  onRemap,
}: {
  candidates: step_label_string[]
  onRemap: (target: step_label_string) => void
}) {
  const [target, setTarget] = useState(candidates[0] ?? "")
  if (!candidates.length) return null
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={target} onValueChange={(v) => v && setTarget(v)}>
        <SelectTrigger size="sm" className="h-7 min-w-[10rem] font-mono text-[10px]">
          <SelectValue placeholder="pick step" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((key) => (
            <SelectItem key={key} value={key} className="font-mono text-[10px]">
              {key}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="h-7 bg-transparent px-2 font-mono text-[10px]"
        disabled={!target}
        onClick={() => onRemap(target)}
      >
        move here
      </Button>
    </div>
  )
}

type RowIssue = { level: "error" | "warning"; message: string }

function expectedIssue(
  row: TestDraft["expected"][number],
  project: Project,
  stale: boolean,
): RowIssue | null {
  if (stale)
    return {
      level: "error",
      message: "orphaned — this step is not in the pipeline; remap to a matching step or remove",
    }
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
  stepStates,
  inputChecksByModuleId,
}: {
  draft: TestDraft
  setDraft: (d: TestDraft) => void
  project: Project
  projectDocs: DocRef[]
  actuals: Map<step_label_string, unknown>
  stepStates?: Map<ModuleId, StepUiState>
  inputChecksByModuleId?: Map<ModuleId, NonNullable<StepUiState["inputDescriptionCheck"]>>
}) {
  const [pickerModule, setPickerModule] = useState<PipelineModule | null>(null)
  const [popup, setPopup] = useState<PopupPayload | null>(null)
  const { open: openDoc } = useDocViewer()

  const alignment = useMemo(
    () => analyzeTestPipelineAlignment(draftAlignmentInput(draft, project), project),
    [draft, project],
  )
  const testCoverage = useMemo(() => buildTestCoverageMap(alignment), [alignment])
  const [selectedModuleId, setSelectedModuleId] = useState<ModuleId | null>(null)
  const savedPipelineWidth = useTestingPipelineWidth()
  const [pipelineWidth, setPipelineWidth] = useState(readTestingPipelineWidth)
  useEffect(() => setPipelineWidth(savedPipelineWidth), [savedPipelineWidth])

  const setInputNames = (key: step_label_string, names: doc_name_string[]) =>
    setDraft({ ...draft, inputs: { ...draft.inputs, [key]: names } })
  const removeInputKey = (key: step_label_string) => {
    const { [key]: _gone, ...rest } = draft.inputs
    setDraft({ ...draft, inputs: rest })
  }
  const remapInputKey = (from: step_label_string, to: step_label_string) => {
    const fromKey = Object.keys(draft.inputs).find((l) => sameStep(l, from)) ?? from
    const toKey = labelAsStateKey(to)
    const names = draft.inputs[fromKey] ?? []
    const { [fromKey]: _gone, ...rest } = draft.inputs
    const merged = [...(rest[toKey] ?? []), ...names]
    setDraft({ ...draft, inputs: { ...rest, [toKey]: merged } })
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
  const remapExpectedRow = (from: step_label_string, to: step_label_string) => {
    const row = draft.expected.find((r) => sameStep(r.label, from))
    if (!row) return
    const toKey = labelAsStateKey(to)
    setDraft({
      ...draft,
      expected: [
        ...draft.expected.filter((r) => !sameStep(r.label, from) && !sameStep(r.label, toKey)),
        { label: toKey, text: row.text },
      ],
    })
  }
  const trackStep = (m: PipelineModule) => {
    const key = labelAsStateKey(m.label)
    if (rowFor(key)) return
    const golden = project.expectedOutputs?.[key]
    setDraft({
      ...draft,
      expected: [...draft.expected, { label: key, text: JSON.stringify(golden ?? null, null, 2) }],
    })
  }

  const inputCheckFor = (m: PipelineModule) =>
    stepStates?.get(m.id)?.inputDescriptionCheck ?? inputChecksByModuleId?.get(m.id)

  const renderTestStep = (m: PipelineModule, trackStatus: TestStepTrackStatus) => {
    if (trackStatus === "input") {
      return (
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
      )
    }
    if (trackStatus === "passthrough") {
      const paired = m.kind === ModuleKind.Combine ? pairedCombineInputModule(m, project.modules) : undefined
      return (
        <PassthroughStepCard
          module={m}
          project={project}
          pairedInput={paired}
          pairedInputDocs={paired ? slotDocs(paired) : []}
          inputDescriptionCheck={inputCheckFor(m)}
          onConfigureUpload={paired ? () => setPickerModule(paired) : undefined}
        />
      )
    }
    if (trackStatus === "tracked") {
      return (
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
      )
    }
    return <UntrackedStepCard module={m} project={project} onTrack={() => trackStep(m)} />
  }

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

      <section className="space-y-0">
        <SectionLabel>pipeline</SectionLabel>
        <p className="mt-1 font-mono text-[10px] leading-relaxed text-muted-foreground">
          One scroll — each pipeline step stays on the same row as its test config. Click either side to select a step.
        </p>
        <PipelineAlignmentBanner
          orphanExpectedCount={alignment.orphanedExpected.length}
          orphanInputCount={alignment.orphanedInputs.length}
        />
        <div className="mt-3">
          <TestingPipelineAlignView
            project={project}
            alignment={alignment}
            testCoverage={testCoverage}
            selectedModuleId={selectedModuleId}
            onSelectModule={setSelectedModuleId}
            pipelineWidth={pipelineWidth}
            onPipelineWidthChange={setPipelineWidth}
            onPipelineWidthCommit={writeTestingPipelineWidth}
            renderTestStep={renderTestStep}
            legend={<PipelineCoverageLegend />}
            orphansFooter={
              alignment.orphanedInputs.length || alignment.orphanedExpected.length ? (
                <>
                  {alignment.orphanedInputs.map(({ label, remapCandidates }) => {
                    const inputKey = Object.keys(draft.inputs).find((l) => sameStep(l, label)) ?? label
                    const names = draft.inputs[inputKey] ?? []
                    return (
                      <div
                        key={label}
                        className="space-y-2 rounded-md border border-destructive/40 px-2.5 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <CircleX className="h-3.5 w-3.5 shrink-0 text-destructive" />
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{label}</span>
                          <Badge
                            variant="outline"
                            className="shrink-0 border-destructive/40 font-mono text-[9px] text-destructive"
                          >
                            orphaned input
                          </Badge>
                          <IconTrashButton onClick={() => removeInputKey(inputKey)} />
                        </div>
                        {names.length > 0 && (
                          <p className="font-mono text-[10px] text-muted-foreground">pinned: {names.join(", ")}</p>
                        )}
                        {remapCandidates.length > 0 ? (
                          <RemapSelect candidates={remapCandidates} onRemap={(to) => remapInputKey(label, to)} />
                        ) : (
                          <p className="font-mono text-[10px] text-destructive">
                            no free input slot — remove or merge by hand
                          </p>
                        )}
                      </div>
                    )
                  })}
                  {alignment.orphanedExpected.map(({ label, remapCandidates }) => {
                    const row = draft.expected.find((r) => sameStep(r.label, label))
                    if (!row) return null
                    const mod = project.modules.find((m) => sameStep(m.label, label))
                    const notScored = mod && !isComparableStep(mod)
                    return (
                      <div key={label} className="space-y-2">
                        <ScoredStepCard
                          module={(mod ?? { id: label, kind: ModuleKind.Llm, label }) as PipelineModule}
                          row={row}
                          project={project}
                          stale
                          ignoredFields={[]}
                          actual={undefined}
                          onText={(text) => setRowText(row.label, text)}
                          onRemove={() => removeRow(row.label)}
                          onExpand={setPopup}
                        />
                        <div className="rounded-md border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2">
                          <p className="font-mono text-[10px] text-destructive">
                            {notScored
                              ? "this step is input/combine — remove expected output; pin files under inputs instead"
                              : remapCandidates.length
                                ? `${remapCandidates.length} pipeline step${remapCandidates.length === 1 ? "" : "s"} accept this typed output`
                                : "no matching output type in the current pipeline — update expected JSON or remove"}
                          </p>
                          {!notScored && remapCandidates.length > 0 && (
                            <div className="mt-2">
                              <RemapSelect
                                candidates={remapCandidates}
                                onRemap={(to) => remapExpectedRow(label, to)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              ) : undefined
            }
          />
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
      <div className="border-b border-sky-500/10 px-3 py-1.5">
        <StepTypeLine module={module} project={project} />
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
            <span className="min-w-0 flex-1 break-all font-mono text-[10px] text-destructive">{name}</span>
            <IconTrashButton onClick={() => onRemoveMissing(name)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function PassthroughStepCard({
  module,
  project,
  pairedInput,
  pairedInputDocs,
  inputDescriptionCheck,
  onConfigureUpload,
}: {
  module: PipelineModule
  project: Project
  pairedInput?: PipelineModule
  pairedInputDocs?: DocRef[]
  inputDescriptionCheck?: StepUiState["inputDescriptionCheck"]
  onConfigureUpload?: () => void
}) {
  const desc = moduleInputDescription(module)
  const uploadNames = pairedInputDocs?.map((d) => d.name) ?? []
  return (
    <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <StepKindBadge kind={module.kind} />
        <span className="font-mono text-[11px] text-muted-foreground">{module.label}</span>
        <span className="font-mono text-[10px] text-muted-foreground/80">
          {skipReasonForTestStep(module) ?? "not scored"}
        </span>
      </div>
      <StepTypeLine module={module} project={project} />
      {pairedInput && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="font-mono text-[10px] text-muted-foreground">
            upload pinned on{" "}
            <span className="text-foreground">&quot;{pairedInput.label}&quot;</span>
            {uploadNames.length ? `: ${uploadNames.join(", ")}` : " — assign a document"}
          </p>
          {onConfigureUpload && (
            <Button type="button" variant="outline" size="sm" className="h-6 px-2 font-mono text-[9px]" onClick={onConfigureUpload}>
              change files
            </Button>
          )}
        </div>
      )}
      {desc && (
        <StepInputDescription
          className="mt-2"
          description={desc}
          check={inputDescriptionCheck}
          forceVisible={inputDescriptionCheck?.matches === false}
        />
      )}
    </div>
  )
}

function UntrackedStepCard({
  module,
  project,
  onTrack,
}: {
  module: PipelineModule
  project: Project
  onTrack: () => void
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/70 bg-background px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <StepKindBadge kind={module.kind} scored={false} />
        <span className="min-w-0 flex-1 font-mono text-[11px] text-muted-foreground">{module.label}</span>
        <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 font-mono text-[10px]" onClick={onTrack}>
          <Plus className="mr-1 h-3 w-3" /> pin expected output
        </Button>
      </div>
      <StepTypeLine module={module} project={project} />
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
  const probabilisticCheckedPaths = useMemo(() => {
    if (!ignoredFields.length) return undefined
    const parsed = tryParseJson(row.text, { trim: true })
    if (!parsed.ok) return undefined
    return probabilisticReferencePaths(parsed.value, ignoredFields)
  }, [row.text, ignoredFields])
  const savedCompareWidth = useTestingCompareWidth()
  const [compareWidth, setCompareWidth] = useState(readTestingCompareWidth)
  useEffect(() => setCompareWidth(savedCompareWidth), [savedCompareWidth])

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
        {!stale && <StepTypeLine module={module} project={project} />}
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
        ) : actualJson ? (
          <ResizableSplit
            className="w-full"
            leadingWidth={compareWidth}
            onLeadingWidthChange={setCompareWidth}
            onLeadingWidthCommit={writeTestingCompareWidth}
            minLeading={TESTING_COMPARE_MIN}
            maxLeading={TESTING_COMPARE_MAX}
            leading={
              <div className="min-w-0 space-y-1 pr-1">
                <SectionLabel>expected</SectionLabel>
                <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/20 p-2.5">
                  <JsonFieldKindHighlight
                    json={row.text}
                    probabilisticPaths={ignoredFields}
                    probabilisticCheckedPaths={probabilisticCheckedPaths}
                  />
                </div>
              </div>
            }
            trailing={
              <div className="min-w-0 space-y-1 pl-1">
                <SectionLabel>last run actual</SectionLabel>
                <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/20 p-2.5">
                  <JsonFieldKindHighlight
                    json={actualJson}
                    probabilisticPaths={ignoredFields}
                    probabilisticCheckedPaths={probabilisticCheckedPaths}
                  />
                </div>
              </div>
            }
          />
        ) : (
          <div className="min-w-0 space-y-1">
            <SectionLabel>expected</SectionLabel>
            <div className="max-h-80 overflow-auto rounded-md border border-border bg-muted/20 p-2.5">
              <JsonFieldKindHighlight
                json={row.text}
                probabilisticPaths={ignoredFields}
                probabilisticCheckedPaths={probabilisticCheckedPaths}
              />
            </div>
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
