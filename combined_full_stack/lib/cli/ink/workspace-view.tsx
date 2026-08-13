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

export type TuiPrompt =
  | { kind: "rename"; buffer: string }
  | { kind: "model"; buffer: string }
  | { kind: "delete"; name: string }
  | { kind: "agent"; buffer: string }
  | { kind: "step"; buffer: string }
  | null

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
}: {
  pipeline: PipelineView | null
  validation: ValidationView
  selectedName?: string
  documentation?: string
}) {
  return (
    <Box flexDirection="column" flexGrow={1}>
      <Text bold>Pipeline: {pipeline?.title ?? "(none)"}</Text>
      {pipeline?.steps.map((s) => (
        <Text key={s.id} color={s.invalid.length ? "red" : "green"}>
          {s.invalid.length ? "x " : "ok "}
          {s.label}
          <Text dimColor>  {s.kind}</Text>
        </Text>
      ))}
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
}: WorkspaceViewProps) {
  const selected = snap.projects.find((p) => p.id === selectedProjectId)
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
          <Text bold>Projects</Text>
          {snap.projects.length === 0 ? (
            <Text dimColor>empty — press n</Text>
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
      <Box marginTop={1}>
        {prompt?.kind === "rename" ? (
          <Text color="yellow">rename: {prompt.buffer}_</Text>
        ) : prompt?.kind === "model" ? (
          <Text color="yellow">add-model: {prompt.buffer}_</Text>
        ) : prompt?.kind === "delete" ? (
          <Text color="yellow">delete "{prompt.name}"? y/n</Text>
        ) : prompt?.kind === "agent" ? (
          <Text color="yellow">agent: {prompt.buffer}_</Text>
        ) : prompt?.kind === "step" ? (
          <Text color="yellow">add-step kind: {prompt.buffer}_</Text>
        ) : (
          <Text dimColor>
            [ ] cycle  1-9 tabs  n new  r rename  m model  s step  a vibe  y apply  x delete  q quit
          </Text>
        )}
      </Box>
    </Box>
  )
}
