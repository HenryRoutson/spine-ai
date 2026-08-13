// AI : Logging tab — run list + selected step trace (parity with the web Run History panel).

import { Box, Text } from "ink"
import { TUI_TAB_META, type LogsView, type LogRunView } from "@/lib/core/view"
import { resolveSelectedRunId, type TuiPane } from "@/lib/cli/ink/commands"
import { JsonInk } from "@/lib/cli/ink/syntax"
import { PanelHeader } from "@/lib/cli/ink/panel-chrome"

export type LoggingPanelProps = {
  logs: LogsView
  selectedRunId?: string
  errorsOnly?: boolean
  pane?: TuiPane
}

function statusColor(status: string): "green" | "red" | "yellow" | undefined {
  if (status === "ok" || status === "pass" || status === "cached") return "green"
  if (status === "error" || status === "fail") return "red"
  if (status === "running") return "yellow"
  return undefined
}

function RunRow({ run, active, pane }: { run: LogRunView; active: boolean; pane: TuiPane }) {
  const badge = run.testDoc ? (run.testPassed == null ? "test" : run.testPassed ? "pass" : "FAIL") : run.source || "app"
  return (
    <Text inverse={active && pane === "runs"} color={statusColor(run.hasErrors ? "error" : run.status)}>
      {active ? "> " : "  "}
      {run.hasErrors ? "x " : "ok "}
      {run.inputLabel}
      <Text dimColor>
        {"  "}
        {run.status}  {run.duration}  {run.cost}
        {run.saved ? `  saved ${run.saved}` : ""}  {run.steps} steps  {badge}  {run.ago}
      </Text>
    </Text>
  )
}

function RunDetail({ run }: { run: LogRunView }) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text bold>
        Looking at: {run.id.slice(0, 14)}
        <Text dimColor>
          {"  "}
          {run.status}  {run.model}  {run.duration}  {run.cost}
          {run.saved ? `  cache saved ${run.saved}` : ""}
        </Text>
      </Text>
      <Text dimColor>
        {run.inputLabel}
        {run.source ? `  · ${run.source}` : ""}
        {run.testDoc ? `  · test ${run.testDoc}` : ""}
      </Text>
      {run.notes ? <Text>note: {run.notes}</Text> : null}
      {run.langfuse ? <Text dimColor>langfuse: {run.langfuse}</Text> : null}
      {run.errorSummary ? <Text color="red">{run.errorSummary}</Text> : null}
      {run.testDoc && run.testPassed != null ? (
        <Text color={run.testPassed ? "green" : "red"}>{run.testPassed ? "test passed" : "test failed"}</Text>
      ) : null}
      {run.stepRows.map((s, i) => (
        <Box key={`${s.label}-${i}`} flexDirection="column">
          <Text color={statusColor(s.status)}>
            {"  "}
            {i + 1}. {s.status === "error" ? "x" : s.cached ? "*" : "ok"} {s.label}
            <Text dimColor>
              {"  "}
              {s.kind}  {s.ms}  {s.cost}
              {s.llmCalls ? `  ${s.llmCalls} llm` : ""}
            </Text>
          </Text>
          {s.error ? (
            <Text>
              {"     "}
              <JsonInk value={s.error} error />
            </Text>
          ) : s.preview ? (
            <Text>
              {"     "}
              <JsonInk value={s.preview} />
            </Text>
          ) : null}
        </Box>
      ))}
      <Text dimColor>↑↓ switch run   e inspect   f errors-only   i run inference</Text>
    </Box>
  )
}

export function LoggingPanel({ logs, selectedRunId, errorsOnly = false, pane = "runs" }: LoggingPanelProps) {
  const visible = errorsOnly ? logs.runs.filter((r) => r.hasErrors) : logs.runs
  const runId = resolveSelectedRunId(logs, selectedRunId ?? "", errorsOnly)
  const selected = visible.find((r) => r.id === runId) ?? logs.runs.find((r) => r.id === runId)
  const meta = TUI_TAB_META.logging
  return (
    <Box flexDirection="column" flexGrow={1}>
      <PanelHeader tab="logging" />
      <Text bold inverse={pane === "runs"}>
        {errorsOnly ? `Errors only (${logs.errorCount})` : `Runs (${logs.runs.length}${logs.errorCount ? `, ${logs.errorCount} error` : ""})`}
      </Text>
      {visible.length === 0 ? (
        <Text dimColor>{errorsOnly ? "no failing runs" : meta.empty}</Text>
      ) : (
        visible.slice(0, 12).map((r) => <RunRow key={r.id} run={r} active={r.id === runId} pane={pane} />)
      )}
      {selected ? <RunDetail run={selected} /> : null}
    </Box>
  )
}
