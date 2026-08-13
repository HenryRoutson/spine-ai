// AI : presentational Ink view — only ViewModels; tests use renderToString without a TTY.

import { Box, Text } from "ink"
import type { PipelineView, ValidationView } from "@/lib/core/view"
import type { SessionSnapshot } from "@/lib/core/types"

export type TuiPrompt =
  | { kind: "rename"; buffer: string }
  | { kind: "model"; buffer: string }
  | { kind: "delete"; name: string }
  | null

export type WorkspaceViewProps = {
  snap: SessionSnapshot
  pipeline: PipelineView | null
  validation: ValidationView
  selectedProjectId: string
  prompt: TuiPrompt
  sessionPath?: string
}

export function WorkspaceView({
  snap,
  pipeline,
  validation,
  selectedProjectId,
  prompt,
  sessionPath,
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
        <Text dimColor>  local</Text>
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
        <Box flexDirection="column" flexGrow={1}>
          <Text bold>Pipeline: {pipeline?.title ?? "(none)"}</Text>
          {pipeline?.steps.map((s) => (
            <Text key={s.id} color={s.invalid.length ? "red" : "green"}>
              {s.invalid.length ? "x " : "ok "}
              {s.label}
              <Text dimColor>  {s.kind}</Text>
            </Text>
          ))}
          {selected?.models.length ? (
            <Text dimColor>models: {selected.models.map((m) => m.name).join(", ")}</Text>
          ) : null}
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
          {selected?.documentation ? (
            <Box marginTop={1}>
              <Text dimColor>{selected.documentation.slice(0, 120)}</Text>
            </Box>
          ) : null}
        </Box>
      </Box>
      <Box marginTop={1}>
        {prompt?.kind === "rename" ? (
          <Text color="yellow">rename: {prompt.buffer}_</Text>
        ) : prompt?.kind === "model" ? (
          <Text color="yellow">add-model: {prompt.buffer}_</Text>
        ) : prompt?.kind === "delete" ? (
          <Text color="yellow">delete "{prompt.name}"? y/n</Text>
        ) : (
          <Text dimColor>n new  ↑↓ open  r rename  m model  x delete  q quit</Text>
        )}
      </Box>
    </Box>
  )
}
