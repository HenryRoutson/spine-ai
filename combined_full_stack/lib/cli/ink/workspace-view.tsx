// AI : presentational Ink view — only ViewModels; tests use renderToString without a TTY.

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
  TUI_TABS,
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
  selectedIndex,
  suggestedCommandId,
  suggestAgentPrompts,
  suggestCommands,
  suggestModelAssign,
  suggestModelNames,
  suggestPipelineSteps,
  suggestStepEdits,
  suggestStepKinds,
  type TuiCommand,
  type TuiPane,
  type TuiPrompt,
} from "@/lib/cli/ink/commands"

export type { TuiPrompt }

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
}

function TabBar({ tab }: { tab: TuiTab }) {
  return (
    <Box flexWrap="wrap">
      {TUI_TABS.map((t, i) => (
        <Text key={t} color={t === tab ? "cyan" : undefined} inverse={t === tab}>
          {` ${i + 1}:${t} `}
        </Text>
      ))}
    </Box>
  )
}

function Lines({ title, rows }: { title: string; rows: string[] }) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold>{title}</Text>
      {rows.length === 0 ? <Text dimColor>empty</Text> : rows.map((row) => <Text key={row}>{row}</Text>)}
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
      <Text bold inverse={pane === "steps"}>
        Pipeline: {pipeline?.title ?? "(none)"}
      </Text>
      {pipeline?.steps.map((s) => {
        const active = s.id === stepId
        return (
          <Text key={s.id} color={s.invalid.length ? "red" : "green"} inverse={active && pane === "steps"}>
            {active ? "> " : "  "}
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
          <Text dimColor>note: {notePreview || "(none)"}</Text>
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
        <Text dimColor>{sessionPath ?? "memory"}</Text>
        <Text dimColor>  {tab}</Text>
      </Box>
      <Box marginTop={1}>
        <TabBar tab={tab} />
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" width={36} marginRight={2}>
          <Text bold inverse={pane === "projects"}>
            Projects
          </Text>
          {snap.projects.length === 0 ? (
            <Text dimColor>empty — press n or type / new</Text>
          ) : (
            snap.projects.map((p) => {
              const active = p.id === selectedProjectId
              return (
                <Text key={p.id} color={active ? "green" : undefined} inverse={active}>
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
          <Lines
            title="Structure"
            rows={[
              ...toStructureView(snap).models.map((m) => `${m.name}  ${m.fields.join(", ") || "(no fields)"}`),
              ...toStructureView(snap).aliases.map((a) => `alias ${a}`),
            ]}
          />
        ) : tab === "docs" ? (
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Docs</Text>
            {docs.preview ? <Text dimColor>{docs.preview}</Text> : <Text dimColor>no markdown</Text>}
          </Box>
        ) : tab === "documents" ? (
          <Lines
            title="Documents"
            rows={docs.docs.map((d) => `${d.name}  ${d.label} ${d.sizeKb}kb`)}
          />
        ) : tab === "testing" ? (
          <Lines title="Testing" rows={testing.tests.map((t) => t.name)} />
        ) : tab === "vibe" ? (
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Vibe</Text>
            {agentBusy ? <Text color="yellow">thinking...</Text> : null}
            {agent.turns.slice(-6).map((t, i) => (
              <Text key={`${t.role}-${i}`} color={t.role === "assistant" ? "cyan" : undefined}>
                {t.role === "user" ? "> " : "< "}
                {t.content.slice(0, 200)}
              </Text>
            ))}
            {agent.pendingChanged.length ? (
              <Text color="yellow">pending: {agent.pendingChanged.join(", ")} — y apply / d reject</Text>
            ) : (
              <Text dimColor>no pending proposal</Text>
            )}
            {agent.proposedActions.length ? (
              <Text dimColor>actions: {agent.proposedActions.join(", ")}</Text>
            ) : null}
          </Box>
        ) : tab === "logging" ? (
          <Lines
            title="Logging"
            rows={logs.runs.map((r) =>
              [r.status, r.id, r.notes, r.testDoc, r.langfuse, `${r.steps} steps`].filter(Boolean).join("  "),
            )}
          />
        ) : tab === "inference" ? (
          <Lines
            title="Inference"
            rows={toInferenceView(snap).assignments.map((a) => `${a.moduleId}: ${a.docIds.join(",") || "(none)"}`)}
          />
        ) : tab === "share" ? (
          <Lines
            title="Share"
            rows={[
              ...toShareView(snap).shareLinkIds.map((id) => `link ${id}`),
              ...toShareView(snap).hostedApiIds.map((id) => `api ${id}`),
            ]}
          />
        ) : tab === "cache" ? (
          <Lines title="Cache" rows={toCacheView(snap).entries.map((e) => e.key)} />
        ) : tab === "billing" ? (
          <Lines
            title="Billing"
            rows={[toBillingView(snap) ? `${toBillingView(snap)!.balanceCents}¢` : "no account — session pull / SPINE_API_URL"]}
          />
        ) : tab === "earnings" ? (
          <Lines
            title="Earnings"
            rows={[toEarningsView(snap) ? `${toEarningsView(snap)!.balanceCents}¢` : "no account — session pull / SPINE_API_URL"]}
          />
        ) : (
          <Lines
            title="Settings"
            rows={[
              `model ${toSettingsView(snap).model}`,
              toSettingsView(snap).saveError ?? "save ok",
              `${toSettingsView(snap).modelOptionCount} model options`,
            ]}
          />
        )}
      </Box>
      <Box marginTop={1} flexDirection="column">
        <PromptFooter
          snap={snap}
          validation={validation}
          prompt={prompt}
          pipeline={pipeline}
          selectedStepId={stepId}
        />
      </Box>
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
}: {
  snap: SessionSnapshot
  validation: ValidationView
  prompt: TuiPrompt
  pipeline: PipelineView | null
  selectedStepId: string
}) {
  const ctx = {
    hasProject: snap.projects.length > 0,
    hasProposal: snap.pendingProposal != null,
    hasSteps: (pipeline?.steps.length ?? 0) > 0,
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
        <Text dimColor>   e configure step   q quit</Text>
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
