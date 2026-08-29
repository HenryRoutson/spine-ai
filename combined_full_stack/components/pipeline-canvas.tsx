"use client"

// AI : TODO refactor (spec) — remove combine segments when implicit multi-input merge ships (pipeline-layout.ts).
// AI : TODO (spec) — execution-order view maximizing parallel llm-batch; dependency arrows from step() label refs.
import { useState } from "react"
import {
  ArrowRight,
  ChevronRight,
  AlertTriangle,
  Plus,
  Zap,
} from "lucide-react"
import { PipelineDagGraph } from "@/components/pipeline-dag-graph"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  blocksInsertBefore,
  insertAfterIndex,
  insertBeforeIndex,
  modulesInSegment,
  pipelineSegmentKey,
  segmentPipeline,
  type PipelineInsertLoc,
  type PipelineSegment,
} from "@/lib/pipeline-layout"
import {
  FORK_MAX_BRANCHES,
  flattenPipelineModules,
  isForkKind,
  isIfElseKind,
  isCaseKind,
  isExclusiveKind,
  isNestedLaneKind,
  makeEmptyForkBranch,
  pipelineHasFork,
} from "@/lib/fork-pipeline"
import { formatIfCondition } from "@/lib/if-else-pipeline"
import { isDefaultCaseMatch } from "@/lib/case-pipeline"
import { formatModuleSpineOut } from "@/lib/spine-type"
import { forkJoinCaption } from "@/lib/fork-join-caption"
import { isAutoQuoteStep } from "@/lib/quote-steps"
import { inputTargetStructureId, isAutoDocToTextStep, isAutoStructureParseStep, isManagedLockedStep } from "@/lib/structure-parse-steps"
import {
  AutoDocToTextLock,
  AutoQuoteLock,
  AutoStructureParseLock,
  KindIcon,
  PipelineConnector,
  PipelineNode,
} from "@/lib/module-ui"
import { ModuleKind, type ModuleId, type PipelineModule, type RunStepStatus, type StructureModel } from "@/lib/types"
import { inputTypeLabel } from "@/lib/inference-input"
import { uiContextTargetProps } from "@/lib/ui-context-dom"
import { truncateUiContextText } from "@/lib/ui-context-types"
import {
  invalidStepMessage,
  ioMismatchAtModuleIndex,
  stepIoMismatchLinked,
  stepIoMismatchMessage,
  warningStepMessages,
  invalidForModule,
  type InvalidMap,
  type PipelineWarning,
} from "@/lib/validity"
import { WARNING_TEXT_CLASS } from "@/lib/ui-classes"
import { cn } from "@/lib/utils"
import { useStatusPalette } from "@/lib/chart-colors"
import { Badge } from "@/components/ui/badge"
import { StructureLink } from "@/components/structure-link"

const PipelineTestCoverageStatus = {
  Input: "input",
  Passthrough: "passthrough",
  Tracked: "tracked",
  Untracked: "untracked",
} as const

type PipelineTestCoverageStatus =
  (typeof PipelineTestCoverageStatus)[keyof typeof PipelineTestCoverageStatus]

type PipelineCanvasProps = {
  modules: PipelineModule[]
  models: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  testCoverage?: Map<ModuleId, PipelineTestCoverageStatus>
  invalid?: InvalidMap
  warnings?: Map<ModuleId, PipelineWarning[]>
  renderInsertBefore?: (insertAt: number, loc?: PipelineInsertLoc) => React.ReactNode
  renderInsertAfter?: (
    insertAt: number,
    opts: { blocked?: boolean; connectionInvalid?: boolean; forkId?: string; branchId?: string },
  ) => React.ReactNode
  renderBeforeEnd?: () => React.ReactNode
  renderFooter?: () => React.ReactNode
  onPatchFork?: (forkId: ModuleId, patch: Partial<PipelineModule>) => void
  className?: string
}

// AI : shared linear pipeline canvas — Logging (read-only) and Pipeline builder (edit + inserts).
export function PipelineCanvas({
  modules,
  models,
  selectedId,
  onSelect,
  stepStatus,
  testCoverage,
  invalid,
  warnings,
  renderInsertBefore,
  renderInsertAfter,
  renderBeforeEnd,
  renderFooter,
  onPatchFork,
  className,
}: PipelineCanvasProps) {
  const segments = segmentPipeline(modules)
  const editMode = Boolean(renderInsertAfter ?? renderInsertBefore ?? renderFooter)
  const firstSeg = segments[0]
  const startConnectionInvalid = firstSeg
    ? ioMismatchAtModuleIndex(modules, invalid, firstSeg.index)
    : false

  const wide = pipelineHasFork(modules)
  const [view, setView] = useState<"lanes" | "graph">(editMode ? "lanes" : "graph")
  const showGraph = view === "graph"

  return (
    <div className={cn("mx-auto flex w-full flex-col items-stretch gap-0", wide || showGraph ? "max-w-none" : "max-w-xl", className)}>
      <div className="mb-3 flex items-center justify-center gap-2">
        <Tabs value={view} onValueChange={(v) => setView(v === "graph" ? "graph" : "lanes")}>
          <TabsList variant="line">
            <TabsTrigger value="lanes" className="font-mono text-[10px]">
              Lanes
            </TabsTrigger>
            <TabsTrigger value="graph" className="font-mono text-[10px]">
              DAG
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {showGraph ? (
        <div className="flex w-full flex-col items-stretch gap-3">
          {editMode ? (
            <p className="text-center font-mono text-[10px] text-muted-foreground">
              Same step cards as Lanes, laid out as a DAG. Run / Schedule / Share attach to Start — not graph nodes. For/while stays in custom-code or llm-batch.
            </p>
          ) : null}
          <PipelineDagGraph
            modules={modules}
            models={models}
            selectedId={selectedId}
            onSelect={onSelect}
            stepStatus={stepStatus}
            invalid={invalid}
          />
          {renderFooter?.()}
        </div>
      ) : (
        <>
      <div className="mx-auto flex w-full flex-col items-center">
        <PipelineNode label="Start" subtle />
        {segments.length > 0 && renderInsertBefore?.(insertBeforeIndex(segments[0]))}
        {segments.length > 0 && !renderInsertBefore && <PipelineConnector invalid={startConnectionInvalid} />}
      </div>
      {segments.map((seg) => (
        <SegmentRow
          key={pipelineSegmentKey(seg)}
          seg={seg}
          modules={modules}
          models={models}
          selectedId={selectedId}
          onSelect={onSelect}
          stepStatus={stepStatus}
          testCoverage={testCoverage}
          invalid={invalid}
          warnings={warnings}
          editMode={editMode}
          renderInsertAfter={renderInsertAfter}
          onPatchFork={onPatchFork}
        />
      ))}
      <div className="mx-auto flex w-full flex-col items-center">
        {renderBeforeEnd?.()}
        {segments.length === 0 && renderInsertAfter?.(0, {})}
        <PipelineNode label="End" subtle />
        {renderFooter?.()}
      </div>
        </>
      )}
    </div>
  )
}

function modulesInForkSelected(
  seg: Extract<PipelineSegment, { kind: "fork" }>,
  selectedId?: ModuleId,
): boolean {
  if (!selectedId) return false
  return modulesInSegment(seg).some((m) => m.id === selectedId)
}

function SegmentRow({
  seg,
  modules,
  models,
  selectedId,
  onSelect,
  stepStatus,
  testCoverage,
  invalid,
  warnings,
  editMode,
  renderInsertAfter,
  insertLoc,
  onPatchFork,
}: {
  seg: PipelineSegment
  modules: PipelineModule[]
  models: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  testCoverage?: Map<ModuleId, PipelineTestCoverageStatus>
  invalid?: InvalidMap
  warnings?: Map<ModuleId, PipelineWarning[]>
  editMode: boolean
  renderInsertAfter?: (
    insertAt: number,
    opts: { blocked?: boolean; connectionInvalid?: boolean; forkId?: string; branchId?: string },
  ) => React.ReactNode
  insertLoc?: PipelineInsertLoc
  onPatchFork?: (forkId: ModuleId, patch: Partial<PipelineModule>) => void
}) {
  const insertAt = insertAfterIndex(seg)
  const blocked = blocksInsertBefore(modules, insertAt)
  const connectionInvalid = ioMismatchAtModuleIndex(modules, invalid, insertAt)
  const afterOpts = {
    blocked,
    connectionInvalid,
    forkId: insertLoc?.forkId,
    branchId: insertLoc?.branchId,
  }

  if (seg.kind === "fork") {
    const { fork, index, branches } = seg
    const forkIssue = invalidForModule(invalid ?? new Map(), fork.id)
    const forkInvalid = forkIssue && forkIssue.kind !== "io-mismatch" && forkIssue.kind !== "cardinality-mismatch"
    const forkIoLinked = stepIoMismatchLinked(fork.id, modules, invalid)
    const forkIoMsg =
      forkIoLinked && invalid ? stepIoMismatchMessage(fork.id, modules, invalid, models) : undefined
    const forkStatus = stepStatus?.get(fork.id)
    const forkCoverage = testCoverage?.get(fork.id)
    const laneSelected = modulesInForkSelected(seg, selectedId)
    const joinCaption = forkJoinCaption(fork)
    const descendantIds = modulesInSegment(seg).map((m) => m.id)
    const childInvalidCount = descendantIds.filter((id) => {
      if (id === fork.id) return false
      const issue = invalidForModule(invalid ?? new Map(), id)
      return !!issue
    }).length
    const childErrorCount = descendantIds.filter((id) => id !== fork.id && stepStatus?.get(id) === "error").length
    const childProblems = childInvalidCount + childErrorCount
    const forkChromeBad = !!forkInvalid || forkIoLinked || childProblems > 0 || forkStatus === "error"
    const forkWarnings = warnings?.get(fork.id) ?? []
    function laneProblem(branch: (typeof branches)[number], laneIndex: number): boolean {
      const allowEmpty =
        (isIfElseKind(fork.kind) && laneIndex === 1) ||
        (isCaseKind(fork.kind) && isDefaultCaseMatch(fork.forkBranches?.[laneIndex]?.match))
      if (branch.modules.length === 0) return !allowEmpty
      const ids = flattenPipelineModules(branch.modules).map((m) => m.id)
      return ids.some((id) => {
        if (invalidForModule(invalid ?? new Map(), id)) return true
        return stepStatus?.get(id) === "error"
      })
    }
    const canAddLane =
      editMode &&
      !!onPatchFork &&
      (isForkKind(fork.kind) || isCaseKind(fork.kind)) &&
      branches.length < FORK_MAX_BRANCHES
    const colTemplate = [
      ...branches.map((b) =>
        flattenPipelineModules(b.modules).some((m) => isNestedLaneKind(m.kind))
          ? "minmax(22rem, 1.6fr)"
          : "minmax(13rem, 1fr)",
      ),
      ...(canAddLane ? ["minmax(7rem, 0.4fr)"] : []),
    ].join(" ")
    return (
      <div className="mx-auto flex w-full flex-col items-center">
        <div
          className={cn(
            "w-full overflow-x-auto rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors",
            forkChromeBad
              ? "border-destructive/70 bg-destructive/5"
              : testCoverageBorder(forkCoverage, selectedId === fork.id) ??
                statusBorder(forkStatus) ?? (
                  laneSelected ? "border-primary bg-primary/5" : "border-chart-4/40 bg-chart-4/5"
                ),
          )}
        >
          <StepButton
            onClick={() => onSelect?.(fork.id)}
            className="flex w-full items-start gap-2 text-left"
            moduleId={fork.id}
            label={fork.label}
            kind={fork.kind}
            snippet={fork.note}
          >
            <StepIndex index={index} />
            <KindIcon kind={fork.kind} />
            <StepBody
              label={fork.label}
              detail={
                <>
                  <StructureLink models={models} structureId={fork.inStructureId} fallback="pipeline" />
                  <span className="text-muted-foreground/60"> → </span>
                  {isExclusiveKind(fork.kind) ? (
                    <span>{formatModuleSpineOut(fork, models)}</span>
                  ) : (
                    <StructureLink models={models} structureId={fork.outStructureId} />
                  )}
                  <span className="text-muted-foreground/60">
                    {" "}
                    · {isIfElseKind(fork.kind)
                      ? formatIfCondition(fork.ifCondition)
                      : isCaseKind(fork.kind)
                        ? `case ${fork.ifCondition?.path || "path"}`
                        : joinCaption.title}
                  </span>
                </>
              }
            />
            {childProblems > 0 && (
              <Badge variant="outline" className="shrink-0 border-destructive/50 font-mono text-[9px] text-destructive">
                {childProblems} lane issue{childProblems === 1 ? "" : "s"}
              </Badge>
            )}
            {fork.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {forkCoverage && <TestCoverageBadge status={forkCoverage} />}
            <StepTrailingIcon invalid={forkChromeBad} status={forkStatus} editMode={editMode} />
          </StepButton>
          {fork.note && (
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">{fork.note}</p>
          )}
          <div className="mt-3 grid gap-0" style={{ gridTemplateColumns: colTemplate }}>
            {branches.map((b, i) => {
              const empty = b.modules.length === 0
              const problem = laneProblem(b, i)
              const emptyDefaultOk =
                (isIfElseKind(fork.kind) && i === 1 && empty) ||
                (isCaseKind(fork.kind) && empty && isDefaultCaseMatch(fork.forkBranches?.[i]?.match))
              return (
                <div
                  key={b.id}
                  className={cn(
                    "min-w-[13rem] p-2",
                    i > 0 && "border-l-2 border-dashed border-muted-foreground/35",
                    problem ? "bg-destructive/5" : "bg-background/70",
                  )}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <p className={cn("font-mono text-[10px] uppercase tracking-wide", problem ? "text-destructive" : "text-muted-foreground")}>
                      {isCaseKind(fork.kind)
                        ? isDefaultCaseMatch(fork.forkBranches?.[i]?.match)
                          ? `${b.label} · default`
                          : `${b.label} · ${fork.forkBranches?.[i]?.match || "match"}`
                        : b.label}
                    </p>
                    {empty && !emptyDefaultOk && (
                      <span className="font-mono text-[9px] text-destructive">empty</span>
                    )}
                    {emptyDefaultOk && (
                      <span className="font-mono text-[9px] text-muted-foreground">passthrough</span>
                    )}
                    {problem && !empty && <AlertTriangle className="h-3 w-3 text-destructive" />}
                  </div>
                  {editMode &&
                    renderInsertAfter?.(0, { forkId: fork.id, branchId: b.id, blocked: false })}
                  {empty && !emptyDefaultOk && (
                    <p className="mt-2 font-mono text-[10px] text-destructive">Add a step to this lane.</p>
                  )}
                  {emptyDefaultOk && (
                    <p className="mt-2 font-mono text-[10px] text-muted-foreground">
                      Empty {isIfElseKind(fork.kind) ? "Else" : "default"} keeps the previous spine.
                    </p>
                  )}
                  {b.segments.map((inner) => (
                    <SegmentRow
                      key={pipelineSegmentKey(inner)}
                      seg={inner}
                      modules={b.modules}
                      models={models}
                      selectedId={selectedId}
                      onSelect={onSelect}
                      stepStatus={stepStatus}
                      testCoverage={testCoverage}
                      invalid={invalid}
                      warnings={warnings}
                      editMode={editMode}
                      renderInsertAfter={renderInsertAfter}
                      insertLoc={{ forkId: fork.id, branchId: b.id }}
                      onPatchFork={onPatchFork}
                    />
                  ))}
                </div>
              )
            })}
            {canAddLane && (
              <button
                type="button"
                className="flex min-w-[7rem] flex-col items-center justify-center gap-1 border-l-2 border-dashed border-muted-foreground/35 px-2 py-4 font-mono text-[10px] text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                onClick={() =>
                  onPatchFork?.(fork.id, {
                    forkBranches: [
                      ...(fork.forkBranches ?? []),
                      isCaseKind(fork.kind)
                        ? { ...makeEmptyForkBranch(`Arm ${branches.length + 1}`), match: `arm_${branches.length + 1}` }
                        : makeEmptyForkBranch(`Lane ${String.fromCharCode(65 + branches.length)}`),
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                add lane
              </button>
            )}
          </div>
          {isForkKind(fork.kind) && (
            <ForkJoinRow
              caption={joinCaption}
              selected={selectedId === fork.id}
              onSelect={() => onSelect?.(fork.id)}
            />
          )}
          {isIfElseKind(fork.kind) && (
            <p className="mt-3 rounded-md border border-dashed border-chart-4/50 bg-background/60 px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
              if {formatIfCondition(fork.ifCondition)} → Then, else Else (optional)
              {" · join "}
              {formatModuleSpineOut(fork, models)}
            </p>
          )}
          {isCaseKind(fork.kind) && (
            <p className="mt-3 rounded-md border border-dashed border-chart-4/50 bg-background/60 px-2.5 py-2 font-mono text-[10px] text-muted-foreground">
              case {fork.ifCondition?.path || "path"} · join {formatModuleSpineOut(fork, models)}
            </p>
          )}
        </div>
        <InvalidMessage
          className="text-xs"
          show={!!forkInvalid || !!forkIoMsg || childProblems > 0}
          message={
            forkInvalid
              ? invalidStepMessage(forkIssue!, models, modules)
              : forkIoMsg
                ? forkIoMsg
                : childProblems > 0
                  ? `${childProblems} issue${childProblems === 1 ? "" : "s"} inside lanes — click the failing step`
                  : undefined
          }
          moduleId={fork.id}
          label={fork.label}
        />
        {!forkInvalid && forkWarnings.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {warningStepMessages(forkWarnings, models, modules).map((msg, i) => (
              <p key={i} className={cn("text-center font-mono text-[10px]", WARNING_TEXT_CLASS)}>
                {msg}
              </p>
            ))}
          </div>
        )}
        {renderInsertAfter?.(insertAt, afterOpts) ?? <PipelineConnector invalid={connectionInvalid} />}
      </div>
    )
  }

  if (seg.kind === "combine") {
    const { combine, input, convert, parse, index } = seg
    const combineIssue = invalidForModule(invalid ?? new Map(), combine.id)
    const combineInvalid = combineIssue && combineIssue.kind !== "io-mismatch" && combineIssue.kind !== "cardinality-mismatch"
    const combineIoLinked = stepIoMismatchLinked(combine.id, modules, invalid)
    const combineIoMsg =
      combineIoLinked && invalid
        ? stepIoMismatchMessage(combine.id, modules, invalid, models)
        : undefined
    const combineStatus = stepStatus?.get(combine.id)
    const inputStatus = stepStatus?.get(input.id)
    const parseStatus = parse ? stepStatus?.get(parse.id) : undefined
    const convertStatus = convert ? stepStatus?.get(convert.id) : undefined
    const combineCoverage = testCoverage?.get(combine.id)
    const inputCoverage = testCoverage?.get(input.id)
    const groupSelected =
      selectedId === combine.id ||
      selectedId === input.id ||
      selectedId === convert?.id ||
      selectedId === parse?.id
    const innerIds = [input.id, convert?.id, parse?.id].filter((id): id is typeof input.id => !!id)
    const innerInvalidCount = innerIds.filter((id) => !!invalidForModule(invalid ?? new Map(), id)).length
    const innerErrorCount = innerIds.filter((id) => stepStatus?.get(id) === "error").length
    const innerProblems = innerInvalidCount + innerErrorCount
    const combineChromeBad = !!combineInvalid || combineIoLinked || innerProblems > 0 || combineStatus === "error"
    const inputIssue = invalidForModule(invalid ?? new Map(), input.id)
    const convertIssue = convert ? invalidForModule(invalid ?? new Map(), convert.id) : undefined
    const parseIssue = parse ? invalidForModule(invalid ?? new Map(), parse.id) : undefined
    return (
      <div className="mx-auto flex w-full flex-col items-center">
        <div
          className={cn(
            "w-full rounded-lg border-2 border-dashed px-3.5 py-3 transition-colors",
            combineChromeBad
              ? "border-destructive/70 bg-destructive/5"
              : testCoverageBorder(combineCoverage, selectedId === combine.id) ??
                statusBorder(combineStatus) ?? (
                  groupSelected ? "border-primary bg-primary/5" : "border-chart-3/40 bg-chart-3/5"
                ),
          )}
        >
          <StepButton
            onClick={() => onSelect?.(combine.id)}
            className="flex w-full items-start gap-2 text-left"
            moduleId={combine.id}
            label={combine.label}
            kind={ModuleKind.Combine}
            snippet={combine.note}
          >
            <StepIndex index={index} />
            <KindIcon kind={ModuleKind.Combine} />
            <StepBody
              label={combine.label}
              detail={
                <>
                  <StructureLink models={models} structureId={combine.inStructureId} fallback="pipeline" />
                  <span className="text-muted-foreground/60"> + </span>
                  {parse ? (
                    <StructureLink models={models} structureId={parse.outStructureId} />
                  ) : (
                    "document"
                  )}
                  <span className="text-muted-foreground/60"> → </span>
                  <StructureLink models={models} structureId={combine.outStructureId} />
                </>
              }
            />
            {combine.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
            {combineCoverage && <TestCoverageBadge status={combineCoverage} />}
            {innerProblems > 0 && (
              <span className="shrink-0 rounded border border-destructive/50 px-1.5 py-0.5 font-mono text-[9px] text-destructive">
                {innerProblems} inner issue{innerProblems === 1 ? "" : "s"}
              </span>
            )}
            <StepTrailingIcon
              invalid={combineChromeBad}
              status={combineStatus}
              editMode={editMode}
            />
          </StepButton>
          {combine.note && (
            <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-muted-foreground">{combine.note}</p>
          )}
          <StepButton
            onClick={() => onSelect?.(input.id)}
            moduleId={input.id}
            label={input.label}
            kind={ModuleKind.Input}
            snippet={input.note}
            className={cn(
              "mt-2 flex w-full items-start gap-3 rounded-md border bg-card px-3 py-2.5 text-left transition-colors",
              selectedId === input.id
                ? "border-primary"
                : inputIssue || inputStatus === "error"
                  ? "border-destructive/70 bg-destructive/5"
                  : testCoverageBorder(inputCoverage, selectedId === input.id) ??
                    statusBorder(inputStatus) ??
                    "border-border hover:border-muted-foreground/40",
            )}
          >
            <KindIcon kind={ModuleKind.Input} size="sm" />
            <StepBody
              label={input.label}
              labelClass="text-xs"
              detail={
                <>
                  <StructureLink models={models} structureId={input.outStructureId} />
                  <span className="text-muted-foreground/60"> · </span>
                  {inputTypeLabel(input.inputType)}
                </>
              }
            />
            {inputCoverage && <TestCoverageBadge status={inputCoverage} />}
            <StepTrailingIcon
              invalid={!!inputIssue}
              status={inputStatus}
              editMode={editMode}
            />
          </StepButton>
          <InvalidMessage
            show={!!inputIssue && inputIssue.kind !== "io-mismatch" && inputIssue.kind !== "cardinality-mismatch"}
            message={inputIssue ? invalidStepMessage(inputIssue, models, modules) : undefined}
            moduleId={input.id}
            label={input.label}
          />
          {convert && (
            <StepButton
              onClick={() => onSelect?.(convert.id)}
              moduleId={convert.id}
              label={convert.label}
              kind={ModuleKind.DocToText}
              snippet={convert.note}
              className={cn(
                "mt-2 flex w-full items-start gap-3 rounded-md border border-dashed border-chart-3/50 bg-chart-3/5 px-3 py-2.5 text-left transition-colors",
                selectedId === convert.id
                  ? "border-primary"
                  : convertIssue || convertStatus === "error"
                    ? "border-destructive/70 bg-destructive/5"
                    : statusBorder(convertStatus) ?? "hover:border-chart-3",
              )}
            >
              <KindIcon kind={ModuleKind.DocToText} size="sm" />
              <StepBody
                label={convert.label}
                labelClass="text-xs"
                detail={convertToTextDetail(convert)}
              />
              <AutoDocToTextLock />
              <StepTrailingIcon
                invalid={!!convertIssue}
                status={convertStatus}
                editMode={editMode}
              />
            </StepButton>
          )}
          {convert && (
            <InvalidMessage
              show={!!convertIssue && convertIssue.kind !== "io-mismatch" && convertIssue.kind !== "cardinality-mismatch"}
              message={convertIssue ? invalidStepMessage(convertIssue, models, modules) : undefined}
              moduleId={convert.id}
              label={convert.label}
            />
          )}
          {/* AI : spec §input — llm convert step is visualised inside the combine group when the side input maps to a non-Document structure */}
          {parse && (
            <StepButton
              onClick={() => onSelect?.(parse.id)}
              moduleId={parse.id}
              label={parse.label}
              kind={ModuleKind.Llm}
              snippet={parse.note}
              className={cn(
                "mt-2 flex w-full items-start gap-3 rounded-md border border-dashed border-chart-3/50 bg-chart-3/5 px-3 py-2.5 text-left transition-colors",
                selectedId === parse.id
                  ? "border-primary"
                  : parseIssue || parseStatus === "error"
                    ? "border-destructive/70 bg-destructive/5"
                    : statusBorder(parseStatus) ?? "hover:border-chart-3",
              )}
            >
              <KindIcon kind={ModuleKind.Llm} size="sm" />
              <StepBody
                label={parse.label}
                labelClass="text-xs"
                detail={
                  <>
                    <StructureLink models={models} structureId={parse.inStructureId} />
                    <span className="text-muted-foreground/60"> → </span>
                    <StructureLink models={models} structureId={parse.outStructureId} />
                  </>
                }
              />
              <AutoStructureParseLock />
              <StepTrailingIcon
                invalid={!!parseIssue}
                status={parseStatus}
                editMode={editMode}
              />
            </StepButton>
          )}
          {parse && (
            <InvalidMessage
              show={!!parseIssue && parseIssue.kind !== "io-mismatch" && parseIssue.kind !== "cardinality-mismatch"}
              message={parseIssue ? invalidStepMessage(parseIssue, models, modules) : undefined}
              moduleId={parse.id}
              label={parse.label}
            />
          )}
        </div>
        <InvalidMessage
          className="text-xs"
          show={!!combineInvalid || !!combineIoMsg || innerProblems > 0}
          message={
            combineInvalid
              ? invalidStepMessage(combineIssue!, models, modules)
              : combineIoMsg
                ? combineIoMsg
                : innerProblems > 0
                  ? `${innerProblems} issue${innerProblems === 1 ? "" : "s"} inside this group — click the failing step`
                  : undefined
          }
          moduleId={combine.id}
          label={combine.label}
        />
        {renderInsertAfter?.(insertAt, afterOpts) ?? (
          <PipelineConnector invalid={connectionInvalid} />
        )}
      </div>
    )
  }

  const m = seg.module
  const i = seg.index
  const stepIssue = invalid ? invalidForModule(invalid, m.id) : undefined
  const isInvalid = !!stepIssue && stepIssue.kind !== "io-mismatch" && stepIssue.kind !== "cardinality-mismatch"
  const ioLinked = stepIoMismatchLinked(m.id, modules, invalid)
  const stepWarnings = warnings?.get(m.id)
  const autoQuote = isAutoQuoteStep(m)
  const autoStruct = isAutoStructureParseStep(m)
  const autoConvert = isAutoDocToTextStep(m)
  const locked = isManagedLockedStep(m)
  const status = stepStatus?.get(m.id)
  const coverage = testCoverage?.get(m.id)

  if (m.kind === "output") {
    return (
      <div className="mx-auto flex w-full flex-col items-center">
        <div className="flex w-full items-center justify-center">
          <div className="relative w-full max-w-xs">
            <StepButton
              onClick={() => onSelect?.(m.id)}
              moduleId={m.id}
              label={m.label}
              kind={ModuleKind.Output}
              snippet={m.note}
              className={cn(
                "flex w-full flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-3 text-center transition-colors",
                "border-output/50 bg-output/5 shadow-sm",
                isInvalid && "border-destructive/70 bg-destructive/5",
                !isInvalid && ioLinked && "border-destructive/60 bg-destructive/[0.03]",
                testCoverageBorder(coverage, m.id === selectedId),
                statusBorder(status),
                m.id === selectedId && "border-output ring-1 ring-output/40",
                m.id !== selectedId &&
                  !isInvalid &&
                  !ioLinked &&
                  !status &&
                  !coverage &&
                  "hover:border-output/80 hover:bg-output/10",
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <StepIndex index={i} className="text-output/80" />
                <KindIcon kind={ModuleKind.Output} />
              </div>
              <StepBody
                label={m.label}
                centered
                detail={
                  <>
                    <StructureLink models={models} structureId={m.inStructureId} />
                    <span className="text-output/80"> · snapshot</span>
                  </>
                }
              />
              <div className="flex items-center justify-center gap-1.5">
                {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
                {coverage && <TestCoverageBadge status={coverage} />}
                {(isInvalid || ioLinked || status) && (
                  <StepTrailingIcon invalid={isInvalid || ioLinked} status={status} editMode={editMode} />
                )}
              </div>
            </StepButton>
            <ArrowRight
              className="pointer-events-none absolute left-full top-1/2 ml-2 h-4 w-4 -translate-y-1/2 text-output"
              aria-hidden
            />
          </div>
        </div>
        <InvalidMessage
          show={isInvalid}
          message={isInvalid ? invalidStepMessage(stepIssue!, models, modules) : undefined}
          className="max-w-xs"
          moduleId={m.id}
          label={m.label}
        />
        {renderInsertAfter?.(insertAt, afterOpts) ?? (
          <PipelineConnector invalid={connectionInvalid} />
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full flex-col items-center">
      <StepButton
        onClick={() => onSelect?.(m.id)}
        moduleId={m.id}
        label={m.label}
        kind={m.kind}
        snippet={m.note}
        className={cn(
          "group relative flex w-full items-start gap-3 rounded-lg border bg-card px-3.5 py-3 text-left transition-colors",
          locked &&
            (autoStruct || autoConvert
              ? "border-dashed border-chart-3/50 bg-chart-3/5"
              : "border-dashed border-chart-2/50 bg-chart-2/5"),
          isInvalid
            ? "border-destructive/70"
            : ioLinked
              ? "border-destructive/60"
              : testCoverageBorder(coverage, m.id === selectedId) ??
                statusBorder(status) ?? (
                m.id === selectedId
                  ? "border-primary ring-1 ring-primary/30"
                  : !locked && "border-border hover:border-muted-foreground/40"
              ),
        )}
      >
        <StepIndex index={i} />
        <KindIcon kind={m.kind} />
        <StepBody
          label={m.label}
          detail={
            m.kind === "input" ? (
              <>
                <StructureLink models={models} structureId={inputTargetStructureId(m, modules)} />
                <span className="text-muted-foreground/60"> · </span>
                {inputTypeLabel(m.inputType)}
              </>
            ) : autoQuote ? (
              <>
                <StructureLink models={models} structureId={m.inStructureId} />
                <span className="text-muted-foreground/60"> · same model in/out</span>
              </>
            ) : autoConvert ? (
              convertToTextDetail(m)
            ) : (
              <>
                <StructureLink models={models} structureId={m.inStructureId} />
                <span className="text-muted-foreground/60"> → </span>
                <StructureLink models={models} structureId={m.outStructureId} />
              </>
            )
          }
        />
        {autoQuote && <AutoQuoteLock />}
        {autoConvert && <AutoDocToTextLock />}
        {autoStruct && <AutoStructureParseLock />}
        {m.kind === "llm" && m.model && (
          editMode ? (
            <Badge variant="outline" className="shrink-0 font-mono text-[9px]">
              {m.model}
            </Badge>
          ) : (
            <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9px]">
              {m.model}
            </span>
          )
        )}
        {m.cached && <Zap className="h-3.5 w-3.5 shrink-0 text-primary" />}
        {coverage && <TestCoverageBadge status={coverage} />}
        <StepTrailingIcon invalid={isInvalid || ioLinked} status={status} editMode={editMode} />
      </StepButton>
      <InvalidMessage
        show={isInvalid}
        message={isInvalid ? invalidStepMessage(stepIssue!, models, modules) : undefined}
        moduleId={m.id}
        label={m.label}
      />
      {!isInvalid && stepWarnings?.length ? (
        <div className="mt-1 space-y-0.5">
          {warningStepMessages(stepWarnings, models, modules).map((msg, i) => (
            <p key={i} className={cn("text-center font-mono text-[10px]", WARNING_TEXT_CLASS)}>
              {msg}
            </p>
          ))}
        </div>
      ) : null}
      {renderInsertAfter?.(insertAt, afterOpts) ?? (
        <PipelineConnector invalid={connectionInvalid} />
      )}
    </div>
  )
}

export type PipelineCanvasSegmentProps = {
  seg: PipelineSegment
  modules: PipelineModule[]
  models: StructureModel[]
  selectedId?: ModuleId
  onSelect?: (id: ModuleId) => void
  stepStatus?: Map<ModuleId, RunStepStatus>
  testCoverage?: Map<ModuleId, PipelineTestCoverageStatus>
  invalid?: InvalidMap
  warnings?: Map<ModuleId, PipelineWarning[]>
  showConnector?: boolean
  className?: string
}

// AI : one pipeline segment — used by Testing align view (pair with test config in the same scroll row).
export function PipelineCanvasSegment({
  showConnector = true,
  className: _className,
  ...props
}: PipelineCanvasSegmentProps) {
  return (
    <SegmentRow
      {...props}
      editMode={false}
      renderInsertAfter={showConnector ? undefined : () => null}
    />
  )
}

export function PipelineCanvasConnector({ invalid }: { invalid?: boolean }) {
  return (
    <div className="mx-auto flex w-full flex-col items-center">
      <PipelineConnector invalid={invalid} />
    </div>
  )
}

export function PipelineCanvasStart() {
  return (
    <div className="mx-auto flex w-full flex-col items-center">
      <PipelineNode label="Start" subtle />
    </div>
  )
}

export function PipelineCanvasEnd() {
  return (
    <div className="mx-auto flex w-full flex-col items-center">
      <PipelineNode label="End" subtle />
    </div>
  )
}

function StepButton({
  onClick,
  className,
  children,
  moduleId,
  label,
  kind,
  snippet,
}: {
  onClick?: () => void
  className?: string
  children: React.ReactNode
  moduleId?: ModuleId | string
  label?: string
  kind?: string
  snippet?: string
}) {
  const ctx =
    moduleId && label
      ? uiContextTargetProps({
          kind: "pipeline_step",
          id: `step:${moduleId}`,
          label: `${label}${kind ? ` (${kind})` : ""}`,
          moduleId: String(moduleId),
          snippet,
        })
      : undefined
  return (
    <button type="button" onClick={onClick} className={className} {...ctx}>
      {children}
    </button>
  )
}

function StepIndex({ index, className }: { index: number; className?: string }) {
  return (
    <span className={cn("font-mono text-[10px] text-muted-foreground", className)}>
      {String(index + 1).padStart(2, "0")}
    </span>
  )
}

function convertToTextDetail(m: PipelineModule) {
  return (
    <>
      Document.content None → text
      <span className="text-muted-foreground/60">{m.useOcr ? " · OCR" : " · parser"}</span>
    </>
  )
}

function StepBody({
  label,
  detail,
  labelClass,
  centered,
}: {
  label: string
  detail: React.ReactNode
  labelClass?: string
  centered?: boolean
}) {
  return (
    <div className={cn("min-w-0 flex-1", centered && "w-full")}>
      <p className={cn("line-clamp-2 text-sm font-medium leading-snug", labelClass, centered && "text-center")}>
        {label}
      </p>
      <p className={cn("line-clamp-2 font-mono text-[10px] leading-snug text-muted-foreground", centered && "text-center")}>
        {detail}
      </p>
    </div>
  )
}

function ForkJoinRow({
  caption,
  selected,
  onSelect,
}: {
  caption: ReturnType<typeof forkJoinCaption>
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "mt-3 w-full rounded-md border border-dashed px-2.5 py-2 text-left transition-colors",
        selected ? "border-primary bg-primary/5" : "border-chart-4/50 bg-background/60 hover:border-chart-4",
      )}
    >
      <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        merge · {caption.mappings.length > 0 ? `${caption.mappings.length} lanes · ` : ""}{caption.title}
      </p>
      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{caption.detail}</p>
      {caption.mappings.length > 0 && (
        <>
          <div
            className="mt-2 grid gap-1"
            style={{ gridTemplateColumns: `repeat(${caption.mappings.length}, minmax(0, 1fr))` }}
          >
            {caption.mappings.map((m) => (
              <div key={`${m.lane}->${m.into}`} className="flex min-w-0 flex-col items-center gap-0.5">
                <span className="w-full truncate rounded border border-border bg-card px-1 py-0.5 text-center font-mono text-[10px]">
                  {m.lane}
                </span>
                <span className="font-mono text-[9px] text-muted-foreground">↓</span>
                <span className="w-full truncate rounded border border-chart-4/40 bg-chart-4/10 px-1 py-0.5 text-center font-mono text-[10px]">
                  {m.into}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 h-1 rounded-full bg-chart-4/50" />
        </>
      )}
    </button>
  )
}

function InvalidMessage({
  show,
  message,
  className,
  moduleId,
  label,
}: {
  show?: boolean
  message?: string
  className?: string
  moduleId?: ModuleId | string
  label?: string
}) {
  if (!show || !message) return null
  const ctx = moduleId
    ? uiContextTargetProps({
        kind: "invalid_issue",
        id: `invalid:${moduleId}:${truncateUiContextText(message, 40)}`,
        label: label ? `${label} · invalid` : "Invalid step",
        moduleId: String(moduleId),
        snippet: message,
      })
    : undefined
  return (
    <p
      className={cn("mt-1 text-center font-mono text-[10px] text-destructive", className)}
      {...ctx}
    >
      {message}
    </p>
  )
}

function StepTrailingIcon({
  invalid,
  status,
  editMode,
}: {
  invalid?: boolean
  status?: RunStepStatus
  editMode: boolean
}) {
  const palette = useStatusPalette()
  if (invalid) return <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: palette.err }} />
  if (!editMode) return <RunStatusIcon status={status} />
  return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

// AI : returns className for border/bg — uses destructive/chart-3/primary CSS vars (subtle cues).
// Icon colors (the primary status signal) are handled by RunStatusIcon/StepTrailingIcon via useStatusPalette.
function statusBorder(status?: RunStepStatus): string | undefined {
  if (status === "error") return "border-destructive/70 bg-destructive/5"
  if (status === "cached") return "border-chart-3/50 bg-chart-3/5"
  if (status === "ok") return "border-primary/40"
  if (status === "skipped") return "border-dashed border-muted-foreground/40 bg-muted/20 opacity-60"
  return undefined
}

function testCoverageBorder(
  status?: PipelineTestCoverageStatus,
  selected?: boolean,
): string | undefined {
  if (!status) return undefined
  const selectedRing = selected ? "ring-1 ring-primary/40" : undefined
  switch (status) {
    case PipelineTestCoverageStatus.Tracked:
      return cn("border-chart-2/50 bg-chart-2/5", selectedRing)
    case PipelineTestCoverageStatus.Untracked:
      return cn("border-dashed border-muted-foreground/45 bg-muted/10", selectedRing)
    case PipelineTestCoverageStatus.Input:
      return cn("border-sky-500/40 bg-sky-500/5", selectedRing)
    case PipelineTestCoverageStatus.Passthrough:
      return cn("border-dashed border-muted-foreground/30 bg-muted/15", selectedRing)
  }
}

function TestCoverageBadge({ status }: { status: PipelineTestCoverageStatus }) {
  if (status === PipelineTestCoverageStatus.Tracked) {
    return (
      <Badge variant="outline" className="shrink-0 border-chart-2/40 font-mono text-[9px] text-chart-2">
        checked
      </Badge>
    )
  }
  if (status === PipelineTestCoverageStatus.Untracked) {
    return (
      <Badge variant="outline" className="shrink-0 border-muted-foreground/40 font-mono text-[9px] text-muted-foreground">
        not checked
      </Badge>
    )
  }
  if (status === PipelineTestCoverageStatus.Input) {
    return (
      <Badge variant="outline" className="shrink-0 border-sky-500/40 font-mono text-[9px] text-sky-600">
        input
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="shrink-0 border-muted-foreground/35 font-mono text-[9px] text-muted-foreground">
      skip
    </Badge>
  )
}

function RunStatusIcon({ status }: { status?: RunStepStatus }) {
  const palette = useStatusPalette()
  if (status === "cached") return <Zap className="h-3.5 w-3.5 shrink-0 text-chart-3" />
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: palette.err }} />
  if (status === "skipped") {
    return <span className="shrink-0 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">skip</span>
  }
  return <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}
