// AI : presentational Ink view — only ViewModels; tests use renderToString without a TTY.
// AI : TODO (opt-browser-tui-view) — optional DOM twin (monospace CSS) consuming the same props/ViewModels.
// AI :   Do not import ink into components/; keep this file for CLI + tui.test.tsx.

import { Box, Text } from "ink"
import type {
  AgentView,
  DocsView,
  LogsView,
  PipelineView,
  TestingView,
  TuiTab,
  ValidationView,
} from "@/lib/core/view"
import {
  TUI_TAB_META,
  areaForTuiTab,
  toBillingView,
  toCacheView,
  toEarningsView,
  toInferenceView,
  toSettingsView,
  toShareView,
  toStructureView,
} from "@/lib/core/view"
import type { SessionSnapshot } from "@/lib/core/types"
import {
  commandAvailable,
  nextActionHint,
  resolveSelectedStepId,
  resolveSelectedTestName,
  selectedIndex,
  suggestedCommandId,
  suggestAgentPrompts,
  suggestCommands,
  suggestLogRuns,
  suggestModelAssign,
  suggestModelNames,
  suggestPipelineSteps,
  suggestStepEdits,
  suggestStepKinds,
  suggestTests,
  type TuiCommand,
  type TuiPane,
  type TuiPrompt,
} from "@/lib/cli/ink/commands"
import { AreaTabBar, PanelHeader } from "@/lib/cli/ink/panel-chrome"
import { LoggingPanel } from "@/lib/cli/ink/logging-view"

export type { TuiPrompt }

function formatSessionPathLabel(path?: string): string {
  if (!path) return "memory"
  const base = path.split(/[/\\]/).pop() ?? path
  if (base.length <= 40) return base
  return `…${base.slice(-36)}`
}

export type WorkspaceViewProps = {
  snap: SessionSnapshot
  pipeline: PipelineView | null
  validation: ValidationView
  docs: DocsView
  testing: TestingView
  agent: AgentView
  logs: LogsView
  tab: TuiTab
  selectedProjectId: string
  prompt: TuiPrompt
  sessionPath?: string
  agentBusy?: boolean
  selectedStepId?: string
  pane?: TuiPane
  selectedRunId?: string
  errorsOnly?: boolean
  selectedTestName?: string
  runBusy?: boolean
  statusMsg?: string
}

function Lines({ title, rows, empty }: { title: string; rows: string[]; empty?: string }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold>{title}</Text>
      {rows.length === 0 ? <Text dimColor>{empty ?? "empty"}</Text> : rows.map((row) => <Text key={row}>{row}</Text>)}
    </Box>
  )
}

function BuildPanel({
  pipeline,
  validation,
  selectedName,
  documentation,
  selectedStepId,
  pane,
  promptPreview,
  notePreview,
  structureName,
}: {
  pipeline: PipelineView | null
  validation: ValidationView
  selectedName?: string
  documentation?: string
  selectedStepId?: string
  pane?: TuiPane
  promptPreview?: string
  notePreview?: string
  structureName?: string
}) {
  const stepId = resolveSelectedStepId(pipeline, selectedStepId ?? "")
  const selected = pipeline?.steps.find((s) => s.id === stepId)
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="pipeline" />
      <Text bold inverse={pane === "steps"}>
        Pipeline: {pipeline?.title ?? "(none)"}
      </Text>
      {pipeline?.steps.map((s) => {
        const active = s.id === stepId
        return (
          <Text key={s.id} color={s.invalid.length ? "red" : "green"} inverse={active && pane === "steps"}>
            {active ? "> " : "  "}
            {"  ".repeat(s.indent ?? 0)}
            {s.invalid.length ? "x " : "ok "}
            {s.label}
            <Text dimColor>  {s.kind}</Text>
          </Text>
        )
      })}
      {selected ? (
        <Box marginTop={1} flexDirection="column">
          <Text bold>Looking at: {selected.label}</Text>
          <Text dimColor>prompt: {promptPreview || "(none)"}</Text>
          <Text dimColor>annotation: {notePreview || "(none)"}</Text>
          <Text dimColor>structure: {structureName || "(none)"}</Text>
          {selected.invalid.slice(0, 3).map((line) => (
            <Text key={line} color="red">
              {line}
            </Text>
          ))}
          <Text dimColor>↑↓ switch step   e configure   enter edits</Text>
        </Box>
      ) : null}
      {selectedName ? <Text dimColor>models: {selectedName}</Text> : null}
      <Box marginTop={1} flexDirection="column">
        <Text bold color={validation.ok ? "green" : "red"}>
          Validation: {validation.ok ? "ok" : `${validation.issues.length} error(s)`}
        </Text>
        {validation.issues.slice(0, 6).map((issue, i) => (
          <Text key={`${issue.where}-${i}`} color="red">
            [{issue.where}] {issue.message}
          </Text>
        ))}
      </Box>
      {documentation ? (
        <Box marginTop={1}>
          <Text dimColor>{documentation.slice(0, 120)}</Text>
        </Box>
      ) : null}
    </Box>
  )
}

export function WorkspaceView({
  snap,
  pipeline,
  validation,
  docs,
  testing,
  agent,
  logs,
  tab,
  selectedProjectId,
  prompt,
  sessionPath,
  agentBusy,
  selectedStepId,
  pane = "steps",
  selectedRunId,
  errorsOnly = false,
  selectedTestName,
  runBusy,
  statusMsg,
}: WorkspaceViewProps) {
  const selected = snap.projects.find((p) => p.id === selectedProjectId)
  const stepId = resolveSelectedStepId(pipeline, selectedStepId ?? "")
  const selectedModule = selected?.modules.find((m) => m.id === stepId)
  const structureName = selected?.models.find((m) => m.id === selectedModule?.outStructureId || m.id === selectedModule?.inStructureId)?.name
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="cyan">
          Spine
        </Text>
        <Text dimColor>  tui  </Text>
        <Text dimColor>{formatSessionPathLabel(sessionPath)}</Text>
        <Text dimColor>  {areaForTuiTab(tab)}/{tab}</Text>
        {runBusy ? <Text color="yellow">  running…</Text> : null}
      </Box>
      <Box marginTop={1}>
        <AreaTabBar tab={tab} />
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" width={28} marginRight={2}>
          <Text bold inverse={pane === "projects"}>
            Projects
          </Text>
          {snap.projects.length === 0 ? (
            <Text dimColor>empty — press n or type / new</Text>
          ) : (
            snap.projects.map((p) => {
              const active = p.id === selectedProjectId
              return (
                <Text key={p.id} color={active ? "green" : undefined} inverse={active && pane === "projects"}>
                  {active ? "> " : "  "}
                  {p.name}
                  {p.id === snap.activeProjectId ? " *" : ""}
                </Text>
              )
            })
          )}
        </Box>
        {tab === "pipeline" ? (
          <BuildPanel
            pipeline={pipeline}
            validation={validation}
            selectedName={selected?.models.map((m) => m.name).join(", ")}
            documentation={selected?.documentation}
            selectedStepId={stepId}
            pane={pane}
            promptPreview={selectedModule?.prompt?.slice(0, 80)}
            notePreview={selectedModule?.note?.slice(0, 80)}
            structureName={structureName}
          />
        ) : tab === "structure" ? (
          <StructurePanel snap={snap} />
        ) : tab === "docs" ? (
          <DocsPanel docs={docs} />
        ) : tab === "documents" ? (
          <DocumentsPanel docs={docs} />
        ) : tab === "testing" ? (
          <TestingPanel testing={testing} selectedTestName={selectedTestName} pane={pane} />
        ) : tab === "vibe" ? (
          <VibePanel agent={agent} agentBusy={agentBusy} />
        ) : tab === "logging" ? (
          <LoggingPanel logs={logs} selectedRunId={selectedRunId} errorsOnly={errorsOnly} pane={pane} />
        ) : tab === "inference" ? (
          <InferencePanel snap={snap} runBusy={runBusy} />
        ) : tab === "share" ? (
          <AnnotatedLines
            tab="share"
            rows={[
              ...toShareView(snap).shareLinkIds.map((id) => `link ${id}`),
              ...toShareView(snap).hostedApiIds.map((id) => `api ${id}`),
            ]}
          />
        ) : tab === "cache" ? (
          <AnnotatedLines
            tab="cache"
            rows={toCacheView(snap).entries.map((e) => (e.stepLabel ? `${e.stepLabel}  ${e.key}` : e.key))}
          />
        ) : tab === "billing" || tab === "project-billing" ? (
          <MoneyPanel kind="billing" snap={snap} />
        ) : tab === "earnings" ? (
          <MoneyPanel kind="earnings" snap={snap} />
        ) : (
          <SettingsPanel snap={snap} />
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {statusMsg ? <Text color="yellow">{statusMsg}</Text> : null}
        <PromptFooter
          snap={snap}
          validation={validation}
          prompt={prompt}
          pipeline={pipeline}
          selectedStepId={stepId}
          tab={tab}
          logs={logs}
          testing={testing}
          errorsOnly={errorsOnly}
        />
      </Box>
    </Box>
  )
}

function AnnotatedLines({ tab, rows }: { tab: TuiTab; rows: string[] }) {
  const meta = TUI_TAB_META[tab]
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab={tab} />
      <Lines title={meta.title} rows={rows} empty={meta.empty} />
    </Box>
  )
}

function StructurePanel({ snap }: { snap: SessionSnapshot }) {
  const view = toStructureView(snap)
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="structure" />
      {view.models.length === 0 && view.aliases.length === 0 ? (
        <Text dimColor>{TUI_TAB_META.structure.empty}</Text>
      ) : (
        view.models.map((m) => (
          <Box key={m.name} flexDirection="column">
            <Text bold>{m.name}</Text>
            {m.fields.length === 0 ? (
              <Text dimColor>  (no fields)</Text>
            ) : (
              m.fields.map((f) => (
                <Text key={`${m.name}.${f}`}>
                  {"  "}
                  <Text color="cyan">{f.split(":")[0]}</Text>
                  <Text dimColor>:{f.split(":").slice(1).join(":")}</Text>
                </Text>
              ))
            )}
          </Box>
        ))
      )}
      {view.aliases.map((a) => (
        <Text key={a} dimColor>
          alias {a}
        </Text>
      ))}
      <Text dimColor>m add model</Text>
    </Box>
  )
}

function DocsPanel({ docs }: { docs: DocsView }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="docs" />
      {docs.preview ? <Text>{docs.preview}</Text> : <Text dimColor>{TUI_TAB_META.docs.empty}</Text>}
      <Text dimColor>w or e to edit</Text>
    </Box>
  )
}

function DocumentsPanel({ docs }: { docs: DocsView }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="documents" />
      {docs.docs.length === 0 ? (
        <Text dimColor>{TUI_TAB_META.documents.empty}</Text>
      ) : (
        docs.docs.map((d) => (
          <Box key={d.name} flexDirection="column">
            <Text>
              {d.name}
              <Text dimColor>
                {"  "}
                {d.label}  {d.type}  {d.sizeKb}kb
              </Text>
            </Text>
            {d.preview ? (
              <Text dimColor>
                {"  "}
                {d.preview.slice(0, 80)}
              </Text>
            ) : null}
          </Box>
        ))
      )}
    </Box>
  )
}

function TestingPanel({
  testing,
  selectedTestName,
  pane,
}: {
  testing: TestingView
  selectedTestName?: string
  pane: TuiPane
}) {
  const name = resolveSelectedTestName(testing, selectedTestName ?? "")
  const selected = testing.tests.find((t) => t.name === name)
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="testing" />
      {testing.tests.length === 0 ? (
        <Text dimColor>{TUI_TAB_META.testing.empty}</Text>
      ) : (
        testing.tests.map((t) => {
          const active = t.name === name
          const color = t.verdict === "pass" ? "green" : t.verdict === "fail" ? "red" : undefined
          return (
            <Text key={t.name} color={color} inverse={active && pane === "tests"}>
              {active ? "> " : "  "}
              {t.verdict === "pass" ? "ok " : t.verdict === "fail" ? "x " : "· "}
              {t.name}
              <Text dimColor>  {t.verdict}</Text>
            </Text>
          )
        })
      )}
      {selected ? (
        <Text dimColor>
          Looking at: {selected.name} — t runs this file, results appear in Logging
        </Text>
      ) : null}
    </Box>
  )
}

function VibePanel({ agent, agentBusy }: { agent: AgentView; agentBusy?: boolean }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="vibe" />
      {agentBusy ? <Text color="yellow">thinking...</Text> : null}
      {agent.turns.length === 0 ? <Text dimColor>{TUI_TAB_META.vibe.empty}</Text> : null}
      {agent.turns.slice(-8).map((t, i) => (
        <Text key={`${t.role}-${i}`} color={t.role === "assistant" ? "cyan" : undefined}>
          {t.role === "user" ? "> " : "< "}
          {t.content.slice(0, 220)}
        </Text>
      ))}
      {agent.pendingChanged.length ? (
        <Text color="yellow">pending: {agent.pendingChanged.join(", ")} — y apply / d reject</Text>
      ) : (
        <Text dimColor>no pending proposal</Text>
      )}
      {agent.proposedActions.length ? <Text dimColor>actions: {agent.proposedActions.join(", ")}</Text> : null}
    </Box>
  )
}

function InferencePanel({ snap, runBusy }: { snap: SessionSnapshot; runBusy?: boolean }) {
  const view = toInferenceView(snap)
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="inference" />
      {runBusy ? <Text color="yellow">running…</Text> : null}
      {view.assignments.length === 0 ? (
        <Text dimColor>{TUI_TAB_META.inference.empty}</Text>
      ) : (
        view.assignments.map((a) => (
          <Text key={a.moduleId} color={a.ready ? "green" : "yellow"}>
            {a.ready ? "ok " : "· "}
            {a.moduleLabel}
            <Text dimColor>  {a.docNames.join(", ") || "(none)"}</Text>
          </Text>
        ))
      )}
      <Text dimColor>{view.ready ? "i run pipeline — trace opens in Logging" : "assign docs via spine session assign-input, then i"}</Text>
    </Box>
  )
}

function MoneyPanel({ kind, snap }: { kind: "billing" | "earnings"; snap: SessionSnapshot }) {
  const view = kind === "billing" ? toBillingView(snap) : toEarningsView(snap)
  const meta = TUI_TAB_META[kind]
  const rows = view
    ? kind === "billing"
      ? [
          `balance ${view.balanceCents}¢`,
          view.totalBilledCents != null ? `billed ${view.totalBilledCents}¢` : "",
          view.totalUsageCents != null ? `usage ${view.totalUsageCents}¢` : "",
        ].filter(Boolean)
      : [
          `balance ${view.balanceCents}¢`,
          view.totalEarnedCents != null ? `earned ${view.totalEarnedCents}¢` : "",
          view.totalWithdrawnCents != null ? `withdrawn ${view.totalWithdrawnCents}¢` : "",
        ].filter(Boolean)
    : []
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab={kind} />
      <Lines title={meta.title} rows={rows} empty={meta.empty} />
    </Box>
  )
}

function SettingsPanel({ snap }: { snap: SessionSnapshot }) {
  const view = toSettingsView(snap)
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="settings" />
      <Text>model {view.model}</Text>
      <Text dimColor>{view.saveError ?? "save ok"}</Text>
      <Text dimColor>{view.modelOptionCount} model options</Text>
    </Box>
  )
}

function SuggestRow({ active, title, detail }: { active: boolean; title: string; detail: string }) {
  return (
    <Text color={active ? "green" : undefined} inverse={active}>
      {active ? "▸ " : "  "}
      {title}
      {detail ? <Text dimColor>  {detail}</Text> : null}
    </Text>
  )
}

function PromptFooter({
  snap,
  validation,
  prompt,
  pipeline,
  selectedStepId,
  tab,
  logs,
  testing,
  errorsOnly,
}: {
  snap: SessionSnapshot
  validation: ValidationView
  prompt: TuiPrompt
  pipeline: PipelineView | null
  selectedStepId: string
  tab: TuiTab
  logs: LogsView
  testing: TestingView
  errorsOnly: boolean
}) {
  const ctx = {
    hasProject: snap.projects.length > 0,
    hasProposal: snap.pendingProposal != null,
    hasSteps: (pipeline?.steps.length ?? 0) > 0,
    tab,
    hasRuns: logs.runs.length > 0,
    hasTests: testing.tests.length > 0,
    validationOk: validation.ok,
  }
  const hintCtx = { ...ctx, projectCount: snap.projects.length, validation }
  const suggested = suggestedCommandId(hintCtx)
  const project = snap.projects.find((p) => p.id === snap.activeProjectId) ?? snap.projects[0]
  const selectedModule = project?.modules.find((m) => m.id === selectedStepId)
  const modelNames = project?.models.map((m) => m.name) ?? []

  if (prompt?.kind === "rename") {
    return (
      <>
        <Text color="yellow">rename: {prompt.buffer}_</Text>
        <Text dimColor>enter to save   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "delete") {
    return <Text color="yellow">delete "{prompt.name}"? y/n</Text>
  }
  if (prompt?.kind === "model") {
    const hits = suggestModelNames(prompt.buffer)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">add model: {prompt.buffer}_</Text>
        {hits.map((name, i) => (
          <SuggestRow key={name} active={i === sel} title={name} detail="example — or type your own" />
        ))}
        <Text dimColor>tab completes   enter to add   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "step") {
    const hits = suggestStepKinds(prompt.buffer)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">add step: {prompt.buffer}_</Text>
        {hits.length === 0 ? (
          <Text dimColor>no matching step kind</Text>
        ) : (
          hits.map((row, i) => (
            <SuggestRow key={row.kind} active={i === sel} title={row.kind} detail={`${row.label} — ${row.hint.slice(0, 52)}`} />
          ))
        )}
        <Text dimColor>↑↓ to choose   enter to add   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "agent") {
    const hits = suggestAgentPrompts(prompt.buffer, validation)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">vibe: {prompt.buffer}_</Text>
        {hits.map((line, i) => (
          <SuggestRow key={line} active={i === sel} title={line} detail="" />
        ))}
        <Text dimColor>tab completes   enter sends   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "pick-step") {
    const hits = suggestPipelineSteps(prompt.buffer, pipeline)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">look at step: {prompt.buffer}_</Text>
        {hits.length === 0 ? (
          <Text dimColor>no matching step</Text>
        ) : (
          hits.map((row, i) => (
            <SuggestRow
              key={row.id}
              active={i === sel}
              title={row.label}
              detail={row.invalid[0] ? `${row.kind} — ${row.invalid[0]}` : row.kind}
            />
          ))
        )}
        <Text dimColor>↑↓ switch   enter to configure   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "edit-step") {
    const step = pipeline?.steps.find((s) => s.id === prompt.stepId)
    const module = project?.modules.find((m) => m.id === prompt.stepId) ?? selectedModule
    const hits = suggestStepEdits(prompt.buffer, {
      kind: module?.kind ?? step?.kind ?? "",
      label: module?.label ?? step?.label ?? "",
      prompt: module?.prompt,
      note: module?.note,
      modelName: project?.models.find((m) => m.id === module?.outStructureId || m.id === module?.inStructureId)?.name,
      invalid: step?.invalid ?? [],
      modelCount: modelNames.length,
    })
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">configure {step?.label ?? "step"}: {prompt.buffer}_</Text>
        {hits.map((row) => (
          <SuggestRow key={row.id} active={hits[sel]?.id === row.id} title={row.label} detail={row.hint} />
        ))}
        <Text dimColor>↑↓ choose   enter   esc back</Text>
      </>
    )
  }
  if (prompt?.kind === "step-field") {
    const hits = prompt.field === "structure" ? suggestModelAssign(prompt.buffer, modelNames) : []
    const sel = selectedIndex(prompt, hits.length)
    const labels = { label: "rename step", prompt: "set prompt", note: "set note", structure: "assign structure" }
    return (
      <>
        <Text color="yellow">{labels[prompt.field]}: {prompt.buffer}_</Text>
        {prompt.field === "structure" && hits.length === 0 ? (
          <Text dimColor>no models — add a model first (esc, then m)</Text>
        ) : (
          hits.map((name, i) => <SuggestRow key={name} active={i === sel} title={name} detail="structure for this step" />)
        )}
        <Text dimColor>enter to save   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "pick-run") {
    const hits = suggestLogRuns(prompt.buffer, logs, errorsOnly)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">look at run: {prompt.buffer}_</Text>
        {hits.length === 0 ? (
          <Text dimColor>no matching run</Text>
        ) : (
          hits.map((row, i) => (
            <SuggestRow
              key={row.id}
              active={i === sel}
              title={`${row.status} ${row.inputLabel}`}
              detail={`${row.duration} ${row.cost}${row.errorSummary ? ` — ${row.errorSummary}` : ""}`}
            />
          ))
        )}
        <Text dimColor>↑↓ switch   enter   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "pick-test") {
    const hits = suggestTests(prompt.buffer, testing)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">run test: {prompt.buffer}_</Text>
        {hits.length === 0 ? (
          <Text dimColor>no matching test</Text>
        ) : (
          hits.map((row, i) => (
            <SuggestRow key={row.name} active={i === sel} title={row.name} detail={row.verdict} />
          ))
        )}
        <Text dimColor>↑↓ switch   enter runs   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "docs") {
    return (
      <>
        <Text color="yellow">docs: {prompt.buffer}_</Text>
        <Text dimColor>enter to save   esc cancel</Text>
      </>
    )
  }
  if (prompt?.kind === "command") {
    const hits = suggestCommands(prompt.buffer, ctx, suggested)
    const sel = selectedIndex(prompt, hits.length)
    return (
      <>
        <Text color="yellow">/ {prompt.buffer}_</Text>
        {hits.length === 0 ? (
          <Text dimColor>no matching command</Text>
        ) : (
          hits.map((cmd, i) => (
            <CommandSuggestRow key={cmd.id} cmd={cmd} active={i === sel} available={commandAvailable(cmd, ctx)} />
          ))
        )}
        <Text dimColor>↑↓ to choose   enter runs   esc cancel</Text>
      </>
    )
  }
  const idleCmds = suggestCommands("", ctx, suggested)
    .filter((cmd) => !cmd.id.startsWith("tab-") && cmd.id !== "quit")
    .slice(0, 5)
  return (
    <>
      <Text>
        <Text color="cyan">/</Text>
        <Text> search commands</Text>
        <Text dimColor>   e inspect   i run   t test   q quit</Text>
      </Text>
      {idleCmds.map((cmd) => (
        <CommandSuggestRow key={cmd.id} cmd={cmd} active={cmd.id === suggested} available={commandAvailable(cmd, ctx)} />
      ))}
      <Text dimColor>{nextActionHint(hintCtx)}</Text>
    </>
  )
}

function CommandSuggestRow({ cmd, active, available }: { cmd: TuiCommand; active: boolean; available: boolean }) {
  const detail = available ? `${cmd.key}  ${cmd.hint}` : `${cmd.key}  unavailable — ${cmd.hint}`
  return (
    <Text color={active ? "green" : undefined} dimColor={!available} inverse={active && available}>
      {active ? "▸ " : "  "}
      {cmd.label}
      <Text dimColor>  {detail}</Text>
    </Text>
  )
}
