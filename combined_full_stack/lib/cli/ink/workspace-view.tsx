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
import { TUI_TABS } from "@/lib/core/view"
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
    <Box>
      {TUI_TABS.map((t, i) => (
        <Text key={t} color={t === tab ? "cyan" : undefined} inverse={t === tab}>
          {` ${i + 1}:${t} `}
        </Text>
      ))}
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
        {tab === "build" ? (
          <BuildPanel
            pipeline={pipeline}
            validation={validation}
            selectedName={selected?.models.map((m) => m.name).join(", ")}
            documentation={selected?.documentation}
          />
        ) : tab === "docs" ? (
          // AI : TODO (cli-parity vs Docs + Documents tabs) — no markdown preview/split, no File upload, OCR, labels, project binding.
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Docs</Text>
            {docs.markdown ? <Text dimColor>{docs.markdown.slice(0, 160)}</Text> : <Text dimColor>no markdown</Text>}
            {docs.docs.length === 0 ? (
              <Text dimColor>no documents</Text>
            ) : (
              docs.docs.map((d) => (
                <Text key={d.name}>
                  {d.name}
                  <Text dimColor>  {d.label} {d.sizeKb}kb</Text>
                </Text>
              ))
            )}
          </Box>
        ) : tab === "tests" ? (
          // AI : TODO (cli-parity vs Testing tab) — list only; no run, git-diff expected vs actual, expectFailure.
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Tests</Text>
            {testing.tests.length === 0 ? (
              <Text dimColor>no *_testing.json docs</Text>
            ) : (
              testing.tests.map((t) => <Text key={t.name}>{t.name}</Text>)
            )}
          </Box>
        ) : tab === "agent" ? (
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Agent</Text>
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
              <Text dimColor>actions (not run locally): {agent.proposedActions.join(", ")}</Text>
            ) : null}
          </Box>
        ) : (
          // AI : TODO (cli-parity vs Logging + Cache) — no step traces, cache hits, Langfuse, billing charts.
          <Box flexDirection="column" flexGrow={1}>
            <Text bold>Logs</Text>
            {logs.runs.length === 0 ? (
              <Text dimColor>no local runs — hosted inference is remote</Text>
            ) : (
              logs.runs.map((r) => (
                <Text key={r.id}>
                  {r.status}
                  <Text dimColor>  {r.id}</Text>
                </Text>
              ))
            )}
          </Box>
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
            1-5 tabs  n new  r rename  m model  s step  a agent  y apply  x delete  q quit
          </Text>
        )}
      </Box>
    </Box>
  )
}
