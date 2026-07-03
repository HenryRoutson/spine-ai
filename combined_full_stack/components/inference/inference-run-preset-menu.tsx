"use client"

// AI : "pre-selected runs" menu (spec/TODO) — named seed presets plus every *_testing.json test,
// AI : each resolving to a full input-slot assignment in one click.

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, CheckSquare, FileText, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { docTextContent, fetchDocText } from "@/lib/doc-text-cache"
import { resolveNamedRunInputs, type NamedRunInputs } from "@/lib/inference-presets"
import { docsForInputModule, type InputDocsAssignment } from "@/lib/inference-input"
import { isTestingFileName, parseTestFile, TESTING_FILE_SUFFIX } from "@/lib/testing-files"
import { docsForProject } from "@/lib/project-docs"
import { cn } from "@/lib/utils"
import type { DocId, DocRef, PipelineModule, Project } from "@/lib/types"

type PresetOption = {
  id: string
  kind: "preset" | "test"
  name: string
  description?: string
  inputs: NamedRunInputs
}

function useRunPresetOptions(project: Project, docs: DocRef[]): PresetOption[] {
  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])
  const testDocs = useMemo(() => projectDocs.filter((d) => isTestingFileName(d.name)), [projectDocs])
  const [testContents, setTestContents] = useState<Record<DocId, string>>({})

  useEffect(() => {
    for (const d of testDocs) {
      if (testContents[d.id] !== undefined) continue
      void fetchDocText(d.id)
        .then((data) => setTestContents((prev) => ({ ...prev, [d.id]: docTextContent(data) })))
        .catch(() => setTestContents((prev) => ({ ...prev, [d.id]: "" })))
    }
  }, [testDocs, testContents])

  return useMemo(() => {
    const presets: PresetOption[] = (project.inferencePresets ?? []).map((p, i) => ({
      id: `preset:${i}`,
      kind: "preset",
      name: p.name,
      description: p.description,
      inputs: p.inputs,
    }))
    const tests: PresetOption[] = testDocs.flatMap((d) => {
      const content = testContents[d.id]
      if (!content) return []
      const parsed = parseTestFile(content)
      if (!parsed.ok || !parsed.test.inputs || !Object.keys(parsed.test.inputs).length) return []
      return [
        {
          id: `test:${d.id}`,
          kind: "test" as const,
          name: d.name.slice(0, -TESTING_FILE_SUFFIX.length) || d.name,
          description: parsed.test.description,
          inputs: parsed.test.inputs,
        },
      ]
    })
    return [...presets, ...tests]
  }, [project.inferencePresets, testDocs, testContents])
}

function assignmentKey(assignment: InputDocsAssignment, inputModules: PipelineModule[]): string {
  return inputModules
    .map((m) => docsForInputModule(assignment, m.id).map((d) => d.id).join("+"))
    .join(",")
}

export function InferenceRunPresetMenu({
  project,
  docs,
  inputModules,
  inputDocs,
  disabled,
  onApply,
}: {
  project: Project
  docs: DocRef[]
  inputModules: PipelineModule[]
  inputDocs: InputDocsAssignment
  disabled?: boolean
  onApply: (assignment: InputDocsAssignment) => void
}) {
  const options = useRunPresetOptions(project, docs)
  const projectDocs = useMemo(() => docsForProject(docs, project), [docs, project])

  const resolved = useMemo(
    () =>
      options.map((o) => ({
        option: o,
        result: resolveNamedRunInputs(o.inputs, inputModules, projectDocs),
      })),
    [options, inputModules, projectDocs],
  )

  const currentKey = assignmentKey(inputDocs, inputModules)
  const active = resolved.find((r) => r.result.ok && assignmentKey(r.result.assignment, inputModules) === currentKey)

  if (!options.length) return null

  const presets = resolved.filter((r) => r.option.kind === "preset")
  const tests = resolved.filter((r) => r.option.kind === "test")

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-foreground">{active ? active.option.name : "Pre-selected runs"}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {presets.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] uppercase text-muted-foreground">
              examples
            </DropdownMenuLabel>
            {presets.map(({ option, result }) => (
              <PresetMenuItem
                key={option.id}
                option={option}
                result={result}
                isActive={active?.option.id === option.id}
                icon={<FileText className="h-3.5 w-3.5 shrink-0 text-primary" />}
                onApply={onApply}
              />
            ))}
          </DropdownMenuGroup>
        )}
        {presets.length > 0 && tests.length > 0 && <DropdownMenuSeparator />}
        {tests.length > 0 && (
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-mono text-[10px] uppercase text-muted-foreground">
              from tests
            </DropdownMenuLabel>
            {tests.map(({ option, result }) => (
              <PresetMenuItem
                key={option.id}
                option={option}
                result={result}
                isActive={active?.option.id === option.id}
                icon={<CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />}
                onApply={onApply}
              />
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PresetMenuItem({
  option,
  result,
  isActive,
  icon,
  onApply,
}: {
  option: PresetOption
  result: ReturnType<typeof resolveNamedRunInputs>
  isActive: boolean
  icon: React.ReactNode
  onApply: (assignment: InputDocsAssignment) => void
}) {
  return (
    <DropdownMenuItem
      disabled={!result.ok}
      title={result.ok ? undefined : result.error}
      onClick={() => result.ok && onApply(result.assignment)}
      className="flex items-start gap-2"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{option.name}</span>
        {(option.description || !result.ok) && (
          <span className={cn("block truncate text-[10px]", result.ok ? "text-muted-foreground" : "text-destructive")}>
            {result.ok ? option.description : result.error}
          </span>
        )}
      </span>
      {isActive && <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />}
    </DropdownMenuItem>
  )
}
